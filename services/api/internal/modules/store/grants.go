package store

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"

	"triomision/api/internal/database"
)

// Helpers de concesión de acceso compartidos por la aprobación de pagos
// (staff) y los canjes: son los únicos puntos que crean suscripciones o
// entitlements. Todos son idempotentes (ON CONFLICT DO NOTHING sobre los
// índices únicos parciales) y reciben la transacción activa.

// ConcederPremium inserta la suscripción con la duración congelada por quien
// concede el beneficio. Si ya tiene un período vigente, la nueva suscripción
// lo extiende (empieza donde termina el actual). Repetir la operación con el
// mismo order_item o redención nunca duplica el período.
func ConcederPremium(ctx context.Context, q database.Querier, userID, planID string, durationDays int, orderItemID, redemptionID *string, fuente string) (bool, error) {
	var id string
	err := q.QueryRow(ctx, `
		insert into subscriptions (user_id, plan_id, order_item_id, redemption_id, grant_source, period_start, period_end)
		select $1, $2, $3, $4, $5, now(),
		       coalesce((select max(s.period_end) from subscriptions s
		                 where s.user_id = $1 and s.status = 'active' and s.period_end > now()), now())
		       + make_interval(days => $6)
		on conflict do nothing
		returning id`, userID, planID, orderItemID, redemptionID, fuente, durationDays).Scan(&id)
	if err == pgx.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

// ConcederPistasSnapshot otorga entitlements de las pistas congeladas en el
// snapshot de contenido de una orden (content_snapshot con "track_id" plano
// o con arreglo "pistas"). Es la vía para include_future_tracks=false.
func ConcederPistasSnapshot(ctx context.Context, q database.Querier, userID string, orderItemID *string, contentSnapshot json.RawMessage, fuente string) (int64, error) {
	tag, err := q.Exec(ctx, `
		insert into entitlements (user_id, order_item_id, track_id, grant_source)
		select $1, $2, coalesce(snapshot->>'track_id', pista->>'track_id')::uuid, $3
		from (select $4::jsonb as snapshot) s
		left join lateral jsonb_array_elements(snapshot->'pistas') pista on true
		on conflict do nothing`, userID, orderItemID, fuente, contentSnapshot)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

// ConcederPistasProducto otorga entitlements de las pistas publicadas
// vigentes de un producto. Es la vía de los canjes de paquete y de las
// órdenes con include_future_tracks=true (contenido al aprobar).
func ConcederPistasProducto(ctx context.Context, q database.Querier, userID, productID string, orderItemID, redemptionID *string, fuente string) (int64, error) {
	tag, err := q.Exec(ctx, `
		insert into entitlements (user_id, order_item_id, track_id, grant_source, redemption_id)
		select $1, $2, t.id, $3, $4
		from product_items pi
		join tracks t on t.id = pi.track_id and t.is_published and t.deleted_at is null
		where pi.product_id = $5
		on conflict do nothing`, userID, orderItemID, fuente, redemptionID, productID)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

// ConcederLicencia otorga el permiso adicional congelado en el
// license_snapshot de un ítem de licencia: inserta el grant con sus usos y
// condiciones aceptadas. Idempotente por order_item_id (índice único
// parcial): ni la doble aprobación ni una carrera de dos clics duplican la
// licencia del mismo ítem. Jamás crea entitlements de audio: la licencia es
// un efecto separado de la compra del audio.
func ConcederLicencia(ctx context.Context, q database.Querier, userID, orderItemID string, snapshot json.RawMessage) (bool, error) {
	var s struct {
		TrackID  string `json:"track_id"`
		OpcionID string `json:"opcion_id"`
		Terminos string `json:"terminos_version_id"`
	}
	if err := json.Unmarshal(snapshot, &s); err != nil || s.TrackID == "" {
		return false, errors.New("snapshot de licencia inválido")
	}
	var id string
	err := q.QueryRow(ctx, `
		insert into license_grants (user_id, track_id, order_item_id, license_option_id, terms_version_id, accepted_uses)
		values ($1, $2, $3, $4, $5, $6)
		on conflict do nothing
		returning id`, userID, s.TrackID, orderItemID, uuidPtr(s.OpcionID), uuidPtr(s.Terminos), snapshot).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

// uuidPtr convierte un UUID en texto a puntero (nil cuando viene vacío).
func uuidPtr(id string) *string {
	if id == "" {
		return nil
	}
	return &id
}
