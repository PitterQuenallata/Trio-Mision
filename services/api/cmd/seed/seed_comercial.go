package main

import (
	"context"
	"fmt"
	"log"

	"github.com/jackc/pgx/v5"
)

// UUIDs fijos del demo comercial del Sprint 3C.1: reproducibles entre
// entornos y referenciables desde la colección Bruno tras un reset.
const (
	planPremiumID  = "00000000-0000-4000-8000-000000000209"
	productoPremID = "00000000-0000-4000-8000-000000000210"
	ofertaPremID   = "00000000-0000-4000-8000-000000000211"
	productoPaqID  = "00000000-0000-4000-8000-000000000216"
	cuponPctID     = "00000000-0000-4000-8000-000000000218"
	cuponFijoID    = "00000000-0000-4000-8000-000000000219"
	codigoPremID   = "00000000-0000-4000-8000-000000000220"
	codigoPaqID    = "00000000-0000-4000-8000-000000000221"
)

// seedComercial carga el demo del Sprint 3C.1: plan Premium 30 días con su
// producto y oferta, cupones fijo/porcentual y códigos de canje (premium y
// paquete, este último solo si el paquete de dos pistas existe, es decir, si
// había S3 al sembrar la tienda). No requiere S3. Idempotente.
func seedComercial(ctx context.Context, tx pgx.Tx) error {
	if _, err := tx.Exec(ctx, `
		insert into plans (id, code, name, description, duration_days, benefits, active)
		values ($1, 'premium-30', 'Premium 30 días',
			'Acceso Premium: contenido autorizado, offline cifrado y sync según política. No incluye audio descargable ni permisos de uso.',
			30,
			'{"contenido_autorizado": true, "offline_cifrado": true, "sync_mi_musica": true, "limite_dispositivos": 3}'::jsonb,
			true)
		on conflict (id) do update set name = excluded.name, description = excluded.description,
			duration_days = excluded.duration_days, benefits = excluded.benefits, active = true`,
		planPremiumID); err != nil {
		return fmt.Errorf("plan premium: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		insert into products (id, artist_id, product_type, title, description, active, plan_id)
		values ($1, null, 'premium', 'Premium 30 días',
			'Suscripción temporal Premium de 30 días. No concede audio descargable ni licencias.', true, $2)
		on conflict (id) do update set title = excluded.title, description = excluded.description,
			active = true, plan_id = excluded.plan_id`,
		productoPremID, planPremiumID); err != nil {
		return fmt.Errorf("producto premium: %w", err)
	}
	if _, err := tx.Exec(ctx, `
		insert into offers (id, product_id, amount_minor, currency, sales_channel, active)
		values ($1, $2, 5000, 'BOB', 'web', true)
		on conflict (id) do update set amount_minor = excluded.amount_minor, active = true`,
		ofertaPremID, productoPremID); err != nil {
		return fmt.Errorf("oferta premium: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		insert into coupons (id, code, description, discount_type, percent_off, max_uses_total, max_uses_per_user, active)
		values ($1, 'BIENVENIDA10', '10% de descuento de bienvenida', 'percent', 10, 1000, 5, true)
		on conflict (id) do update set description = excluded.description, percent_off = excluded.percent_off,
			max_uses_total = excluded.max_uses_total, max_uses_per_user = excluded.max_uses_per_user, active = true`,
		cuponPctID); err != nil {
		return fmt.Errorf("cupón porcentual: %w", err)
	}
	if _, err := tx.Exec(ctx, `
		insert into coupons (id, code, description, discount_type, amount_minor, currency, min_subtotal_minor, max_uses_total, max_uses_per_user, active)
		values ($1, 'FIJO500', '500 BOB de descuento en compras desde 1000 BOB', 'fixed', 500, 'BOB', 1000, 500, 1, true)
		on conflict (id) do update set description = excluded.description, amount_minor = excluded.amount_minor,
			min_subtotal_minor = excluded.min_subtotal_minor, max_uses_total = excluded.max_uses_total,
			max_uses_per_user = excluded.max_uses_per_user, active = true`,
		cuponFijoID); err != nil {
		return fmt.Errorf("cupón fijo: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		insert into redemption_codes (id, code, description, grant_type, plan_id, max_uses, active)
		values ($1, 'PREMIUM-DEMO', 'Canje demo: 30 días de Premium sin pago', 'premium', $2, 500, true)
		on conflict (id) do update set description = excluded.description, plan_id = excluded.plan_id,
			max_uses = excluded.max_uses, active = true`,
		codigoPremID, planPremiumID); err != nil {
		return fmt.Errorf("código de canje premium: %w", err)
	}

	// El código de paquete solo tiene sentido si la tienda se sembró con S3
	// (el paquete de dos pistas vive en seedStore).
	var paqueteExiste bool
	if err := tx.QueryRow(ctx, `select exists(select 1 from products where id = $1)`, productoPaqID).Scan(&paqueteExiste); err != nil {
		return fmt.Errorf("verificar paquete: %w", err)
	}
	if paqueteExiste {
		if _, err := tx.Exec(ctx, `
			insert into redemption_codes (id, code, description, grant_type, product_id, max_uses, active)
			values ($1, 'PAQUETE-DEMO', 'Canje demo: paquete de dos pistas sin pago', 'package', $2, 500, true)
			on conflict (id) do update set description = excluded.description, product_id = excluded.product_id,
				max_uses = excluded.max_uses, active = true`,
			codigoPaqID, productoPaqID); err != nil {
			return fmt.Errorf("código de canje paquete: %w", err)
		}
	}

	logLine := "comercial: plan premium-30, oferta premium (5000 BOB), cupones BIENVENIDA10/FIJO500, código PREMIUM-DEMO"
	if paqueteExiste {
		logLine += ", código PAQUETE-DEMO"
	}
	log.Print(logLine)
	return nil
}
