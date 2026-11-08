// Package push gestiona los tokens push (FCM) de los dispositivos registrados
// y el envío de notificaciones desde el backend (Sprint 4C). Un dispositivo
// tiene como máximo un token activo; los tokens nunca se devuelven por la API
// y FCM los revoca en el acto cuando dejan de ser válidos.
package push

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"
	"triomision/api/internal/apierr"

	"triomision/api/internal/auth"
	"triomision/api/internal/authz"
	"triomision/api/internal/database"
)

// Register registra los endpoints de token push del propio usuario y el envío
// de prueba del staff (solo admin).
func Register(api huma.API, db database.DB, sender Sender) {
	admin := authz.RequireStaff(api, db, "admin")

	huma.Register(api, huma.Operation{
		OperationID: "push-registrar-token",
		Method:      http.MethodPut,
		Path:        "/api/v1/dispositivos/{installId}/push-token",
		Summary:     "Registrar o rotar el token push de mi dispositivo",
		Description: "Asocia el token FCM a mi dispositivo activo. Repetirlo con el mismo token " +
			"es idempotente; un token nuevo sustituye al anterior del dispositivo. Rechaza " +
			"(409) un token que ya pertenece a otro usuario y dispositivos revocados. " +
			"El token nunca se devuelve.",
		Tags:     []string{"push"},
		Security: []map[string][]string{{"bearer": {}}},
	}, registrarToken(db))

	huma.Register(api, huma.Operation{
		OperationID: "push-revocar-token",
		Method:      http.MethodDelete,
		Path:        "/api/v1/dispositivos/{installId}/push-token",
		Summary:     "Revocar el token push de mi dispositivo",
		Description: "Deja de enviar notificaciones a mi dispositivo (p. ej. al cerrar sesión). " +
			"Idempotente: devuelve cuántos tokens activos se revocaron.",
		Tags:     []string{"push"},
		Security: []map[string][]string{{"bearer": {}}},
	}, revocarToken(db))

	huma.Register(api, huma.Operation{
		OperationID: "staff-push-prueba",
		Method:      http.MethodPost,
		Path:        "/api/v1/staff/push/prueba",
		Summary:     "Enviar notificación de prueba (admin)",
		Description: "Envía una notificación a todos los tokens activos de un usuario. " +
			"Responde 503 si FCM no está configurado y 409 si el usuario no tiene tokens " +
			"activos. Los tokens que FCM rechaza se revocan. Queda registrado en auditoría.",
		Tags:        []string{"staff", "push"},
		Security:    []map[string][]string{{"bearer": {}}},
		Middlewares: []func(huma.Context, func(huma.Context)){admin},
	}, pruebaStaff(db, sender))
}

// ── Endpoints propios ──────────────────────────────────────────────────────

type registrarTokenInput struct {
	InstallID string `path:"installId" minLength:"8" maxLength:"128" doc:"install_id del dispositivo"`
	Body      struct {
		Token string `json:"token" minLength:"32" maxLength:"4096" doc:"Token de registro FCM del cliente"`
	}
}

type registrarTokenOutput struct {
	Body struct {
		InstallID string `json:"install_id"`
		Estado    string `json:"estado" doc:"activo"`
		Rotado    bool   `json:"rotado" doc:"true si sustituyó un token anterior del dispositivo"`
	}
}

func registrarToken(db database.DB) func(context.Context, *registrarTokenInput) (*registrarTokenOutput, error) {
	return func(ctx context.Context, in *registrarTokenInput) (*registrarTokenOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}

		var deviceID string
		var revokedAt *string
		err := db.QueryRow(ctx,
			`select id::text, revoked_at::text from devices where user_id = $1 and install_id = $2`,
			claims.Subject, in.InstallID).Scan(&deviceID, &revokedAt)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("dispositivo no encontrado")
		}
		if err != nil {
			return nil, apierr.Internal("error consultando el dispositivo", err)
		}
		if revokedAt != nil {
			return nil, huma.Error409Conflict("el dispositivo fue revocado; no admite tokens push")
		}

		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, apierr.Internal("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)

		// Como máximo un token activo por dispositivo: primero se revoca el
		// anterior (el índice único parcial exige que no coexistan), todo en la
		// misma transacción. Si el token pertenece a otro usuario, el 409 hace
		// rollback de la revocación.
		rotacion, err := tx.Exec(ctx, `
			update push_tokens set revoked_at = now(), revoked_reason = 'token reemplazado'
			where device_id = $1 and token <> $2 and revoked_at is null`, deviceID, in.Body.Token)
		if err != nil {
			return nil, apierr.Internal("error sustituyendo el token anterior", err)
		}

		// Un token pertenece a un único usuario: el upsert solo reasigna si el
		// token ya era de este mismo usuario (si no, no devuelve filas).
		err = tx.QueryRow(ctx, `
			insert into push_tokens (user_id, device_id, token)
			values ($1, $2, $3)
			on conflict (token) do update set
			  device_id      = excluded.device_id,
			  last_seen_at   = now(),
			  revoked_at     = null,
			  revoked_reason = null
			where push_tokens.user_id = excluded.user_id
			returning id::text`,
			claims.Subject, deviceID, in.Body.Token).Scan(new(string))
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error409Conflict("el token ya está registrado por otro usuario")
		}
		if err != nil {
			return nil, apierr.Internal("error registrando el token push", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, apierr.Internal("error confirmando la transacción", err)
		}

		out := &registrarTokenOutput{}
		out.Body.InstallID = in.InstallID
		out.Body.Estado = "activo"
		out.Body.Rotado = rotacion.RowsAffected() > 0
		return out, nil
	}
}

type revocarTokenInput struct {
	InstallID string `path:"installId" minLength:"8" maxLength:"128" doc:"install_id del dispositivo"`
}

type revocarTokenOutput struct {
	Body struct {
		InstallID string `json:"install_id"`
		Revocados int64  `json:"revocados"`
	}
}

func revocarToken(db database.DB) func(context.Context, *revocarTokenInput) (*revocarTokenOutput, error) {
	return func(ctx context.Context, in *revocarTokenInput) (*revocarTokenOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}
		tag, err := db.Exec(ctx, `
			update push_tokens pt
			set revoked_at = now(), revoked_reason = 'revocado por el usuario'
			from devices d
			where d.id = pt.device_id and d.user_id = $1 and d.install_id = $2
			  and pt.revoked_at is null`, claims.Subject, in.InstallID)
		if err != nil {
			return nil, apierr.Internal("error revocando el token push", err)
		}
		out := &revocarTokenOutput{}
		out.Body.InstallID = in.InstallID
		out.Body.Revocados = tag.RowsAffected()
		return out, nil
	}
}

// ── Envío de prueba (staff) ────────────────────────────────────────────────

type pruebaInput struct {
	Body struct {
		UsuarioID string `json:"usuario_id" format:"uuid" doc:"Usuario destinatario"`
		Titulo    string `json:"titulo" minLength:"1" maxLength:"80"`
		Cuerpo    string `json:"cuerpo" minLength:"1" maxLength:"240"`
	}
}

type pruebaOutput struct {
	Body struct {
		UsuarioID   string `json:"usuario_id"`
		Enviados    int    `json:"enviados"`
		Fallidos    int    `json:"fallidos" doc:"Errores transitorios; el token sigue activo"`
		Invalidados int    `json:"invalidados" doc:"Tokens que FCM rechazó y que se revocaron"`
	}
}

func pruebaStaff(db database.DB, sender Sender) func(context.Context, *pruebaInput) (*pruebaOutput, error) {
	return func(ctx context.Context, in *pruebaInput) (*pruebaOutput, error) {
		claims, _ := auth.ClaimsFromContext(ctx)

		if !sender.Configured() {
			return nil, huma.Error503ServiceUnavailable("FCM no configurado en este entorno")
		}

		rows, err := db.Query(ctx, `
			select id::text, token from push_tokens
			where user_id = $1 and revoked_at is null`, in.Body.UsuarioID)
		if err != nil {
			return nil, apierr.Internal("error consultando tokens push", err)
		}
		type tokenActivo struct{ id, token string }
		var tokens []tokenActivo
		for rows.Next() {
			var t tokenActivo
			if err := rows.Scan(&t.id, &t.token); err != nil {
				rows.Close()
				return nil, apierr.Internal("error leyendo tokens push", err)
			}
			tokens = append(tokens, t)
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			return nil, apierr.Internal("error leyendo tokens push", err)
		}
		if len(tokens) == 0 {
			return nil, huma.Error409Conflict("el usuario no tiene tokens push activos")
		}

		msg := Message{Title: in.Body.Titulo, Body: in.Body.Cuerpo, Data: map[string]string{"tipo": "prueba"}}
		out := &pruebaOutput{}
		out.Body.UsuarioID = in.Body.UsuarioID
		for _, t := range tokens {
			err := sender.Send(ctx, t.token, msg)
			switch {
			case err == nil:
				out.Body.Enviados++
			case errors.Is(err, ErrTokenInvalid):
				out.Body.Invalidados++
				if _, rerr := db.Exec(ctx, `
					update push_tokens set revoked_at = now(), revoked_reason = 'token rechazado por FCM'
					where id = $1 and revoked_at is null`, t.id); rerr != nil {
					slog.Error("no se pudo revocar token push rechazado", "token_id", t.id, "error", rerr)
				}
			default:
				out.Body.Fallidos++
				slog.Warn("error enviando notificación push", "token_id", t.id, "error", err)
			}
		}

		if _, err := db.Exec(ctx, `
			insert into audit_events (actor_id, action, entity_type, entity_id, metadata)
			values ($1, 'push.prueba', 'user', $2, $3)`,
			claims.Subject, in.Body.UsuarioID, map[string]any{
				"enviados":    out.Body.Enviados,
				"fallidos":    out.Body.Fallidos,
				"invalidados": out.Body.Invalidados,
			}); err != nil {
			return nil, apierr.Internal("error registrando auditoría", err)
		}
		return out, nil
	}
}
