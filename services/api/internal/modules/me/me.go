// Package me expone la identidad del usuario autenticado y asegura su
// perfil: la fila en profiles se crea de forma perezosa en el primer
// request autenticado (id = sub del JWT de GoTrue, FK lógica a auth.users).
//
// Además devuelve los roles staff y las membresías de artista del usuario,
// para que los clientes (panel admin, app) decidan qué mostrar. Es solo
// información para la interfaz: la autorización real la aplica la API en
// cada endpoint consultando staff_roles y artist_members.
package me

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"

	"triomision/api/internal/apierr"
	"triomision/api/internal/auth"
	"triomision/api/internal/database"
)

// artistMembership es una membresía del usuario en un artista.
type artistMembership struct {
	ArtistID string `json:"artist_id" doc:"UUID del artista"`
	Role     string `json:"role" doc:"Rol por artista: member (lectura) o manager (administra)" enum:"member,manager"`
}

type meOutput struct {
	Body struct {
		UserID            string             `json:"user_id" doc:"ID del usuario (sub del token GoTrue)"`
		Email             string             `json:"email,omitempty" doc:"Correo del usuario"`
		Role              string             `json:"role" doc:"Rol de aplicación del token"`
		DisplayName       string             `json:"display_name,omitempty" doc:"Nombre visible del perfil"`
		StaffRoles        []string           `json:"staff_roles" doc:"Roles staff (admin, editor, vendedor). Lista vacía si no es staff."`
		ArtistMemberships []artistMembership `json:"artist_memberships" doc:"Membresías por artista. Lista vacía si no pertenece a ninguno."`
	}
}

// accessSQL devuelve, en una sola fila, los roles staff como text[] y las
// membresías como JSON (cadena). Siempre devuelve una fila, aunque el usuario
// no tenga roles ni membresías.
const accessSQL = `
select
  coalesce((select array_agg(sr.role order by sr.role) from staff_roles sr where sr.user_id = $1), '{}'),
  coalesce((
    select json_agg(json_build_object('artist_id', am.artist_id, 'role', am.member_role) order by am.artist_id)
    from artist_members am where am.user_id = $1 and am.activo
  )::text, '[]')`

// Register registra GET /api/v1/me, protegido con Bearer JWT.
func Register(api huma.API, db database.DB) {
	huma.Register(api, huma.Operation{
		OperationID: "me",
		Method:      http.MethodGet,
		Path:        "/api/v1/me",
		Summary:     "Identidad del usuario autenticado",
		Description: "Devuelve la identidad del token, asegura el perfil (crea la fila en profiles " +
			"en el primer request autenticado) y los roles staff y membresías de artista.",
		Tags:     []string{"auth"},
		Security: []map[string][]string{{"bearer": {}}},
	}, func(ctx context.Context, _ *struct{}) (*meOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}

		displayName, err := ensureProfile(ctx, db, claims)
		if err != nil {
			return nil, apierr.Internal("error de base de datos", err)
		}

		staffRoles, memberships, err := loadAccess(ctx, db, claims.Subject)
		if err != nil {
			return nil, apierr.Internal("error de base de datos", err)
		}

		out := &meOutput{}
		out.Body.UserID = claims.Subject
		out.Body.Email = claims.Email
		out.Body.Role = claims.Role
		out.Body.DisplayName = displayName
		out.Body.StaffRoles = staffRoles
		out.Body.ArtistMemberships = memberships
		return out, nil
	})
}

// loadAccess lee los roles staff y las membresías del usuario.
func loadAccess(ctx context.Context, db database.DB, userID string) ([]string, []artistMembership, error) {
	var roles []string
	var membershipsJSON []byte
	if err := db.QueryRow(ctx, accessSQL, userID).Scan(&roles, &membershipsJSON); err != nil {
		return nil, nil, err
	}
	if roles == nil {
		roles = []string{}
	}
	memberships := []artistMembership{}
	if err := json.Unmarshal(membershipsJSON, &memberships); err != nil {
		return nil, nil, err
	}
	return roles, memberships, nil
}

// ensureProfile inserta el perfil si no existe (primer login) y devuelve el
// display_name almacenado. El valor inicial sale del correo del token; las
// credenciales jamás se replican: viven solo en GoTrue (auth.users).
// Si el perfil existe con display_name vacío (creado por otro módulo antes
// de tener correo), se rellena con la parte local del correo.
func ensureProfile(ctx context.Context, db database.DB, claims *auth.Claims) (string, error) {
	var initial *string
	if claims.Email != "" {
		name := strings.SplitN(claims.Email, "@", 2)[0]
		initial = &name
	}

	var displayName *string
	err := db.QueryRow(ctx,
		`INSERT INTO profiles (id, display_name, email) VALUES ($1, $2, $3)
		 ON CONFLICT (id) DO UPDATE SET email = COALESCE(EXCLUDED.email, profiles.email)
		 RETURNING display_name`,
		claims.Subject, initial, claims.Email).Scan(&displayName)
	if errors.Is(err, pgx.ErrNoRows) {
		// El perfil ya existía: se lee el valor guardado.
		err = db.QueryRow(ctx,
			`SELECT display_name FROM profiles WHERE id = $1`,
			claims.Subject).Scan(&displayName)
	}
	if err != nil {
		return "", err
	}
	if displayName == nil && initial != nil {
		// Perfil existente sin nombre visible: se completa con el correo.
		err = db.QueryRow(ctx,
			`UPDATE profiles SET display_name = $2 WHERE id = $1 AND display_name IS NULL
			 RETURNING display_name`,
			claims.Subject, *initial).Scan(&displayName)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return "", err
		}
	}
	if displayName == nil {
		return "", nil
	}
	return *displayName, nil
}
