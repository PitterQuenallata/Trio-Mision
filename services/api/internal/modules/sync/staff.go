package sync

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"
	"triomision/api/internal/apierr"

	"triomision/api/internal/auth"
	"triomision/api/internal/authz"
	"triomision/api/internal/database"
)

// registerStaff registra los endpoints de operación staff de las licencias
// offline (admin/vendedor; editor → 403). La revocación comparte transacción
// con su auditoría.
func registerStaff(api huma.API, db database.DB) {
	staff := authz.RequireStaff(api, db, "admin", "vendedor")

	huma.Register(api, huma.Operation{
		OperationID: "staff-listar-descargas-offline",
		Method:      http.MethodGet,
		Path:        "/api/v1/staff/descargas-offline",
		Summary:     "Listar licencias de descarga offline",
		Description: "Licencias offline concedidas con su usuario, dispositivo, pista, origen y vencimiento. " +
			"Filtros opcionales por usuario (UUID) y dispositivo (UUID interno).",
		Tags:        []string{"staff"},
		Security:    []map[string][]string{{"bearer": {}}},
		Middlewares: []func(huma.Context, func(huma.Context)){staff},
	}, listarDescargasStaff(db))

	huma.Register(api, huma.Operation{
		OperationID: "staff-revocar-descarga-offline",
		Method:      http.MethodPost,
		Path:        "/api/v1/staff/descargas-offline/{id}/revocar",
		Summary:     "Revocar una licencia offline",
		Description: "Marca la licencia como revocada con motivo y auditoría (descarga_offline.revocada). " +
			"Idempotente si ya estaba revocada.",
		Tags:        []string{"staff"},
		Security:    []map[string][]string{{"bearer": {}}},
		Middlewares: []func(huma.Context, func(huma.Context)){staff},
	}, revocarDescargaStaff(db))
}

type descargaStaffItem struct {
	ID          string     `json:"id"`
	UsuarioID   string     `json:"usuario_id"`
	UsuarioMail string     `json:"usuario_email"`
	DeviceID    string     `json:"device_id"`
	InstallID   string     `json:"install_id"`
	PistaID     string     `json:"pista_id"`
	PistaTitulo string     `json:"pista_titulo"`
	Origen      string     `json:"origen" doc:"entitlement | premium"`
	ConcedidaEn time.Time  `json:"concedida_en"`
	ExpiraEn    time.Time  `json:"expira_en"`
	ActividadEn *time.Time `json:"actividad_en,omitempty"`
	RevocadaEn  *time.Time `json:"revocada_en,omitempty"`
	Estado      string     `json:"estado" doc:"vigente | revocada | vencida"`
}

type listarDescargasStaffInput struct {
	Usuario     string `query:"usuario" required:"false" format:"uuid" doc:"Filtro opcional por UUID de usuario"`
	Dispositivo string `query:"dispositivo" required:"false" format:"uuid" doc:"Filtro opcional por UUID interno del dispositivo"`
}

type listarDescargasStaffOutput struct {
	Body struct {
		Descargas []descargaStaffItem `json:"descargas"`
	}
}

func listarDescargasStaff(db database.DB) func(ctx context.Context, in *listarDescargasStaffInput) (*listarDescargasStaffOutput, error) {
	return func(ctx context.Context, in *listarDescargasStaffInput) (*listarDescargasStaffOutput, error) {
		where := []string{}
		args := []any{}
		if in.Usuario != "" {
			args = append(args, in.Usuario)
			where = append(where, "od.user_id = $"+itoa(len(args)))
		}
		if in.Dispositivo != "" {
			args = append(args, in.Dispositivo)
			where = append(where, "od.device_id = $"+itoa(len(args)))
		}
		whereClause := ""
		if len(where) > 0 {
			whereClause = "where " + join(where, " and ")
		}

		out := &listarDescargasStaffOutput{}
		out.Body.Descargas = []descargaStaffItem{}
		rows, err := db.Query(ctx, `
			select od.id, od.user_id, coalesce(p.email, ''), od.device_id, d.install_id,
			       od.track_id, t.title, od.origen, od.granted_at, od.expires_at,
			       od.last_seen_at, od.revoked_at
			from offline_downloads od
			join devices d on d.id = od.device_id
			join tracks t on t.id = od.track_id
			left join profiles p on p.id = od.user_id
			`+whereClause+`
			order by od.granted_at desc limit 200`, args...)
		if err != nil {
			return nil, apierr.Internal("error consultando las licencias offline", err)
		}
		defer rows.Close()
		for rows.Next() {
			var (
				item      descargaStaffItem
				actividad *time.Time
			)
			if err := rows.Scan(&item.ID, &item.UsuarioID, &item.UsuarioMail, &item.DeviceID,
				&item.InstallID, &item.PistaID, &item.PistaTitulo, &item.Origen, &item.ConcedidaEn,
				&item.ExpiraEn, &actividad, &item.RevocadaEn); err != nil {
				return nil, apierr.Internal("error leyendo las licencias offline", err)
			}
			item.ActividadEn = actividad
			item.Estado = estadoDescarga(item.RevocadaEn, item.ExpiraEn)
			out.Body.Descargas = append(out.Body.Descargas, item)
		}
		if err := rows.Err(); err != nil {
			return nil, apierr.Internal("error leyendo las licencias offline", err)
		}
		return out, nil
	}
}

type revocarDescargaInput struct {
	ID   string `path:"id" format:"uuid" doc:"ID de la licencia offline"`
	Body struct {
		Motivo string `json:"motivo" minLength:"3" maxLength:"300"`
	}
}

type revocarDescargaOutput struct {
	Body struct {
		ID         string    `json:"id"`
		Estado     string    `json:"estado" doc:"revocada"`
		RevocadoEn time.Time `json:"revocado_en"`
	}
}

func revocarDescargaStaff(db database.DB) func(ctx context.Context, in *revocarDescargaInput) (*revocarDescargaOutput, error) {
	return func(ctx context.Context, in *revocarDescargaInput) (*revocarDescargaOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}

		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, apierr.Internal("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)

		var (
			revocadoEn time.Time
			userID     string
			trackID    string
		)
		err = tx.QueryRow(ctx, `
			update offline_downloads
			set revoked_at = coalesce(revoked_at, now()), revoked_reason = $2
			where id = $1
			returning revoked_at, user_id, track_id`, in.ID, in.Body.Motivo,
		).Scan(&revocadoEn, &userID, &trackID)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("licencia offline no encontrada")
		}
		if err != nil {
			return nil, apierr.Internal("error revocando la licencia offline", err)
		}
		if err := registrarAuditoria(ctx, tx, claims.Subject, "descarga_offline.revocada", "offline_download", in.ID,
			map[string]any{"motivo": in.Body.Motivo, "usuario_id": userID, "pista_id": trackID}); err != nil {
			return nil, apierr.Internal("error registrando auditoría", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, apierr.Internal("error confirmando la transacción", err)
		}

		out := &revocarDescargaOutput{}
		out.Body.ID = in.ID
		out.Body.Estado = "revocada"
		out.Body.RevocadoEn = revocadoEn
		return out, nil
	}
}

func itoa(n int) string {
	return strconv.Itoa(n)
}

func join(partes []string, sep string) string {
	out := ""
	for i, p := range partes {
		if i > 0 {
			out += sep
		}
		out += p
	}
	return out
}

// registrarAuditoria inserta un evento de auditoría (usa la tx activa si hay).
func registrarAuditoria(ctx context.Context, q database.Querier, actorID, action, entityType, entityID string, metadata map[string]any) error {
	_, err := q.Exec(ctx, `
		insert into audit_events (actor_id, action, entity_type, entity_id, metadata)
		values ($1, $2, $3, $4, $5)`, actorID, action, entityType, entityID, metadata)
	return err
}
