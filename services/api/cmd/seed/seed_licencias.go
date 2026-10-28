package main

import (
	"context"
	"fmt"
	"log"

	"github.com/jackc/pgx/v5"
)

// UUIDs fijos del demo de licencias del Sprint 3C.2: reproducibles entre
// entornos y referenciables desde la colección Bruno tras un reset. La pista
// demo 2 (…0213) queda sin opciones a propósito: es el caso "no elegible".
const (
	perfilLicenciasID = "00000000-0000-4000-8000-000000000222"
	terminosV1ID      = "00000000-0000-4000-8000-000000000223"
	opcionGrabVozID   = "00000000-0000-4000-8000-000000000224"
	opcionPublicarID  = "00000000-0000-4000-8000-000000000225"
)

// artistaDemoID es el artista trio-mision sembrado en seedCatalog.
const artistaDemoID = "00000000-0000-4000-8000-000000000001"

// seedLicencias carga el demo del Sprint 3C.2: perfil de permisos del artista
// demo (plantilla), términos de licencia v1 y dos opciones elegibles en la
// pista demo (grabación vocal y publicación). No requiere S3: la pista demo
// existe aunque la tienda no se haya sembrado con archivos. Idempotente.
func seedLicencias(ctx context.Context, tx pgx.Tx) error {
	if _, err := tx.Exec(ctx, `
		insert into artist_license_profiles (artist_id, default_permissions)
		values ($1, '{"interpretacion": {"monto_minor": 500, "moneda": "BOB"},
		             "grabacion_vocal": {"monto_minor": 800, "moneda": "BOB"},
		             "publicacion": {"monto_minor": 1500, "moneda": "BOB"}}'::jsonb)
		on conflict (artist_id) do update set default_permissions = excluded.default_permissions`,
		artistaDemoID); err != nil {
		return fmt.Errorf("perfil de licencias: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		insert into license_terms_versions (id, artist_id, version_label, terms_text)
		values ($1, $2, 'v1',
			'Permiso no exclusivo y limitado al uso adquirido sobre la pista indicada. ' ||
			'La compra no transfiere autoría ni copropiedad de la obra ni de la grabación. ' ||
			'Cada uso concreto (grabación vocal, publicación, monetización) requiere su permiso ' ||
			'correspondiente y queda sujeto a los derechos que el artista puede conceder. ' ||
			'La descarga del audio por sí sola no habilita ningún permiso adicional.')
		on conflict (id) do update set version_label = excluded.version_label,
			terms_text = excluded.terms_text`,
		terminosV1ID, artistaDemoID); err != nil {
		return fmt.Errorf("términos de licencia v1: %w", err)
	}

	opciones := []struct {
		id, uso string
		monto   int64
	}{
		{opcionGrabVozID, "grabacion_vocal", 800},
		{opcionPublicarID, "publicacion", 1500},
	}
	for _, o := range opciones {
		if _, err := tx.Exec(ctx, `
			insert into track_license_options (id, track_id, use_code, add_on_amount_minor, currency, enabled)
			values ($1, $2, $3, $4, 'BOB', true)
			on conflict (id) do update set use_code = excluded.use_code,
				add_on_amount_minor = excluded.add_on_amount_minor, currency = excluded.currency,
				enabled = true`,
			o.id, trackDemoID, o.uso, o.monto); err != nil {
			return fmt.Errorf("opción %s: %w", o.uso, err)
		}
	}

	log.Printf("licencias: perfil y términos v1 del artista demo; opciones grabacion_vocal (800) y publicacion (1500) en la pista %s", trackDemoID)
	return nil
}
