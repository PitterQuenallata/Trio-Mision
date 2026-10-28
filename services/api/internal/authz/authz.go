// Package authz implementa la autorización de negocio: los roles staff
// (admin, editor, vendedor) viven en staff_roles, no en claims del token.
// La API decide consultando PostgreSQL; el frontend nunca autoriza por sí.
package authz

import (
	"errors"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"

	"triomision/api/internal/auth"
	"triomision/api/internal/database"
)

// RequireStaff devuelve un middleware Huma que exige al menos uno de los
// roles staff indicados. Requiere que la operación declare seguridad
// "bearer" (el middleware de auth valida el token antes que este).
func RequireStaff(api huma.API, db database.DB, roles ...string) func(huma.Context, func(huma.Context)) {
	return func(ctx huma.Context, next func(huma.Context)) {
		claims, ok := auth.ClaimsFromContext(ctx.Context())
		if !ok {
			huma.WriteErr(api, ctx, http.StatusUnauthorized, "no autenticado")
			return
		}
		var authorized bool
		err := db.QueryRow(ctx.Context(), `
			select exists (
				select 1 from staff_roles where user_id = $1 and role = any($2)
			)`, claims.Subject, roles).Scan(&authorized)
		if err != nil {
			huma.WriteErr(api, ctx, http.StatusInternalServerError, "error verificando permisos")
			return
		}
		if !authorized {
			huma.WriteErr(api, ctx, http.StatusForbidden, "se requiere rol staff")
			return
		}
		next(ctx)
	}
}

// RequireArtistRole devuelve un middleware Huma que exige membresía en el
// artista indicado por el parámetro de ruta artistParam, con al menos el rol
// por-artista solicitado ("member" o "manager", según artist_members).
//
// Decisiones de códigos: quien no es miembro del artista recibe 404 (no se
// revela la existencia del artista ni del recurso); quien es miembro con rol
// inferior (member ante una operación de manager) recibe 403.
func RequireArtistRole(api huma.API, db database.DB, artistParam, minRole string) func(huma.Context, func(huma.Context)) {
	return func(ctx huma.Context, next func(huma.Context)) {
		claims, ok := auth.ClaimsFromContext(ctx.Context())
		if !ok {
			huma.WriteErr(api, ctx, http.StatusUnauthorized, "no autenticado")
			return
		}
		artistID := ctx.Param(artistParam)
		if artistID == "" {
			huma.WriteErr(api, ctx, http.StatusNotFound, "artista no encontrado")
			return
		}
		var role string
		err := db.QueryRow(ctx.Context(), `
			select member_role from artist_members
			where artist_id = $1 and user_id = $2`, artistID, claims.Subject).Scan(&role)
		if errors.Is(err, pgx.ErrNoRows) {
			huma.WriteErr(api, ctx, http.StatusNotFound, "artista no encontrado")
			return
		}
		if err != nil {
			huma.WriteErr(api, ctx, http.StatusInternalServerError, "error verificando membresía")
			return
		}
		if minRole == "manager" && role != "manager" {
			huma.WriteErr(api, ctx, http.StatusForbidden, "se requiere rol manager de este artista")
			return
		}
		next(ctx)
	}
}
