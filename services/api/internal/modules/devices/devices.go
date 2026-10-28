// Package devices implementa el registro de dispositivos de los clientes
// (APK, PC, web): alta/actualización de instalación, lista propia, heartbeat
// y revocación, además de consulta y revocación staff con auditoría. No se
// guardan refresh tokens ni secretos; el ciclo de vida sigue al sync (Fase 4),
// donde los dispositivos atarán licencias offline y tokens push.
package devices

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"

	"triomision/api/internal/auth"
	"triomision/api/internal/authz"
	"triomision/api/internal/database"
)

// Register registra los endpoints de dispositivos del propio usuario y los de
// consulta/revocación del staff.
func Register(api huma.API, db database.DB) {
	staff := authz.RequireStaff(api, db, "admin", "vendedor")

	huma.Register(api, huma.Operation{
		OperationID: "dispositivos-registrar",
		Method:      http.MethodPut,
		Path:        "/api/v1/dispositivos",
		Summary:     "Registrar o actualizar mi dispositivo",
		Description: "Alta (o refresco) de una instalación del cliente: install_id estable por " +
			"instalación, plataforma, versión de app y nombre. Actualiza última actividad. " +
			"Un dispositivo revocado no se reactiva: el cliente genera un install_id nuevo.",
		Tags:     []string{"dispositivos"},
		Security: []map[string][]string{{"bearer": {}}},
	}, registrar(db))

	huma.Register(api, huma.Operation{
		OperationID: "dispositivos-listar",
		Method:      http.MethodGet,
		Path:        "/api/v1/dispositivos",
		Summary:     "Mis dispositivos",
		Description: "Lista los dispositivos registrados por el usuario autenticado, con su estado.",
		Tags:        []string{"dispositivos"},
		Security:    []map[string][]string{{"bearer": {}}},
	}, listar(db))

	huma.Register(api, huma.Operation{
		OperationID: "dispositivos-heartbeat",
		Method:      http.MethodPost,
		Path:        "/api/v1/dispositivos/{installId}/heartbeat",
		Summary:     "Heartbeat de mi dispositivo",
		Description: "Marca actividad del dispositivo (actualiza última actividad y, si se envía, la versión de app).",
		Tags:        []string{"dispositivos"},
		Security:    []map[string][]string{{"bearer": {}}},
	}, heartbeat(db))

	huma.Register(api, huma.Operation{
		OperationID: "dispositivos-revocar",
		Method:      http.MethodPost,
		Path:        "/api/v1/dispositivos/{installId}/revocar",
		Summary:     "Revocar mi dispositivo",
		Description: "Marca el dispositivo como revocado (p. ej. cierre de sesión en ese equipo). " +
			"Idempotente: repetir la revocación devuelve el estado actual.",
		Tags:     []string{"dispositivos"},
		Security: []map[string][]string{{"bearer": {}}},
	}, revocar(db))

	huma.Register(api, huma.Operation{
		OperationID: "staff-listar-dispositivos",
		Method:      http.MethodGet,
		Path:        "/api/v1/staff/dispositivos",
		Summary:     "Listar dispositivos (staff)",
		Description: "Dispositivos registrados con su estado y última actividad. " +
			"Filtro opcional por usuario (UUID).",
		Tags:        []string{"staff", "dispositivos"},
		Security:    []map[string][]string{{"bearer": {}}},
		Middlewares: []func(huma.Context, func(huma.Context)){staff},
	}, listarStaff(db))

	huma.Register(api, huma.Operation{
		OperationID: "staff-revocar-dispositivo",
		Method:      http.MethodPost,
		Path:        "/api/v1/staff/dispositivos/{id}/revocar",
		Summary:     "Revocar un dispositivo (staff)",
		Description: "Revoca el dispositivo de un usuario con motivo y auditoría. " +
			"Idempotente si ya estaba revocado.",
		Tags:        []string{"staff", "dispositivos"},
		Security:    []map[string][]string{{"bearer": {}}},
		Middlewares: []func(huma.Context, func(huma.Context)){staff},
	}, revocarStaff(db))
}

// ── Tipos de respuesta ─────────────────────────────────────────────────────

type dispositivoItem struct {
	ID            string     `json:"id"`
	InstallID     string     `json:"install_id"`
	Platform      string     `json:"platform" doc:"android | ios | windows | macos | linux | web"`
	AppVersion    string     `json:"app_version"`
	DeviceName    string     `json:"device_name,omitempty"`
	Estado        string     `json:"estado" doc:"activo | revocado"`
	FirstSeenAt   time.Time  `json:"first_seen_at" doc:"Primera actividad (registro)"`
	LastSeenAt    time.Time  `json:"last_seen_at" doc:"Última actividad (heartbeat)"`
	RevokedAt     *time.Time `json:"revoked_at,omitempty"`
	RevokedReason string     `json:"revoked_reason,omitempty"`
}

func estadoDispositivo(revokedAt *time.Time) string {
	if revokedAt != nil {
		return "revocado"
	}
	return "activo"
}

// ── Endpoints propios ──────────────────────────────────────────────────────

type registrarInput struct {
	Body struct {
		InstallID  string `json:"install_id" minLength:"8" maxLength:"128" doc:"Identificador estable de instalación (generado por el cliente)"`
		Platform   string `json:"platform" enum:"android,ios,windows,macos,linux,web"`
		AppVersion string `json:"app_version" minLength:"1" maxLength:"40"`
		DeviceName string `json:"device_name,omitempty" maxLength:"120"`
	}
}

type registrarOutput struct {
	Body dispositivoItem
}

// registrar hace upsert de la instalación del usuario: la primera vez crea el
// registro; después actualiza actividad, versión de app y nombre. Un
// dispositivo revocado no se reactiva (409): la reinstala con otro install_id.
func registrar(db database.DB) func(context.Context, *registrarInput) (*registrarOutput, error) {
	return func(ctx context.Context, in *registrarInput) (*registrarOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}

		// El perfil debe existir por la FK de devices.user_id.
		if _, err := db.Exec(ctx,
			`insert into profiles (id, email) values ($1, $2) on conflict (id) do nothing`,
			claims.Subject, claims.Email); err != nil {
			return nil, huma.Error500InternalServerError("error asegurando el perfil", err)
		}

		var revokedAt *time.Time
		err := db.QueryRow(ctx,
			`select revoked_at from devices where user_id = $1 and install_id = $2`,
			claims.Subject, in.Body.InstallID).Scan(&revokedAt)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error500InternalServerError("error consultando el dispositivo", err)
		}
		if err == nil && revokedAt != nil {
			return nil, huma.Error409Conflict("este dispositivo fue revocado; genera un nuevo install_id")
		}

		out := &registrarOutput{}
		err = db.QueryRow(ctx, `
			insert into devices (user_id, install_id, platform, app_version, device_name)
			values ($1, $2, $3, $4, $5)
			on conflict (user_id, install_id) do update set
			  last_seen_at = now(),
			  app_version  = excluded.app_version,
			  device_name  = excluded.device_name
			returning id, install_id, platform, app_version, coalesce(device_name, ''),
			          first_seen_at, last_seen_at, revoked_at, coalesce(revoked_reason, '')`,
			claims.Subject, in.Body.InstallID, in.Body.Platform, in.Body.AppVersion, in.Body.DeviceName,
		).Scan(&out.Body.ID, &out.Body.InstallID, &out.Body.Platform, &out.Body.AppVersion,
			&out.Body.DeviceName, &out.Body.FirstSeenAt, &out.Body.LastSeenAt,
			&out.Body.RevokedAt, &out.Body.RevokedReason)
		if err != nil {
			return nil, huma.Error500InternalServerError("error registrando el dispositivo", err)
		}
		out.Body.Estado = estadoDispositivo(out.Body.RevokedAt)
		return out, nil
	}
}

type listarOutput struct {
	Body struct {
		Dispositivos []dispositivoItem `json:"dispositivos"`
	}
}

func listar(db database.DB) func(context.Context, *struct{}) (*listarOutput, error) {
	return func(ctx context.Context, _ *struct{}) (*listarOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}
		rows, err := db.Query(ctx, `
			select id, install_id, platform, app_version, coalesce(device_name, ''),
			       first_seen_at, last_seen_at, revoked_at, coalesce(revoked_reason, '')
			from devices where user_id = $1
			order by last_seen_at desc`, claims.Subject)
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando tus dispositivos", err)
		}
		defer rows.Close()

		out := &listarOutput{}
		out.Body.Dispositivos = []dispositivoItem{}
		for rows.Next() {
			var d dispositivoItem
			if err := rows.Scan(&d.ID, &d.InstallID, &d.Platform, &d.AppVersion, &d.DeviceName,
				&d.FirstSeenAt, &d.LastSeenAt, &d.RevokedAt, &d.RevokedReason); err != nil {
				return nil, huma.Error500InternalServerError("error leyendo tus dispositivos", err)
			}
			d.Estado = estadoDispositivo(d.RevokedAt)
			out.Body.Dispositivos = append(out.Body.Dispositivos, d)
		}
		if err := rows.Err(); err != nil {
			return nil, huma.Error500InternalServerError("error leyendo tus dispositivos", err)
		}
		return out, nil
	}
}

type heartbeatInput struct {
	InstallID string `path:"installId" doc:"Identificador de instalación"`
	Body      struct {
		AppVersion string `json:"app_version,omitempty" minLength:"1" maxLength:"40"`
	}
}

type heartbeatOutput struct {
	Body struct {
		InstallID  string    `json:"install_id"`
		LastSeenAt time.Time `json:"last_seen_at"`
	}
}

func heartbeat(db database.DB) func(context.Context, *heartbeatInput) (*heartbeatOutput, error) {
	return func(ctx context.Context, in *heartbeatInput) (*heartbeatOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}
		var lastSeen time.Time
		err := db.QueryRow(ctx, `
			update devices
			set last_seen_at = now(),
			    app_version = coalesce($3, app_version)
			where user_id = $1 and install_id = $2 and revoked_at is null
			returning last_seen_at`,
			claims.Subject, in.InstallID, in.Body.AppVersion,
		).Scan(&lastSeen)
		if errors.Is(err, pgx.ErrNoRows) {
			var revoked bool
			checkErr := db.QueryRow(ctx, `
				select revoked_at is not null from devices
				where user_id = $1 and install_id = $2`, claims.Subject, in.InstallID).Scan(&revoked)
			if checkErr == nil && revoked {
				return nil, huma.Error409Conflict("el dispositivo está revocado")
			}
			if checkErr != nil && !errors.Is(checkErr, pgx.ErrNoRows) {
				return nil, huma.Error500InternalServerError("error consultando el dispositivo", checkErr)
			}
			return nil, huma.Error404NotFound("dispositivo no encontrado")
		}
		if err != nil {
			return nil, huma.Error500InternalServerError("error actualizando el dispositivo", err)
		}
		out := &heartbeatOutput{}
		out.Body.InstallID = in.InstallID
		out.Body.LastSeenAt = lastSeen
		return out, nil
	}
}

type revocarInput struct {
	InstallID string `path:"installId" doc:"Identificador de instalación"`
	Body      struct {
		Motivo string `json:"motivo,omitempty" maxLength:"300"`
	}
}

type revocarOutput struct {
	Body struct {
		InstallID string    `json:"install_id"`
		Estado    string    `json:"estado" doc:"revocado"`
		RevokedAt time.Time `json:"revoked_at"`
	}
}

func revocar(db database.DB) func(context.Context, *revocarInput) (*revocarOutput, error) {
	return func(ctx context.Context, in *revocarInput) (*revocarOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}
		var revokedAt time.Time
		err := db.QueryRow(ctx, `
			update devices
			set revoked_at = coalesce(revoked_at, now()), revoked_reason = coalesce($3, revoked_reason)
			where user_id = $1 and install_id = $2
			returning revoked_at`,
			claims.Subject, in.InstallID, in.Body.Motivo,
		).Scan(&revokedAt)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("dispositivo no encontrado")
		}
		if err != nil {
			return nil, huma.Error500InternalServerError("error revocando el dispositivo", err)
		}
		out := &revocarOutput{}
		out.Body.InstallID = in.InstallID
		out.Body.Estado = "revocado"
		out.Body.RevokedAt = revokedAt
		return out, nil
	}
}

// ── Endpoints staff ────────────────────────────────────────────────────────

type listarStaffInput struct {
	Usuario string `query:"usuario" required:"false" format:"uuid" doc:"Filtro opcional por UUID de usuario"`
}

type listarStaffOutput struct {
	Body struct {
		Dispositivos []dispositivoItem `json:"dispositivos"`
	}
}

func listarStaff(db database.DB) func(context.Context, *listarStaffInput) (*listarStaffOutput, error) {
	return func(ctx context.Context, in *listarStaffInput) (*listarStaffOutput, error) {
		where, args := "", []any{}
		if in.Usuario != "" {
			args = append(args, in.Usuario)
			where = "where d.user_id = $1"
		}
		rows, err := db.Query(ctx, `
			select d.id, d.install_id, d.platform, d.app_version, coalesce(d.device_name, ''),
			       d.first_seen_at, d.last_seen_at, d.revoked_at, coalesce(d.revoked_reason, '')
			from devices d `+where+`
			order by d.last_seen_at desc limit 200`, args...)
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando los dispositivos", err)
		}
		defer rows.Close()

		out := &listarStaffOutput{}
		out.Body.Dispositivos = []dispositivoItem{}
		for rows.Next() {
			var d dispositivoItem
			if err := rows.Scan(&d.ID, &d.InstallID, &d.Platform, &d.AppVersion, &d.DeviceName,
				&d.FirstSeenAt, &d.LastSeenAt, &d.RevokedAt, &d.RevokedReason); err != nil {
				return nil, huma.Error500InternalServerError("error leyendo los dispositivos", err)
			}
			d.Estado = estadoDispositivo(d.RevokedAt)
			out.Body.Dispositivos = append(out.Body.Dispositivos, d)
		}
		if err := rows.Err(); err != nil {
			return nil, huma.Error500InternalServerError("error leyendo los dispositivos", err)
		}
		return out, nil
	}
}

type revocarStaffInput struct {
	ID   string `path:"id" format:"uuid" doc:"ID del dispositivo"`
	Body struct {
		Motivo string `json:"motivo" minLength:"3" maxLength:"300"`
	}
}

type revocarStaffOutput struct {
	Body struct {
		ID        string    `json:"id"`
		Estado    string    `json:"estado" doc:"revocado"`
		RevokedAt time.Time `json:"revoked_at"`
	}
}

func revocarStaff(db database.DB) func(context.Context, *revocarStaffInput) (*revocarStaffOutput, error) {
	return func(ctx context.Context, in *revocarStaffInput) (*revocarStaffOutput, error) {
		claims, _ := auth.ClaimsFromContext(ctx)
		var revokedAt time.Time
		var userID string
		err := db.QueryRow(ctx, `
			update devices
			set revoked_at = coalesce(revoked_at, now()), revoked_reason = $2
			where id = $1
			returning revoked_at, user_id`, in.ID, in.Body.Motivo,
		).Scan(&revokedAt, &userID)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("dispositivo no encontrado")
		}
		if err != nil {
			return nil, huma.Error500InternalServerError("error revocando el dispositivo", err)
		}
		if err := registrarAuditoria(ctx, db, claims.Subject, "dispositivo.revocado", "device", in.ID,
			map[string]any{"usuario_id": userID, "motivo": in.Body.Motivo}); err != nil {
			return nil, huma.Error500InternalServerError("error registrando auditoría", err)
		}
		out := &revocarStaffOutput{}
		out.Body.ID = in.ID
		out.Body.Estado = "revocado"
		out.Body.RevokedAt = revokedAt
		return out, nil
	}
}

// registrarAuditoria inserta un evento de auditoría de operación staff.
func registrarAuditoria(ctx context.Context, q database.Querier, actorID, action, entityType, entityID string, metadata map[string]any) error {
	_, err := q.Exec(ctx, `
		insert into audit_events (actor_id, action, entity_type, entity_id, metadata)
		values ($1, $2, $3, $4, $5)`, actorID, action, entityType, entityID, metadata)
	return err
}
