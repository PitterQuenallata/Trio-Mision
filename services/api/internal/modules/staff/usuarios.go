package staff

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"triomision/api/internal/apierr"
	"triomision/api/internal/authz"
	"triomision/api/internal/database"
)

// RegisterUsuarios registra el listado de usuarios para administración.
// Solo lectura: asignar o quitar roles staff no está disponible por API
// (la cuenta de la API no tiene INSERT/DELETE sobre staff_roles; ver 00014).
// Los cambios de rol se hacen con `make db-staff`.
func RegisterUsuarios(api huma.API, db database.DB) {
	admin := authz.RequireStaff(api, db, "admin")

	huma.Register(api, huma.Operation{
		OperationID: "staff-listar-usuarios",
		Method:      http.MethodGet,
		Path:        "/api/v1/staff/usuarios",
		Summary:     "Listar usuarios con sus roles (admin)",
		Description: "Perfiles registrados con roles staff y membresías de artista. " +
			"Filtros opcionales: texto (correo o nombre, coincidencia parcial) y rol staff. " +
			"Máximo 200 resultados, más recientes primero. Solo admin.",
		Tags:        []string{"staff", "usuarios"},
		Security:    []map[string][]string{{"bearer": {}}},
		Middlewares: []func(huma.Context, func(huma.Context)){admin},
	}, listarUsuarios(db))
}

type listarUsuariosInput struct {
	Q   string `query:"q" required:"false" maxLength:"100" doc:"Texto a buscar en correo o nombre"`
	Rol string `query:"rol" required:"false" enum:"admin,editor,vendedor" doc:"Filtra por rol staff"`
}

type usuarioStaff struct {
	ID                string             `json:"id"`
	Email             string             `json:"email,omitempty"`
	DisplayName       string             `json:"display_name,omitempty"`
	IsBanned          bool               `json:"is_banned"`
	CreatedAt         time.Time          `json:"created_at"`
	StaffRoles        []string           `json:"staff_roles"`
	ArtistMemberships []membresiaUsuario `json:"artist_memberships"`
}

type membresiaUsuario struct {
	ArtistID string `json:"artist_id"`
	Role     string `json:"role" enum:"member,manager"`
	Nombre   string `json:"nombre" doc:"Nombre del artista"`
	Activo   bool   `json:"activo" doc:"false si la membresía está desactivada (sin acceso)"`
}

type listarUsuariosOutput struct {
	Body struct {
		Usuarios []usuarioStaff `json:"usuarios"`
	}
}

// escaparLike escapa los comodines de LIKE para buscar el texto literal.
func escaparLike(s string) string {
	r := strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)
	return r.Replace(s)
}

func listarUsuarios(db database.DB) func(context.Context, *listarUsuariosInput) (*listarUsuariosOutput, error) {
	return func(ctx context.Context, in *listarUsuariosInput) (*listarUsuariosOutput, error) {
		patron := "%" + escaparLike(strings.TrimSpace(in.Q)) + "%"
		rows, err := db.Query(ctx, `
			select p.id::text, coalesce(p.email, ''), coalesce(p.display_name, ''), p.is_banned, p.created_at,
			  coalesce((select array_agg(sr.role order by sr.role) from staff_roles sr where sr.user_id = p.id), '{}'),
			  coalesce((
			    select json_agg(json_build_object('artist_id', am.artist_id, 'role', am.member_role, 'nombre', ar.name, 'activo', am.activo) order by ar.name)
			    from artist_members am join artists ar on ar.id = am.artist_id where am.user_id = p.id
			  )::text, '[]')
			from profiles p
			where ($1 = '' or p.email ilike $2 or p.display_name ilike $2)
			  and ($3 = '' or exists (select 1 from staff_roles r where r.user_id = p.id and r.role = $3))
			order by p.created_at desc
			limit 200`, strings.TrimSpace(in.Q), patron, in.Rol)
		if err != nil {
			return nil, apierr.Internal("error consultando los usuarios", err)
		}
		defer rows.Close()

		out := &listarUsuariosOutput{}
		out.Body.Usuarios = []usuarioStaff{}
		for rows.Next() {
			var u usuarioStaff
			var roles []string
			var membresiasJSON []byte
			if err := rows.Scan(&u.ID, &u.Email, &u.DisplayName, &u.IsBanned, &u.CreatedAt, &roles, &membresiasJSON); err != nil {
				return nil, apierr.Internal("error leyendo los usuarios", err)
			}
			if roles == nil {
				roles = []string{}
			}
			u.StaffRoles = roles
			u.ArtistMemberships = []membresiaUsuario{}
			if err := json.Unmarshal(membresiasJSON, &u.ArtistMemberships); err != nil {
				return nil, apierr.Internal("error leyendo las membresías", err)
			}
			out.Body.Usuarios = append(out.Body.Usuarios, u)
		}
		if err := rows.Err(); err != nil {
			return nil, apierr.Internal("error leyendo los usuarios", err)
		}
		return out, nil
	}
}

// ── Búsqueda de artistas (admin) ─────────────────────────────────────────

// RegisterBuscarArtistas registra la búsqueda de artistas para asignar managers.
// Devuelve solo coincidencias del texto buscado, con límite: nunca el catálogo
// completo, para que la interfaz no cargue todos los artistas.
func RegisterBuscarArtistas(api huma.API, db database.DB) {
	admin := authz.RequireStaff(api, db, "admin")

	huma.Register(api, huma.Operation{
		OperationID: "staff-buscar-artistas",
		Method:      http.MethodGet,
		Path:        "/api/v1/staff/artistas",
		Summary:     "Buscar artistas para asignar managers (admin)",
		Description: "Artistas cuyo nombre o slug contiene el texto buscado, por orden de nombre. " +
			"Límite de 1 a 50 (por defecto 20). Solo admin; no es un listado del catálogo completo.",
		Tags:        []string{"staff", "artistas"},
		Security:    []map[string][]string{{"bearer": {}}},
		Middlewares: []func(huma.Context, func(huma.Context)){admin},
	}, buscarArtistas(db))
}

type buscarArtistasInput struct {
	Q      string `query:"q" required:"false" maxLength:"100" doc:"Texto a buscar en nombre o slug"`
	Limite int    `query:"limite" required:"false" minimum:"1" maximum:"50" default:"20" doc:"Máximo de resultados (1 a 50)"`
}

type artistaBusqueda struct {
	ID     string `json:"id"`
	Slug   string `json:"slug"`
	Nombre string `json:"nombre"`
}

type buscarArtistasOutput struct {
	Body struct {
		Artistas []artistaBusqueda `json:"artistas"`
	}
}

func buscarArtistas(db database.DB) func(context.Context, *buscarArtistasInput) (*buscarArtistasOutput, error) {
	return func(ctx context.Context, in *buscarArtistasInput) (*buscarArtistasOutput, error) {
		q := strings.TrimSpace(in.Q)
		patron := "%" + escaparLike(q) + "%"
		limite := in.Limite
		if limite < 1 {
			limite = 20
		}
		rows, err := db.Query(ctx, `
			select id::text, slug, name from artists
			where ($1 = '' or name ilike $2 or slug ilike $2)
			order by name
			limit $3`, q, patron, limite)
		if err != nil {
			return nil, apierr.Internal("error buscando artistas", err)
		}
		defer rows.Close()

		out := &buscarArtistasOutput{}
		out.Body.Artistas = []artistaBusqueda{}
		for rows.Next() {
			var a artistaBusqueda
			if err := rows.Scan(&a.ID, &a.Slug, &a.Nombre); err != nil {
				return nil, apierr.Internal("error leyendo los artistas", err)
			}
			out.Body.Artistas = append(out.Body.Artistas, a)
		}
		if err := rows.Err(); err != nil {
			return nil, apierr.Internal("error leyendo los artistas", err)
		}
		return out, nil
	}
}
