package store

import (
	"context"
	"encoding/json"
	"errors"
	"regexp"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"

	"triomision/api/internal/database"
)

// ── Permisos adicionales públicos por pista ────────────────────────────────

type licenciaOpcionPublica struct {
	ID         string `json:"id"`
	Uso        string `json:"uso" doc:"practica | interpretacion | grabacion_vocal | publicacion | monetizacion"`
	MontoMinor int64  `json:"monto_minor" doc:"Precio adicional en unidades menores"`
	Moneda     string `json:"moneda" doc:"ISO 4217"`
}

type licenciaTerminosPublicos struct {
	VersionID   string    `json:"version_id"`
	Etiqueta    string    `json:"etiqueta"`
	Texto       string    `json:"texto"`
	PublicadoEn time.Time `json:"publicado_en"`
}

type pistaLicenciasOutput struct {
	Body struct {
		Elegible bool                      `json:"elegible" doc:"true cuando la pista ofrece al menos un permiso adicional"`
		Opciones []licenciaOpcionPublica   `json:"opciones" doc:"Permisos adicionales ofrecidos (solo opciones habilitadas)"`
		Terminos *licenciaTerminosPublicos `json:"terminos,omitempty" doc:"Términos de licencia vigentes del artista de la pista"`
	}
}

// pistaLicencias expone los permisos adicionales ofrecidos por una pista
// publicada: solo las opciones habilitadas y los términos vigentes de su
// artista. Las pistas sin autorización suficiente no ofrecen opciones
// (elegible=false); la compra/descarga del audio nunca los implica.
func pistaLicencias(db database.DB) func(context.Context, *obtenerPistaInput) (*pistaLicenciasOutput, error) {
	return func(ctx context.Context, in *obtenerPistaInput) (*pistaLicenciasOutput, error) {
		var artistID string
		err := db.QueryRow(ctx, `
			select t.artist_id
			from tracks t
			join artists ar on ar.id = t.artist_id and ar.is_published and ar.deleted_at is null
			where t.id = $1 and t.is_published and t.deleted_at is null`, in.ID,
		).Scan(&artistID)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("pista no encontrada")
		}
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando la pista", err)
		}

		out := &pistaLicenciasOutput{}
		out.Body.Opciones = []licenciaOpcionPublica{}

		rows, err := db.Query(ctx, `
			select id, use_code, add_on_amount_minor, currency
			from track_license_options
			where track_id = $1 and enabled
			order by use_code`, in.ID)
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando las licencias de la pista", err)
		}
		defer rows.Close()
		for rows.Next() {
			var o licenciaOpcionPublica
			if err := rows.Scan(&o.ID, &o.Uso, &o.MontoMinor, &o.Moneda); err != nil {
				return nil, huma.Error500InternalServerError("error leyendo las licencias", err)
			}
			out.Body.Opciones = append(out.Body.Opciones, o)
		}
		if err := rows.Err(); err != nil {
			return nil, huma.Error500InternalServerError("error leyendo las licencias", err)
		}
		rows.Close()

		out.Body.Elegible = len(out.Body.Opciones) > 0

		var t licenciaTerminosPublicos
		err = db.QueryRow(ctx, `
			select id, version_label, terms_text, published_at
			from license_terms_versions
			where artist_id = $1
			order by published_at desc limit 1`, artistID,
		).Scan(&t.VersionID, &t.Etiqueta, &t.Texto, &t.PublicadoEn)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error500InternalServerError("error consultando los términos", err)
		}
		if err == nil {
			out.Body.Terminos = &t
		}
		return out, nil
	}
}

// ── Licencias en la creación de órdenes ────────────────────────────────────

// licenciaSolicitada es una opción de licencia validada, lista para congelar
// como ítem de orden con su snapshot de términos y usos aceptados.
type licenciaSolicitada struct {
	OpcionID         string
	TrackID          string
	ArtistaID        string
	Uso              string
	MontoMinor       int64
	Moneda           string
	TerminosID       string
	TerminosEtiqueta string
}

var uuidRe = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// resolverLicencias valida las opciones solicitadas contra el contenido
// congelado de la oferta: la opción debe estar habilitada, su pista publicada
// y pertenecer al contenido de la orden; la moneda debe coincidir y cada
// artista implicado debe tener términos publicados, aceptados por el
// comprador con acepta_terminos=true.
func resolverLicencias(ctx context.Context, db database.DB, productType, currency string, contenido []contenidoPista, ids []string, acepta bool) ([]licenciaSolicitada, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	if !acepta {
		return nil, huma.Error422UnprocessableEntity("debes aceptar los términos de licencia (acepta_terminos=true)")
	}
	if productType == "premium" {
		return nil, huma.Error422UnprocessableEntity("las órdenes premium no admiten licencias")
	}
	conjunto := map[string]bool{}
	for _, p := range contenido {
		conjunto[p.TrackID] = true
	}
	vistos := map[string]bool{}
	terminosPorArtista := map[string]struct {
		id       string
		etiqueta string
	}{}
	out := []licenciaSolicitada{}
	for _, id := range ids {
		if !uuidRe.MatchString(id) {
			return nil, huma.Error404NotFound("opción de licencia no encontrada")
		}
		if vistos[id] {
			return nil, huma.Error422UnprocessableEntity("no se permite repetir la misma opción de licencia")
		}
		vistos[id] = true

		var l licenciaSolicitada
		var habilitada, publicada bool
		err := db.QueryRow(ctx, `
			select tlo.id, tlo.track_id, tlo.use_code, tlo.add_on_amount_minor, tlo.currency, tlo.enabled,
			       t.artist_id, t.is_published
			from track_license_options tlo
			join tracks t on t.id = tlo.track_id
			where tlo.id = $1`, id).Scan(&l.OpcionID, &l.TrackID, &l.Uso, &l.MontoMinor, &l.Moneda,
			&habilitada, &l.ArtistaID, &publicada)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("opción de licencia no encontrada")
		}
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando la opción de licencia", err)
		}
		switch {
		case !habilitada:
			return nil, huma.Error409Conflict("la opción de licencia no está habilitada")
		case !publicada:
			return nil, huma.Error409Conflict("la pista de la licencia no está publicada")
		case !conjunto[l.TrackID]:
			return nil, huma.Error422UnprocessableEntity("la licencia no corresponde a una pista de esta oferta")
		case l.Moneda != currency:
			return nil, huma.Error422UnprocessableEntity("la moneda de la licencia no coincide con la de la orden")
		}

		terminos, ok := terminosPorArtista[l.ArtistaID]
		if !ok {
			err := db.QueryRow(ctx, `
				select id, version_label from license_terms_versions
				where artist_id = $1 order by published_at desc limit 1`, l.ArtistaID).
				Scan(&terminos.id, &terminos.etiqueta)
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, huma.Error409Conflict("el artista no tiene términos de licencia publicados")
			}
			if err != nil {
				return nil, huma.Error500InternalServerError("error consultando los términos de licencia", err)
			}
			terminosPorArtista[l.ArtistaID] = terminos
		}
		l.TerminosID = terminos.id
		l.TerminosEtiqueta = terminos.etiqueta
		out = append(out, l)
	}
	return out, nil
}

// insertarItemsLicencia congela cada licencia como ítem de orden separado con
// su license_snapshot (usos, precio y términos aceptados). El ítem de licencia
// nunca crea entitlement de audio: efectos disjuntos por tipo de línea.
func insertarItemsLicencia(ctx context.Context, q database.Querier, orderID string, licencias []licenciaSolicitada) error {
	for _, l := range licencias {
		productSnapshot, _ := json.Marshal(map[string]any{
			"tipo": "licencia", "opcion_id": l.OpcionID, "uso": l.Uso,
		})
		contentSnapshot, _ := json.Marshal(map[string]any{
			"tipo": "licencia", "track_id": l.TrackID,
		})
		licenseSnapshot, _ := json.Marshal(map[string]any{
			"opcion_id": l.OpcionID, "use_code": l.Uso,
			"monto_minor": l.MontoMinor, "moneda": l.Moneda,
			"track_id": l.TrackID, "artist_id": l.ArtistaID,
			"terminos_version_id": l.TerminosID, "terminos_etiqueta": l.TerminosEtiqueta,
			"aceptado_en": time.Now(),
		})
		if _, err := q.Exec(ctx, `
			insert into order_items
				(order_id, product_id, offer_id, track_id, product_snapshot, content_snapshot,
				 license_snapshot, quantity, unit_amount_minor, line_total_minor)
			values ($1, null, null, $2, $3, $4, $5, 1, $6, $6)`,
			orderID, l.TrackID, productSnapshot, contentSnapshot, licenseSnapshot, l.MontoMinor); err != nil {
			return huma.Error500InternalServerError("error guardando la licencia de la orden", err)
		}
	}
	return nil
}

// registrarAceptaciones deja una fila de aceptación por versión de términos
// implicada en la orden (varias licencias del mismo artista comparten la
// aceptación de su versión vigente).
func registrarAceptaciones(ctx context.Context, q database.Querier, orderID, userID string, licencias []licenciaSolicitada) error {
	vistos := map[string]bool{}
	for _, l := range licencias {
		if vistos[l.TerminosID] {
			continue
		}
		vistos[l.TerminosID] = true
		if _, err := q.Exec(ctx, `
			insert into license_acceptances (order_id, terms_version_id, user_id)
			values ($1, $2, $3)
			on conflict do nothing`, orderID, l.TerminosID, userID); err != nil {
			return huma.Error500InternalServerError("error registrando la aceptación de términos", err)
		}
	}
	return nil
}
