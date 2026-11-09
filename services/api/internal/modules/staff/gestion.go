package staff

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5/pgconn"

	"triomision/api/internal/apierr"
	"triomision/api/internal/auth"
	"triomision/api/internal/authz"
	"triomision/api/internal/database"
	"triomision/api/internal/gotrueadmin"
)

// RegisterGestion registra la gestión de cuentas y roles. Solo admin: crear
// cuentas staff, asignar o quitar roles staff y añadir o quitar managers de
// un artista. Las reglas de negocio (último admin, rol válido, existencia)
// las aplican las funciones de la base (migración 00029).
func RegisterGestion(api huma.API, db database.DB, gt *gotrueadmin.Client) {
	admin := authz.RequireStaff(api, db, "admin")
	g := gestion{db: db, gt: gt}
	seguridad := []map[string][]string{{"bearer": {}}}

	huma.Register(api, huma.Operation{
		OperationID:   "staff-crear-usuario",
		Method:        http.MethodPost,
		Path:          "/api/v1/staff/usuarios",
		Summary:       "Crear una cuenta staff (admin)",
		Description:   "Crea la cuenta en GoTrue con correo confirmado y le asigna un rol staff. La contraseña inicial la entrega el administrador. Si el correo ya existe responde 409: usa PUT /api/v1/staff/usuarios/{id}/roles/{rol}.",
		Tags:          []string{"staff", "usuarios"},
		Security:      seguridad,
		Middlewares:   []func(huma.Context, func(huma.Context)){admin},
		DefaultStatus: http.StatusCreated,
	}, g.crearUsuario)

	huma.Register(api, huma.Operation{
		OperationID: "staff-asignar-rol",
		Method:      http.MethodPut,
		Path:        "/api/v1/staff/usuarios/{id}/roles/{rol}",
		Summary:     "Asignar un rol staff (admin)",
		Description: "Concede un rol staff (admin, editor o vendedor) a un usuario existente. Idempotente.",
		Tags:        []string{"staff", "usuarios"},
		Security:    seguridad,
		Middlewares: []func(huma.Context, func(huma.Context)){admin},
	}, g.cambiarRol(true))

	huma.Register(api, huma.Operation{
		OperationID: "staff-quitar-rol",
		Method:      http.MethodDelete,
		Path:        "/api/v1/staff/usuarios/{id}/roles/{rol}",
		Summary:     "Quitar un rol staff (admin)",
		Description: "Quita un rol staff a un usuario. No permite quitarte tu propio rol admin ni dejar el sistema sin admin. Idempotente.",
		Tags:        []string{"staff", "usuarios"},
		Security:    seguridad,
		Middlewares: []func(huma.Context, func(huma.Context)){admin},
	}, g.cambiarRol(false))

	huma.Register(api, huma.Operation{
		OperationID: "staff-asignar-manager",
		Method:      http.MethodPut,
		Path:        "/api/v1/staff/artistas/{artistId}/managers/{userId}",
		Summary:     "Añadir un manager a un artista (admin)",
		Description: "Vincula a un usuario como manager de un artista: podrá administrar ese artista en el panel. Un usuario tiene una sola membresía por artista: si ya era member, pasa a manager. Idempotente.",
		Tags:        []string{"staff", "artistas"},
		Security:    seguridad,
		Middlewares: []func(huma.Context, func(huma.Context)){admin},
	}, g.cambiarManager(true))

	huma.Register(api, huma.Operation{
		OperationID: "staff-quitar-manager",
		Method:      http.MethodDelete,
		Path:        "/api/v1/staff/artistas/{artistId}/managers/{userId}",
		Summary:     "Quitar un manager de un artista (admin)",
		Description: "Quita la membresía de manager del usuario en el artista; al tener una sola membresía por artista, el usuario deja de tener acceso a él. Si debe seguir como member, añádelo de nuevo con POST /api/v1/mis-artistas/{artistId}/miembros. Si no es manager, no hace nada. Idempotente. No puede dejar el artista sin manager.",
		Tags:        []string{"staff", "artistas"},
		Security:    seguridad,
		Middlewares: []func(huma.Context, func(huma.Context)){admin},
	}, g.cambiarManager(false))
}

type gestion struct {
	db database.DB
	gt *gotrueadmin.Client
}

type crearUsuarioInput struct {
	Body struct {
		Email       string `json:"email" format:"email" maxLength:"254" doc:"Correo de la cuenta (se guarda en minúsculas)"`
		Password    string `json:"password" minLength:"12" maxLength:"72" doc:"Contraseña inicial; el administrador la entrega al usuario"`
		DisplayName string `json:"display_name,omitempty" maxLength:"80" doc:"Nombre visible; por defecto, la parte local del correo"`
		Rol         string `json:"rol" enum:"admin,editor,vendedor" doc:"Rol staff inicial"`
	}
}

type crearUsuarioOutput struct {
	Body struct {
		ID          string `json:"id"`
		Email       string `json:"email"`
		DisplayName string `json:"display_name"`
		Rol         string `json:"rol"`
	}
}

func (g gestion) crearUsuario(ctx context.Context, in *crearUsuarioInput) (*crearUsuarioOutput, error) {
	email := strings.ToLower(strings.TrimSpace(in.Body.Email))
	id, err := g.gt.CreateUser(ctx, email, in.Body.Password)
	switch {
	case errors.Is(err, gotrueadmin.ErrAlreadyExists):
		return nil, huma.Error409Conflict("ya existe una cuenta con ese correo; asígnale el rol con PUT /api/v1/staff/usuarios/{id}/roles/{rol}")
	case errors.Is(err, gotrueadmin.ErrRejected):
		return nil, huma.Error422UnprocessableEntity("la cuenta no cumple la política de contraseña (mínimo 12 caracteres)")
	case err != nil:
		return nil, apierr.Internal("error creando la cuenta", err)
	}

	name := strings.TrimSpace(in.Body.DisplayName)
	if name == "" {
		name = strings.SplitN(email, "@", 2)[0]
	}
	if _, err := g.db.Exec(ctx,
		`insert into profiles (id, display_name, email) values ($1, $2, $3)
		 on conflict (id) do update set email = excluded.email`,
		id, name, email); err != nil {
		return nil, apierr.Internal("error creando el perfil", err)
	}
	if _, err := g.db.Exec(ctx, `select admin_set_staff_role($1, $2, true)`, id, in.Body.Rol); err != nil {
		return nil, mapErrGestion(err)
	}

	out := &crearUsuarioOutput{}
	out.Body.ID = id
	out.Body.Email = email
	out.Body.DisplayName = name
	out.Body.Rol = in.Body.Rol
	return out, nil
}

type cambioRolInput struct {
	ID  string `path:"id" format:"uuid" doc:"ID del usuario (sub de GoTrue)"`
	Rol string `path:"rol" enum:"admin,editor,vendedor" doc:"Rol staff"`
}

type cambioRolOutput struct {
	Body struct {
		UserID    string `json:"user_id"`
		Rol       string `json:"rol"`
		Concedido bool   `json:"concedido" doc:"true si se concedió; false si se quitó"`
	}
}

func (g gestion) cambiarRol(conceder bool) func(context.Context, *cambioRolInput) (*cambioRolOutput, error) {
	return func(ctx context.Context, in *cambioRolInput) (*cambioRolOutput, error) {
		if claims, ok := auth.ClaimsFromContext(ctx); ok && !conceder && in.Rol == "admin" && claims.Subject == in.ID {
			return nil, huma.Error409Conflict("no puedes quitarte tu propio rol admin")
		}
		if _, err := g.db.Exec(ctx, `select admin_set_staff_role($1, $2, $3)`, in.ID, in.Rol, conceder); err != nil {
			return nil, mapErrGestion(err)
		}
		out := &cambioRolOutput{}
		out.Body.UserID = in.ID
		out.Body.Rol = in.Rol
		out.Body.Concedido = conceder
		return out, nil
	}
}

type cambioManagerInput struct {
	ArtistID string `path:"artistId" format:"uuid" doc:"ID del artista"`
	UserID   string `path:"userId" format:"uuid" doc:"ID del usuario (sub de GoTrue)"`
}

type cambioManagerOutput struct {
	Body struct {
		ArtistID string `json:"artist_id"`
		UserID   string `json:"user_id"`
		Manager  bool   `json:"manager" doc:"true si el usuario es manager del artista tras el cambio"`
	}
}

func (g gestion) cambiarManager(conceder bool) func(context.Context, *cambioManagerInput) (*cambioManagerOutput, error) {
	return func(ctx context.Context, in *cambioManagerInput) (*cambioManagerOutput, error) {
		if _, err := g.db.Exec(ctx, `select admin_set_artist_manager($1, $2, $3)`, in.UserID, in.ArtistID, conceder); err != nil {
			return nil, mapErrGestion(err)
		}
		out := &cambioManagerOutput{}
		out.Body.ArtistID = in.ArtistID
		out.Body.UserID = in.UserID
		out.Body.Manager = conceder
		return out, nil
	}
}

// mapErrGestion traduce los errores de negocio de las funciones de la base a
// códigos HTTP. Cualquier otro error se registra y responde sin detalle.
func mapErrGestion(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Message {
		case "ultimo_admin":
			return huma.Error409Conflict("no se puede quitar el último admin del sistema")
		case "perfil_inexistente":
			return huma.Error404NotFound("usuario no encontrado")
		case "artista_inexistente":
			return huma.Error404NotFound("artista no encontrado")
		case "rol_invalido":
			return huma.Error422UnprocessableEntity("rol inválido")
		case "sin_manager":
			return huma.Error409Conflict("el artista debe conservar al menos un manager")
		}
	}
	return apierr.Internal("error gestionando roles", err)
}
