// Package licencias implementa la configuración de licencias y permisos
// adicionales por pista con autorización por artista: member y manager leen
// la configuración de sus artistas; solo el manager publica versiones de
// términos, guarda el perfil de permisos por defecto del artista y administra
// las opciones elegibles de las pistas de su artista. Las pistas ajenas
// devuelven 404 (no se revela su existencia). Las versiones de términos son
// append-only: versionar = insertar una fila nueva.
package licencias

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"

	"triomision/api/internal/auth"
	"triomision/api/internal/authz"
	"triomision/api/internal/database"
)

// usosPosibles es el catálogo cerrado de usos adicionales (CHECK en base,
// migración 00021). La descarga/escucha es el audio base, no un permiso adicional.
const usosPosibles = "practica,interpretacion,grabacion_vocal,publicacion,monetizacion"

// Register registra los endpoints de configuración de licencias bajo
// /api/v1/mis-artistas. Las lecturas admiten member y manager; las mutaciones
// solo manager (middleware authz.RequireArtistRole).
func Register(api huma.API, db database.DB) {
	miembros := authz.RequireArtistRole(api, db, "artistId", "member")
	managers := authz.RequireArtistRole(api, db, "artistId", "manager")

	huma.Register(api, huma.Operation{
		OperationID: "artistas-listar-licencias",
		Method:      http.MethodGet,
		Path:        "/api/v1/mis-artistas/{artistId}/licencias",
		Summary:     "Configuración de licencias de mi artista",
		Description: "Perfil de permisos por defecto (plantilla), opciones elegibles por pista y versiones " +
			"de términos, de la más reciente a la más antigua. Requiere ser member o manager del artista.",
		Tags:        []string{"artistas"},
		Security:    []map[string][]string{{"bearer": {}}},
		Middlewares: []func(huma.Context, func(huma.Context)){miembros},
	}, listar(db))

	huma.Register(api, huma.Operation{
		OperationID: "artistas-guardar-licencia-pista",
		Method:      http.MethodPut,
		Path:        "/api/v1/mis-artistas/{artistId}/pistas/{trackId}/licencias/{useCode}",
		Summary:     "Configurar permiso adicional de una pista (manager)",
		Description: "Crea o actualiza la opción elegible de una pista de su artista para un uso concreto: " +
			"precio, moneda y si se ofrece. Inhabilitar deja de ofrecerla sin afectar las órdenes ya congeladas. " +
			"Auditoría licencia_opcion.creada/actualizada.",
		Tags:        []string{"artistas"},
		Security:    []map[string][]string{{"bearer": {}}},
		Middlewares: []func(huma.Context, func(huma.Context)){managers},
	}, guardarOpcion(db))

	huma.Register(api, huma.Operation{
		OperationID: "artistas-publicar-terminos-licencia",
		Method:      http.MethodPost,
		Path:        "/api/v1/mis-artistas/{artistId}/terminos-licencia",
		Summary:     "Publicar versión de términos de licencia (manager)",
		Description: "Publica una nueva versión de los términos de licencia del artista. Las versiones son " +
			"append-only (no se editan) y las órdenes congelan la versión vigente al comprar. " +
			"Auditoría terminos.publicados.",
		Tags:        []string{"artistas"},
		Security:    []map[string][]string{{"bearer": {}}},
		Middlewares: []func(huma.Context, func(huma.Context)){managers},
	}, publicarTerminos(db))

	huma.Register(api, huma.Operation{
		OperationID: "artistas-guardar-perfil-licencias",
		Method:      http.MethodPut,
		Path:        "/api/v1/mis-artistas/{artistId}/licencias/perfil",
		Summary:     "Guardar perfil de permisos por defecto (manager)",
		Description: "Plantilla de permisos del artista (usos con precio y moneda) para sus pistas. La oferta " +
			"efectiva la definen las opciones por pista. Auditoría perfil_licencias.actualizado.",
		Tags:        []string{"artistas"},
		Security:    []map[string][]string{{"bearer": {}}},
		Middlewares: []func(huma.Context, func(huma.Context)){managers},
	}, guardarPerfil(db))
}

// ── Tipos de respuesta ─────────────────────────────────────────────────────

type opcionLicencia struct {
	ID            string    `json:"id"`
	PistaID       string    `json:"pista_id"`
	PistaTitulo   string    `json:"pista_titulo"`
	Uso           string    `json:"uso" doc:"practica | interpretacion | grabacion_vocal | publicacion | monetizacion"`
	MontoMinor    int64     `json:"monto_minor"`
	Moneda        string    `json:"moneda"`
	Habilitada    bool      `json:"habilitada"`
	ActualizadaEn time.Time `json:"actualizada_en"`
}

type versionTerminos struct {
	ID          string    `json:"id"`
	Etiqueta    string    `json:"etiqueta"`
	PublicadoEn time.Time `json:"publicado_en"`
}

type listarOutput struct {
	Body struct {
		Perfil   json.RawMessage   `json:"perfil" doc:"Permisos por defecto del artista (plantilla JSON)"`
		Opciones []opcionLicencia  `json:"opciones"`
		Terminos []versionTerminos `json:"terminos" doc:"Versiones de términos, recientes primero"`
	}
}

// listar devuelve la configuración de licencias del artista. La membresía ya
// quedó validada en el middleware.
func listar(db database.DB) func(context.Context, *artistaPath) (*listarOutput, error) {
	return func(ctx context.Context, in *artistaPath) (*listarOutput, error) {
		out := &listarOutput{}
		out.Body.Perfil = json.RawMessage(`{}`)
		out.Body.Opciones = []opcionLicencia{}
		out.Body.Terminos = []versionTerminos{}

		var perfil json.RawMessage
		err := db.QueryRow(ctx, `
			select default_permissions from artist_license_profiles where artist_id = $1`, in.ArtistID,
		).Scan(&perfil)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error500InternalServerError("error consultando el perfil de licencias", err)
		}
		if err == nil {
			out.Body.Perfil = perfil
		}

		rows, err := db.Query(ctx, `
			select tlo.id, tlo.track_id, t.title, tlo.use_code, tlo.add_on_amount_minor, tlo.currency,
			       tlo.enabled, tlo.updated_at
			from track_license_options tlo
			join tracks t on t.id = tlo.track_id and t.deleted_at is null
			where t.artist_id = $1
			order by t.title, tlo.use_code`, in.ArtistID)
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando las opciones de licencia", err)
		}
		defer rows.Close()
		for rows.Next() {
			var o opcionLicencia
			if err := rows.Scan(&o.ID, &o.PistaID, &o.PistaTitulo, &o.Uso, &o.MontoMinor,
				&o.Moneda, &o.Habilitada, &o.ActualizadaEn); err != nil {
				return nil, huma.Error500InternalServerError("error leyendo las opciones", err)
			}
			out.Body.Opciones = append(out.Body.Opciones, o)
		}
		if err := rows.Err(); err != nil {
			return nil, huma.Error500InternalServerError("error leyendo las opciones", err)
		}
		rows.Close()

		trows, err := db.Query(ctx, `
			select id, version_label, published_at from license_terms_versions
			where artist_id = $1 order by published_at desc limit 20`, in.ArtistID)
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando los términos", err)
		}
		defer trows.Close()
		for trows.Next() {
			var v versionTerminos
			if err := trows.Scan(&v.ID, &v.Etiqueta, &v.PublicadoEn); err != nil {
				return nil, huma.Error500InternalServerError("error leyendo los términos", err)
			}
			out.Body.Terminos = append(out.Body.Terminos, v)
		}
		if err := trows.Err(); err != nil {
			return nil, huma.Error500InternalServerError("error leyendo los términos", err)
		}
		return out, nil
	}
}

type artistaPath struct {
	ArtistID string `path:"artistId" format:"uuid" doc:"ID del artista"`
}

// ── Mutaciones (manager) ───────────────────────────────────────────────────

type guardarOpcionInput struct {
	ArtistID string `path:"artistId" format:"uuid" doc:"ID del artista"`
	TrackID  string `path:"trackId" format:"uuid" doc:"ID de la pista del artista"`
	UseCode  string `path:"useCode" enum:"practica,interpretacion,grabacion_vocal,publicacion,monetizacion" doc:"Uso adicional"`
	Body     struct {
		MontoMinor int64  `json:"monto_minor" minimum:"1" doc:"Precio adicional en unidades menores"`
		Moneda     string `json:"moneda" minLength:"3" maxLength:"3" doc:"ISO 4217"`
		Habilitada bool   `json:"habilitada" doc:"false deja de ofrecerla sin afectar órdenes congeladas"`
	}
}

type opcionOut struct {
	Body opcionLicencia
}

// guardarOpcion crea o actualiza la opción de licencia de una pista. La pista
// debe pertenecer al artista de la ruta; si no, 404 (pista ajena o inexistente).
func guardarOpcion(db database.DB) func(context.Context, *guardarOpcionInput) (*opcionOut, error) {
	return func(ctx context.Context, in *guardarOpcionInput) (*opcionOut, error) {
		claims, _ := auth.ClaimsFromContext(ctx)
		moneda := strings.ToUpper(strings.TrimSpace(in.Body.Moneda))

		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, huma.Error500InternalServerError("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)

		// Alcance: la pista debe existir, no estar eliminada y ser de este artista.
		var existe bool
		err = tx.QueryRow(ctx, `
			select exists(select 1 from tracks where id = $1 and artist_id = $2 and deleted_at is null)`,
			in.TrackID, in.ArtistID).Scan(&existe)
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando la pista", err)
		}
		if !existe {
			return nil, huma.Error404NotFound("pista no encontrada en este artista")
		}

		out := &opcionOut{}
		var opcionID, accion string
		err = tx.QueryRow(ctx, `
			select id from track_license_options where track_id = $1 and use_code = $2 for update`,
			in.TrackID, in.UseCode).Scan(&opcionID)
		switch {
		case err == nil:
			accion = "licencia_opcion.actualizada"
			err = tx.QueryRow(ctx, `
				update track_license_options
				set add_on_amount_minor = $2, currency = $3, enabled = $4
				where id = $1
				returning id, track_id, use_code, add_on_amount_minor, currency, enabled, updated_at`,
				opcionID, in.Body.MontoMinor, moneda, in.Body.Habilitada,
			).Scan(&out.Body.ID, &out.Body.PistaID, &out.Body.Uso, &out.Body.MontoMinor,
				&out.Body.Moneda, &out.Body.Habilitada, &out.Body.ActualizadaEn)
		case errors.Is(err, pgx.ErrNoRows):
			accion = "licencia_opcion.creada"
			err = tx.QueryRow(ctx, `
				insert into track_license_options (track_id, use_code, add_on_amount_minor, currency, enabled)
				values ($1, $2, $3, $4, $5)
				returning id, track_id, use_code, add_on_amount_minor, currency, enabled, updated_at`,
				in.TrackID, in.UseCode, in.Body.MontoMinor, moneda, in.Body.Habilitada,
			).Scan(&out.Body.ID, &out.Body.PistaID, &out.Body.Uso, &out.Body.MontoMinor,
				&out.Body.Moneda, &out.Body.Habilitada, &out.Body.ActualizadaEn)
		}
		if err != nil {
			return nil, huma.Error500InternalServerError("error guardando la opción de licencia", err)
		}
		var titulo string
		if err := tx.QueryRow(ctx, `select title from tracks where id = $1`, in.TrackID).Scan(&titulo); err != nil {
			return nil, huma.Error500InternalServerError("error consultando la pista", err)
		}
		out.Body.PistaTitulo = titulo
		if err := registrarAuditoria(ctx, tx, claims.Subject, accion, "track_license_option", out.Body.ID,
			map[string]any{"artista_id": in.ArtistID, "pista_id": in.TrackID, "uso": in.UseCode,
				"monto_minor": in.Body.MontoMinor, "habilitada": in.Body.Habilitada}); err != nil {
			return nil, huma.Error500InternalServerError("error registrando auditoría", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, huma.Error500InternalServerError("error confirmando la transacción", err)
		}
		return out, nil
	}
}

type publicarTerminosInput struct {
	ArtistID string `path:"artistId" format:"uuid" doc:"ID del artista"`
	Body     struct {
		VersionLabel string `json:"version_label" minLength:"2" maxLength:"100" doc:"Etiqueta visible (p. ej. v2)"`
		TermsText    string `json:"terms_text" minLength:"10" maxLength:"20000" doc:"Texto completo de los términos"`
	}
}

type terminosOut struct {
	Body struct {
		ID          string    `json:"id"`
		Etiqueta    string    `json:"etiqueta"`
		Texto       string    `json:"texto"`
		PublicadoEn time.Time `json:"publicado_en"`
	}
}

// publicarTerminos inserta una nueva versión de términos (append-only). Las
// órdenes futuras congelarán esta versión al incluir licencias del artista.
func publicarTerminos(db database.DB) func(context.Context, *publicarTerminosInput) (*terminosOut, error) {
	return func(ctx context.Context, in *publicarTerminosInput) (*terminosOut, error) {
		claims, _ := auth.ClaimsFromContext(ctx)
		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, huma.Error500InternalServerError("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)

		out := &terminosOut{}
		err = tx.QueryRow(ctx, `
			insert into license_terms_versions (artist_id, version_label, terms_text)
			values ($1, $2, $3)
			returning id, version_label, terms_text, published_at`,
			in.ArtistID, in.Body.VersionLabel, in.Body.TermsText,
		).Scan(&out.Body.ID, &out.Body.Etiqueta, &out.Body.Texto, &out.Body.PublicadoEn)
		if err != nil {
			return nil, huma.Error500InternalServerError("error publicando los términos", err)
		}
		if err := registrarAuditoria(ctx, tx, claims.Subject, "terminos.publicados", "license_terms_version", out.Body.ID,
			map[string]any{"artista_id": in.ArtistID, "etiqueta": in.Body.VersionLabel}); err != nil {
			return nil, huma.Error500InternalServerError("error registrando auditoría", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, huma.Error500InternalServerError("error confirmando la transacción", err)
		}
		return out, nil
	}
}

type guardarPerfilInput struct {
	ArtistID string `path:"artistId" format:"uuid" doc:"ID del artista"`
	Body     struct {
		Permisos map[string]any `json:"permisos" doc:"Plantilla: uso → {monto_minor, moneda}"`
	}
}

type perfilOut struct {
	Body struct {
		ArtistID      string          `json:"artist_id"`
		Permisos      json.RawMessage `json:"permisos"`
		ActualizadoEn time.Time       `json:"actualizado_en"`
	}
}

// guardarPerfil upsertea la plantilla de permisos por defecto del artista.
func guardarPerfil(db database.DB) func(context.Context, *guardarPerfilInput) (*perfilOut, error) {
	return func(ctx context.Context, in *guardarPerfilInput) (*perfilOut, error) {
		claims, _ := auth.ClaimsFromContext(ctx)
		permisos := map[string]any{}
		if in.Body.Permisos != nil {
			permisos = in.Body.Permisos
		}
		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, huma.Error500InternalServerError("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)

		out := &perfilOut{}
		err = tx.QueryRow(ctx, `
			insert into artist_license_profiles (artist_id, default_permissions)
			values ($1, $2)
			on conflict (artist_id) do update set default_permissions = excluded.default_permissions
			returning artist_id, default_permissions, updated_at`,
			in.ArtistID, permisos,
		).Scan(&out.Body.ArtistID, &out.Body.Permisos, &out.Body.ActualizadoEn)
		if err != nil {
			return nil, huma.Error500InternalServerError("error guardando el perfil de licencias", err)
		}
		if err := registrarAuditoria(ctx, tx, claims.Subject, "perfil_licencias.actualizado", "artist_license_profile", in.ArtistID,
			map[string]any{"artista_id": in.ArtistID}); err != nil {
			return nil, huma.Error500InternalServerError("error registrando auditoría", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, huma.Error500InternalServerError("error confirmando la transacción", err)
		}
		return out, nil
	}
}

// registrarAuditoria inserta un evento de auditoría usando la tx activa.
func registrarAuditoria(ctx context.Context, q database.Querier, actorID, action, entityType, entityID string, metadata map[string]any) error {
	_, err := q.Exec(ctx, `
		insert into audit_events (actor_id, action, entity_type, entity_id, metadata)
		values ($1, $2, $3, $4, $5)`, actorID, action, entityType, entityID, metadata)
	return err
}
