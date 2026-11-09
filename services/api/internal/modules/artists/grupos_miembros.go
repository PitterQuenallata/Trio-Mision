package artists

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"triomision/api/internal/apierr"
	"triomision/api/internal/auth"
	"triomision/api/internal/authz"
	"triomision/api/internal/database"
)

// RegisterMiembrosGrupo registra la gestión de vinculados de un grupo (solo admin):
// vincular, cambiar rol o activar/desactivar y desvincular. Un grupo debe
// conservar al menos un manager activo; la comprobación se hace bajo bloqueo del grupo.
func RegisterMiembrosGrupo(api huma.API, db database.DB) {
	admin := authz.RequireStaff(api, db, "admin")
	seguridad := []map[string][]string{{"bearer": {}}}

	huma.Register(api, huma.Operation{
		OperationID:   "staff-vincular-miembro",
		Method:        http.MethodPost,
		Path:          "/api/v1/staff/grupos/{id}/miembros",
		Summary:       "Vincular un usuario al grupo (admin)",
		Description:   "Añade a un usuario existente como member o manager del grupo. 409 si ya está vinculado (cámbialo con PATCH).",
		Tags:          []string{"staff", "grupos"},
		Security:      seguridad,
		Middlewares:   []func(huma.Context, func(huma.Context)){admin},
		DefaultStatus: http.StatusCreated,
	}, vincularMiembro(db))

	huma.Register(api, huma.Operation{
		OperationID: "staff-actualizar-miembro",
		Method:      http.MethodPatch,
		Path:        "/api/v1/staff/grupos/{id}/miembros/{userId}",
		Summary:     "Cambiar rol o activar/desactivar un vinculado (admin)",
		Description: "Cambia el rol (member/manager) o el estado del vínculo. Un desactivado no tiene acceso pero conserva su membresía. El grupo debe conservar al menos un manager activo.",
		Tags:        []string{"staff", "grupos"},
		Security:    seguridad,
		Middlewares: []func(huma.Context, func(huma.Context)){admin},
	}, actualizarMiembro(db))

	huma.Register(api, huma.Operation{
		OperationID: "staff-desvincular-miembro",
		Method:      http.MethodDelete,
		Path:        "/api/v1/staff/grupos/{id}/miembros/{userId}",
		Summary:     "Desvincular un usuario del grupo (admin)",
		Description: "Quita la membresía. Si es el último manager activo del grupo, responde 409.",
		Tags:        []string{"staff", "grupos"},
		Security:    seguridad,
		Middlewares: []func(huma.Context, func(huma.Context)){admin},
	}, desvincularMiembro(db))
}

// managersActivosSinUsuario cuenta los managers activos del grupo, excluyendo a un usuario.
func managersActivosSinUsuario(ctx context.Context, tx pgx.Tx, grupoID, userID string) (int, error) {
	var n int
	err := tx.QueryRow(ctx, `
		select count(*) from artist_members
		where artist_id = $1 and member_role = 'manager' and activo and user_id <> $2`,
		grupoID, userID).Scan(&n)
	return n, err
}

// bloquearGrupo serializa los cambios de vínculos de un grupo.
func bloquearGrupo(ctx context.Context, tx pgx.Tx, id string) error {
	_, err := tx.Exec(ctx, `select 1 from artists where id = $1 for update`, id)
	return err
}

type vincularMiembroInput struct {
	ID   string `path:"id" format:"uuid" doc:"ID del grupo"`
	Body struct {
		UserID string `json:"user_id" format:"uuid" doc:"ID del usuario (debe haber iniciado sesión al menos una vez)"`
		Rol    string `json:"rol" enum:"member,manager" doc:"Rol en el grupo"`
	}
}

type miembroOutput struct {
	Body struct {
		GrupoID string `json:"grupo_id"`
		UserID  string `json:"user_id"`
		Rol     string `json:"rol"`
		Activo  bool   `json:"activo"`
	}
}

func vincularMiembro(db database.DB) func(context.Context, *vincularMiembroInput) (*miembroOutput, error) {
	return func(ctx context.Context, in *vincularMiembroInput) (*miembroOutput, error) {
		claims, _ := auth.ClaimsFromContext(ctx)
		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, apierr.Internal("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)

		if err := bloquearGrupo(ctx, tx, in.ID); err != nil {
			return nil, apierr.Internal("error bloqueando el grupo", err)
		}
		if _, err := tx.Exec(ctx, `
			insert into artist_members (artist_id, user_id, member_role, activo)
			values ($1, $2, $3, true)`, in.ID, in.Body.UserID, in.Body.Rol); err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) {
				switch pgErr.Code {
				case "23505":
					return nil, huma.Error409Conflict("el usuario ya está vinculado a este grupo; cámbialo con PATCH")
				case "23503":
					return nil, huma.Error404NotFound("usuario o grupo no encontrado")
				}
			}
			return nil, apierr.Internal("error vinculando al usuario", err)
		}
		if err := registrarAuditoria(ctx, tx, claims.Subject, "miembro.vinculado", "artist_members", in.ID,
			map[string]any{"usuario_id": in.Body.UserID, "rol": in.Body.Rol}); err != nil {
			return nil, apierr.Internal("error registrando auditoría", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, apierr.Internal("error confirmando la vinculación", err)
		}
		out := &miembroOutput{}
		out.Body.GrupoID = in.ID
		out.Body.UserID = in.Body.UserID
		out.Body.Rol = in.Body.Rol
		out.Body.Activo = true
		return out, nil
	}
}

type vinculoInput struct {
	ID     string `path:"id" format:"uuid" doc:"ID del grupo"`
	UserID string `path:"userId" format:"uuid" doc:"ID del usuario"`
}

type actualizarMiembroInput struct {
	ID     string `path:"id" format:"uuid" doc:"ID del grupo"`
	UserID string `path:"userId" format:"uuid" doc:"ID del usuario"`
	Body   struct {
		Rol    *string `json:"rol,omitempty" enum:"member,manager" doc:"Nuevo rol"`
		Activo *bool   `json:"activo,omitempty" doc:"false desactiva el acceso; true lo reactiva"`
	}
}

func actualizarMiembro(db database.DB) func(context.Context, *actualizarMiembroInput) (*miembroOutput, error) {
	return func(ctx context.Context, in *actualizarMiembroInput) (*miembroOutput, error) {
		claims, _ := auth.ClaimsFromContext(ctx)
		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, apierr.Internal("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)

		if err := bloquearGrupo(ctx, tx, in.ID); err != nil {
			return nil, apierr.Internal("error bloqueando el grupo", err)
		}
		var rolActual string
		var activoActual bool
		err = tx.QueryRow(ctx, `
			select member_role, activo from artist_members where artist_id = $1 and user_id = $2 for update`,
			in.ID, in.UserID).Scan(&rolActual, &activoActual)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("el usuario no está vinculado a este grupo")
		}
		if err != nil {
			return nil, apierr.Internal("error consultando el vínculo", err)
		}

		rolNuevo, activoNuevo := rolActual, activoActual
		if in.Body.Rol != nil {
			rolNuevo = *in.Body.Rol
		}
		if in.Body.Activo != nil {
			activoNuevo = *in.Body.Activo
		}
		// Quitar el acceso de un manager activo exige que quede otro manager activo.
		if rolActual == "manager" && activoActual && (rolNuevo != "manager" || !activoNuevo) {
			otros, err := managersActivosSinUsuario(ctx, tx, in.ID, in.UserID)
			if err != nil {
				return nil, apierr.Internal("error contando managers", err)
			}
			if otros == 0 {
				return nil, huma.Error409Conflict("el grupo debe conservar al menos un manager activo")
			}
		}

		if _, err := tx.Exec(ctx, `
			update artist_members set member_role = $3, activo = $4
			where artist_id = $1 and user_id = $2`, in.ID, in.UserID, rolNuevo, activoNuevo); err != nil {
			return nil, apierr.Internal("error actualizando el vínculo", err)
		}
		if err := registrarAuditoria(ctx, tx, claims.Subject, "miembro.actualizado", "artist_members", in.ID,
			map[string]any{"usuario_id": in.UserID, "rol": rolNuevo, "activo": activoNuevo}); err != nil {
			return nil, apierr.Internal("error registrando auditoría", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, apierr.Internal("error confirmando el cambio", err)
		}
		out := &miembroOutput{}
		out.Body.GrupoID = in.ID
		out.Body.UserID = in.UserID
		out.Body.Rol = rolNuevo
		out.Body.Activo = activoNuevo
		return out, nil
	}
}

type desvincularOutput struct {
	Body struct {
		GrupoID      string    `json:"grupo_id"`
		UserID       string    `json:"user_id"`
		Desvinculado bool      `json:"desvinculado"`
		Momento      time.Time `json:"momento"`
	}
}

func desvincularMiembro(db database.DB) func(context.Context, *vinculoInput) (*desvincularOutput, error) {
	return func(ctx context.Context, in *vinculoInput) (*desvincularOutput, error) {
		claims, _ := auth.ClaimsFromContext(ctx)
		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, apierr.Internal("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)

		if err := bloquearGrupo(ctx, tx, in.ID); err != nil {
			return nil, apierr.Internal("error bloqueando el grupo", err)
		}
		var rol string
		var activo bool
		err = tx.QueryRow(ctx, `
			select member_role, activo from artist_members where artist_id = $1 and user_id = $2 for update`,
			in.ID, in.UserID).Scan(&rol, &activo)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("el usuario no está vinculado a este grupo")
		}
		if err != nil {
			return nil, apierr.Internal("error consultando el vínculo", err)
		}
		if rol == "manager" && activo {
			otros, err := managersActivosSinUsuario(ctx, tx, in.ID, in.UserID)
			if err != nil {
				return nil, apierr.Internal("error contando managers", err)
			}
			if otros == 0 {
				return nil, huma.Error409Conflict("el grupo debe conservar al menos un manager activo")
			}
		}
		if _, err := tx.Exec(ctx, `delete from artist_members where artist_id = $1 and user_id = $2`, in.ID, in.UserID); err != nil {
			return nil, apierr.Internal("error desvinculando al usuario", err)
		}
		if err := registrarAuditoria(ctx, tx, claims.Subject, "miembro.desvinculado", "artist_members", in.ID,
			map[string]any{"usuario_id": in.UserID, "rol": rol}); err != nil {
			return nil, apierr.Internal("error registrando auditoría", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, apierr.Internal("error confirmando la desvinculación", err)
		}
		out := &desvincularOutput{}
		out.Body.GrupoID = in.ID
		out.Body.UserID = in.UserID
		out.Body.Desvinculado = true
		out.Body.Momento = time.Now()
		return out, nil
	}
}
