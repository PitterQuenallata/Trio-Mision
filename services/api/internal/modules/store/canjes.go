// Canjes de códigos: conceden un período Premium o entitlements de un paquete
// con grant_source=redemption, sin crear pago. Transaccional e idempotente:
// el mismo usuario no canjea dos veces el mismo código (ni consume dos usos)
// y la clave de cliente no se reutiliza con otro código.
package store

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"triomision/api/internal/auth"
	"triomision/api/internal/database"
)

type canjearInput struct {
	Body struct {
		Codigo         string `json:"codigo" minLength:"3" maxLength:"64" doc:"Código de canje"`
		IdempotencyKey string `json:"idempotency_key" minLength:"8" maxLength:"128" doc:"Clave de cliente para no duplicar el canje ante reintentos"`
	}
}

type canjeOut struct {
	RedencionID       string          `json:"redencion_id"`
	Codigo            string          `json:"codigo"`
	Tipo              string          `json:"tipo" doc:"premium | package"`
	YaCanjeado        bool            `json:"ya_canjeado" doc:"true cuando el canje ya existía (idempotente); no crea nada nuevo"`
	SuscripcionID     *string         `json:"suscripcion_id,omitempty" doc:"Suscripción creada (códigos premium)"`
	SuscripcionCreada bool            `json:"suscripcion_creada" doc:"false cuando el canje ya existía o ya tenía período vigente"`
	AccesosCreados    int             `json:"accesos_creados" doc:"Entitlements nuevos (códigos de paquete)"`
	ConcedidoEn       time.Time       `json:"concedido_en"`
	Contenido         json.RawMessage `json:"contenido" doc:"Plan o pistas congelados al canjear"`
}

type canjearOutput struct {
	Body canjeOut
}

// canjearCode normaliza el código: mayúsculas sin espacios.
func canjearCode(codigo string) string {
	return strings.ToUpper(strings.TrimSpace(codigo))
}

// canjear aplica un código de canje: valida vigencia y límites (con lock),
// concede suscripción o entitlements y audita, todo en una transacción.
func canjear(db database.DB) func(context.Context, *canjearInput) (*canjearOutput, error) {
	return func(ctx context.Context, in *canjearInput) (*canjearOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}
		userID := claims.Subject
		if _, err := ensureProfile(ctx, db, userID, claims.Email); err != nil {
			return nil, huma.Error500InternalServerError("error asegurando el perfil", err)
		}

		codigo := canjearCode(in.Body.Codigo)

		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, huma.Error500InternalServerError("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)

		// Idempotencia de cliente: la clave ya se usó para este usuario.
		var existenteID, existenteCodeID string
		err = tx.QueryRow(ctx, `
			select r.id, r.code_id from redemptions r
			where r.user_id = $1 and r.idempotency_key = $2`, userID, in.Body.IdempotencyKey,
		).Scan(&existenteID, &existenteCodeID)
		if err == nil {
			return respuestaCanjeExistente(ctx, existenteID, userID, in, tx)
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error500InternalServerError("error consultando el canje", err)
		}

		// Código de canje con lock: serializa usos concurrentes del mismo código.
		var (
			codeID, grantType  string
			planID, productID  *string
			maxUses, usedCount int
			active             bool
			startsAt, endsAt   *time.Time
		)
		err = tx.QueryRow(ctx, `
			select id, grant_type, plan_id, product_id, max_uses, used_count, active, starts_at, ends_at
			from redemption_codes where code = $1
			for update`, codigo,
		).Scan(&codeID, &grantType, &planID, &productID, &maxUses, &usedCount, &active, &startsAt, &endsAt)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("código de canje no encontrado")
		}
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando el código", err)
		}

		// Idempotencia natural: mismo usuario + mismo código devuelve el canje
		// original sin consumir otro uso ni duplicar efectos.
		var yaCanjeada string
		err = tx.QueryRow(ctx, `select id from redemptions where code_id = $1 and user_id = $2`,
			codeID, userID).Scan(&yaCanjeada)
		if err == nil {
			return respuestaCanjeExistente(ctx, yaCanjeada, userID, in, tx)
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error500InternalServerError("error consultando el canje", err)
		}

		ahora := time.Now()
		switch {
		case !active:
			return nil, huma.Error409Conflict("el código de canje está inactivo")
		case startsAt != nil && startsAt.After(ahora):
			return nil, huma.Error409Conflict("el código de canje aún no está vigente")
		case endsAt != nil && !endsAt.After(ahora):
			return nil, huma.Error409Conflict("el código de canje está vencido")
		case usedCount >= maxUses:
			return nil, huma.Error409Conflict("el código de canje agotó sus usos")
		}

		// Contenido congelado y concesión según el tipo de código.
		var contentSnapshot json.RawMessage
		accesosCreados := 0
		duracion := 0
		switch grantType {
		case "premium":
			if planID == nil {
				return nil, huma.Error409Conflict("el código no tiene un plan asociado")
			}
			var (
				planCode, planName string
				beneficios         json.RawMessage
				planActive         bool
			)
			if err := tx.QueryRow(ctx, `select code, name, duration_days, benefits, active from plans where id = $1`, *planID).
				Scan(&planCode, &planName, &duracion, &beneficios, &planActive); err != nil {
				return nil, huma.Error409Conflict("el plan del código no existe")
			}
			if !planActive {
				return nil, huma.Error409Conflict("el plan del código está inactivo")
			}
			contentSnapshot, _ = json.Marshal(map[string]any{
				"plan": map[string]any{
					"plan_id":       *planID,
					"codigo":        planCode,
					"nombre":        planName,
					"duracion_dias": duracion,
					"beneficios":    beneficios,
				},
			})
		case "package":
			if productID == nil {
				return nil, huma.Error409Conflict("el código no tiene un producto asociado")
			}
			var productActive bool
			if err := tx.QueryRow(ctx, `select active from products where id = $1`, *productID).Scan(&productActive); err != nil {
				return nil, huma.Error409Conflict("el producto del código no existe")
			}
			if !productActive {
				return nil, huma.Error409Conflict("el producto del código está inactivo")
			}
			pistas, err := pistasPublicadas(ctx, tx, *productID)
			if err != nil {
				return nil, err
			}
			if len(pistas) == 0 {
				return nil, huma.Error409Conflict("el paquete del código no tiene contenido publicado")
			}
			contentSnapshot, _ = json.Marshal(map[string]any{"pistas": pistas})
		default:
			return nil, huma.Error409Conflict("tipo de canje no soportado")
		}

		var redemptionID string
		var concedidoEn time.Time
		err = tx.QueryRow(ctx, `
			insert into redemptions (code_id, user_id, idempotency_key, content_snapshot)
			values ($1, $2, $3, $4)
			returning id, created_at`, codeID, userID, in.Body.IdempotencyKey, contentSnapshot,
		).Scan(&redemptionID, &concedidoEn)
		if err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23505" {
				return nil, huma.Error409Conflict("el código ya fue canjeado o la clave idempotente ya fue usada")
			}
			return nil, huma.Error500InternalServerError("error registrando el canje", err)
		}

		suscripcionCreada := false
		switch grantType {
		case "premium":
			creada, err := ConcederPremium(ctx, tx, userID, *planID, duracion, nil, &redemptionID, "redemption")
			if err != nil {
				return nil, huma.Error500InternalServerError("error concediendo el período premium", err)
			}
			suscripcionCreada = creada
		case "package":
			n, err := ConcederPistasProducto(ctx, tx, userID, *productID, nil, &redemptionID, "redemption")
			if err != nil {
				return nil, huma.Error500InternalServerError("error concediendo el acceso", err)
			}
			accesosCreados = int(n)
		}

		if _, err := tx.Exec(ctx, `update redemption_codes set used_count = used_count + 1 where id = $1`, codeID); err != nil {
			return nil, huma.Error500InternalServerError("error actualizando el código", err)
		}
		if _, err := tx.Exec(ctx, `
			insert into audit_events (actor_id, action, entity_type, entity_id, metadata)
			values ($1, 'canje.canjeado', 'redemption_code', $2, $3)`,
			userID, codeID, map[string]any{"redencion_id": redemptionID, "usuario_id": userID, "tipo": grantType}); err != nil {
			return nil, huma.Error500InternalServerError("error registrando auditoría", err)
		}

		if err := tx.Commit(ctx); err != nil {
			return nil, huma.Error500InternalServerError("error confirmando la transacción", err)
		}

		out := &canjearOutput{}
		out.Body = canjeOut{
			RedencionID:       redemptionID,
			Codigo:            codigo,
			Tipo:              grantType,
			YaCanjeado:        false,
			SuscripcionCreada: suscripcionCreada,
			AccesosCreados:    accesosCreados,
			ConcedidoEn:       concedidoEn,
			Contenido:         contentSnapshot,
		}
		if grantType == "premium" {
			var real string
			if err := db.QueryRow(ctx, `select id from subscriptions where redemption_id = $1`, redemptionID).Scan(&real); err == nil {
				out.Body.SuscripcionID = &real
			}
		}
		return out, nil
	}
}

// respuestaCanjeExistente construye la respuesta idempotente de un canje ya
// realizado (mismo usuario, mismo código o misma clave de cliente) y confirma
// la transacción sin crear ni consumir nada.
func respuestaCanjeExistente(ctx context.Context, redemptionID, userID string, in *canjearInput, tx pgx.Tx) (*canjearOutput, error) {
	var (
		codigo, grantType string
		concedidoEn       time.Time
		contenido         json.RawMessage
	)
	err := tx.QueryRow(ctx, `
		select rc.code, rc.grant_type, r.created_at, r.content_snapshot
		from redemptions r join redemption_codes rc on rc.id = r.code_id
		where r.id = $1 and r.user_id = $2`, redemptionID, userID,
	).Scan(&codigo, &grantType, &concedidoEn, &contenido)
	if err != nil {
		return nil, huma.Error500InternalServerError("error consultando el canje", err)
	}
	// La clave de cliente no se reutiliza con otro código.
	if !strings.EqualFold(codigo, in.Body.Codigo) {
		return nil, huma.Error409Conflict("la clave idempotente ya fue usada con otro código de canje")
	}
	out := &canjearOutput{}
	out.Body = canjeOut{
		RedencionID:    redemptionID,
		Codigo:         codigo,
		Tipo:           grantType,
		YaCanjeado:     true,
		AccesosCreados: 0,
		ConcedidoEn:    concedidoEn,
		Contenido:      contenido,
	}
	if grantType == "premium" {
		var real string
		if err := tx.QueryRow(ctx, `select id from subscriptions where redemption_id = $1`, redemptionID).Scan(&real); err == nil {
			out.Body.SuscripcionID = &real
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, huma.Error500InternalServerError("error confirmando la transacción", err)
	}
	return out, nil
}
