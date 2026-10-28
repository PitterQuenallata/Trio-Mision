// Package store implementa la tienda: ofertas públicas (audio, paquetes y
// premium), planes Premium, órdenes con snapshot congelado y totales
// calculados en backend (cupones opcionales), intentos de pago
// QR/transferencia, comprobantes privados, canjes de códigos y descarga
// firmada para quien tiene entitlement vigente.
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
	"triomision/api/internal/storage"
)

// ofertaItem es la respuesta pública de una oferta comprable.
type ofertaItem struct {
	ID          string          `json:"id"`
	Titulo      string          `json:"titulo"`
	Descripcion string          `json:"descripcion,omitempty"`
	MontoMinor  int64           `json:"monto_minor" example:"1500"`
	Moneda      string          `json:"moneda" example:"BOB" doc:"ISO 4217"`
	Producto    productoResumen `json:"producto"`
	Pista       *pistaResumen   `json:"pista,omitempty" doc:"Primera pista publicada (ofertas de audio)"`
	PistasTotal int             `json:"pistas_total" doc:"Cantidad de pistas publicadas del producto"`
	Plan        *planResumen    `json:"plan,omitempty" doc:"Plan Premium (solo ofertas premium)"`
}

type productoResumen struct {
	ID   string `json:"id"`
	Tipo string `json:"tipo" doc:"track | album | catalog | premium"`
}

type pistaResumen struct {
	ID         string `json:"id"`
	Titulo     string `json:"titulo"`
	Artista    string `json:"artista"`
	PreviewURL string `json:"preview_url,omitempty" doc:"URL pública del preview"`
}

type planResumen struct {
	ID           string          `json:"id"`
	Codigo       string          `json:"codigo"`
	Nombre       string          `json:"nombre"`
	DuracionDias int             `json:"duracion_dias"`
	Beneficios   json.RawMessage `json:"beneficios"`
}

type listarOfertasOutput struct {
	Body struct {
		Ofertas []ofertaItem `json:"ofertas"`
	}
}

// listarOfertas expone las ofertas vigentes: oferta activa, producto activo,
// con al menos una pista publicada (audio) o plan activo (premium). Los
// importes son enteros en unidades menores.
func listarOfertas(db database.DB, store storage.Client) func(context.Context, *struct{}) (*listarOfertasOutput, error) {
	return func(ctx context.Context, _ *struct{}) (*listarOfertasOutput, error) {
		out := &listarOfertasOutput{}
		out.Body.Ofertas = []ofertaItem{}

		audio, err := ofertasAudio(ctx, db, store)
		if err != nil {
			return nil, err
		}
		out.Body.Ofertas = append(out.Body.Ofertas, audio...)

		premium, err := ofertasPremium(ctx, db)
		if err != nil {
			return nil, err
		}
		out.Body.Ofertas = append(out.Body.Ofertas, premium...)
		return out, nil
	}
}

// ofertasAudio lista las ofertas de productos de audio: una fila por oferta,
// con la primera pista publicada como representante y el total de pistas del
// paquete (pistas_total).
func ofertasAudio(ctx context.Context, db database.DB, store storage.Client) ([]ofertaItem, error) {
	rows, err := db.Query(ctx, `
		select o.id, p.title, coalesce(p.description, ''),
		       o.amount_minor, o.currency, p.id, p.product_type,
		       t.id, t.title, ar.name, coalesce(prev.storage_key, ''),
		       (select count(distinct pi2.track_id)
		          from product_items pi2
		          join tracks t2 on t2.id = pi2.track_id and t2.is_published and t2.deleted_at is null
		         where pi2.product_id = p.id)
		from offers o
		join products p on p.id = o.product_id and p.active
		join lateral (
			select pi.track_id
			from product_items pi
			join tracks tv on tv.id = pi.track_id and tv.is_published and tv.deleted_at is null
			where pi.product_id = p.id
			order by pi.sort_order
			limit 1
		) primero on true
		join tracks t on t.id = primero.track_id
		join artists ar on ar.id = t.artist_id and ar.is_published and ar.deleted_at is null
		left join track_media tm on tm.track_id = t.id and tm.role = 'preview' and tm.is_published
		left join media_assets prev on prev.id = tm.media_asset_id
		                         and prev.visibility = 'public' and prev.deleted_at is null
		where p.product_type <> 'premium'
		  and o.active
		  and (o.starts_at is null or o.starts_at <= now())
		  and (o.ends_at is null or o.ends_at > now())
		order by p.title, o.amount_minor`)
	if err != nil {
		return nil, huma.Error500InternalServerError("error consultando las ofertas de audio", err)
	}
	defer rows.Close()

	ofertas := []ofertaItem{}
	for rows.Next() {
		var o ofertaItem
		var previewKey string
		o.Pista = &pistaResumen{}
		if err := rows.Scan(&o.ID, &o.Titulo, &o.Descripcion, &o.MontoMinor, &o.Moneda,
			&o.Producto.ID, &o.Producto.Tipo,
			&o.Pista.ID, &o.Pista.Titulo, &o.Pista.Artista, &previewKey,
			&o.PistasTotal); err != nil {
			return nil, huma.Error500InternalServerError("error leyendo las ofertas", err)
		}
		if previewKey != "" {
			o.Pista.PreviewURL = store.PublicURL(previewKey)
		}
		ofertas = append(ofertas, o)
	}
	if err := rows.Err(); err != nil {
		return nil, huma.Error500InternalServerError("error leyendo las ofertas", err)
	}
	return ofertas, nil
}

// ofertasPremium lista las ofertas de productos premium con su plan.
func ofertasPremium(ctx context.Context, db database.DB) ([]ofertaItem, error) {
	rows, err := db.Query(ctx, `
		select o.id, p.title, coalesce(p.description, ''),
		       o.amount_minor, o.currency, p.id, p.product_type,
		       pl.id, pl.code, pl.name, pl.duration_days, pl.benefits
		from offers o
		join products p on p.id = o.product_id and p.active and p.product_type = 'premium'
		join plans pl on pl.id = p.plan_id and pl.active
		where o.active
		  and (o.starts_at is null or o.starts_at <= now())
		  and (o.ends_at is null or o.ends_at > now())
		order by p.title, o.amount_minor`)
	if err != nil {
		return nil, huma.Error500InternalServerError("error consultando las ofertas premium", err)
	}
	defer rows.Close()

	ofertas := []ofertaItem{}
	for rows.Next() {
		var o ofertaItem
		o.Plan = &planResumen{}
		if err := rows.Scan(&o.ID, &o.Titulo, &o.Descripcion, &o.MontoMinor, &o.Moneda,
			&o.Producto.ID, &o.Producto.Tipo,
			&o.Plan.ID, &o.Plan.Codigo, &o.Plan.Nombre, &o.Plan.DuracionDias, &o.Plan.Beneficios); err != nil {
			return nil, huma.Error500InternalServerError("error leyendo las ofertas premium", err)
		}
		ofertas = append(ofertas, o)
	}
	if err := rows.Err(); err != nil {
		return nil, huma.Error500InternalServerError("error leyendo las ofertas premium", err)
	}
	return ofertas, nil
}

type obtenerPistaInput struct {
	ID string `path:"id" format:"uuid" doc:"ID de la pista"`
}

type obtenerPistaOutput struct {
	Body struct {
		ID          string       `json:"id"`
		Titulo      string       `json:"titulo"`
		Descripcion string       `json:"descripcion,omitempty"`
		Artista     string       `json:"artista"`
		PreviewURL  string       `json:"preview_url,omitempty"`
		Ofertas     []ofertaViva `json:"ofertas" doc:"Ofertas vigentes de esta pista"`
	}
}

type ofertaViva struct {
	ID         string `json:"id"`
	MontoMinor int64  `json:"monto_minor"`
	Moneda     string `json:"moneda"`
}

func obtenerPista(db database.DB, store storage.Client) func(context.Context, *obtenerPistaInput) (*obtenerPistaOutput, error) {
	return func(ctx context.Context, in *obtenerPistaInput) (*obtenerPistaOutput, error) {
		out := &obtenerPistaOutput{}
		out.Body.Ofertas = []ofertaViva{}
		var previewKey string
		err := db.QueryRow(ctx, `
			select t.id, t.title, coalesce(t.description, ''), ar.name,
			       coalesce((select prev.storage_key
			                 from track_media tm
			                 join media_assets prev on prev.id = tm.media_asset_id
			                 where tm.track_id = t.id and tm.role = 'preview' and tm.is_published
			                   and prev.visibility = 'public' and prev.deleted_at is null
			                 limit 1), '')
			from tracks t
			join artists ar on ar.id = t.artist_id and ar.is_published and ar.deleted_at is null
			where t.id = $1 and t.is_published and t.deleted_at is null`, in.ID,
		).Scan(&out.Body.ID, &out.Body.Titulo, &out.Body.Descripcion, &out.Body.Artista, &previewKey)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("pista no encontrada")
		}
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando la pista", err)
		}
		if previewKey != "" {
			out.Body.PreviewURL = store.PublicURL(previewKey)
		}

		rows, err := db.Query(ctx, `
			select o.id, o.amount_minor, o.currency
			from offers o
			join products p on p.id = o.product_id and p.active
			join product_items pi on pi.product_id = p.id
			where pi.track_id = $1
			  and o.active
			  and (o.starts_at is null or o.starts_at <= now())
			  and (o.ends_at is null or o.ends_at > now())
			order by o.amount_minor`, in.ID)
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando las ofertas de la pista", err)
		}
		defer rows.Close()
		for rows.Next() {
			var o ofertaViva
			if err := rows.Scan(&o.ID, &o.MontoMinor, &o.Moneda); err != nil {
				return nil, huma.Error500InternalServerError("error leyendo las ofertas", err)
			}
			out.Body.Ofertas = append(out.Body.Ofertas, o)
		}
		if err := rows.Err(); err != nil {
			return nil, huma.Error500InternalServerError("error leyendo las ofertas", err)
		}
		return out, nil
	}
}

// ── Órdenes ────────────────────────────────────────────────────────────────

type crearOrdenInput struct {
	Body struct {
		OfertaID       string `json:"oferta_id" format:"uuid" doc:"ID de la oferta"`
		IdempotencyKey string `json:"idempotency_key" minLength:"8" maxLength:"128" doc:"Clave de cliente para no duplicar la orden ante reintentos"`
		CouponCode     string `json:"coupon_code,omitempty" maxLength:"64" doc:"Código de cupón opcional; el descuento lo calcula el backend"`
	}
}

type ordenItemOut struct {
	ID              string          `json:"id"`
	OfertaID        *string         `json:"oferta_id,omitempty"`
	ProductSnapshot json.RawMessage `json:"product_snapshot" doc:"Producto congelado al comprar"`
	ContentSnapshot json.RawMessage `json:"content_snapshot" doc:"Contenido (pista o plan y archivos) congelado al comprar"`
	LicenseSnapshot json.RawMessage `json:"license_snapshot,omitempty"`
	Cantidad        int             `json:"cantidad"`
	UnitarioMinor   int64           `json:"unitario_minor"`
	TotalMinor      int64           `json:"total_minor"`
}

type ordenOut struct {
	ID             string         `json:"id"`
	Estado         string         `json:"estado" doc:"pending | paid | cancelled | expired"`
	SubtotalMinor  int64          `json:"subtotal_minor" doc:"Importe de la oferta antes del descuento"`
	DescuentoMinor int64          `json:"descuento_minor" doc:"Descuento calculado por el backend (0 sin cupón)"`
	TotalMinor     int64          `json:"total_minor"`
	Moneda         string         `json:"moneda"`
	CuponCode      *string        `json:"cupon_code,omitempty" doc:"Código del cupón aplicado, si hubo"`
	CreadaEn       time.Time      `json:"creada_en"`
	ExpiraEn       *time.Time     `json:"expira_en,omitempty"`
	PagadaEn       *time.Time     `json:"pagada_en,omitempty"`
	Items          []ordenItemOut `json:"items"`
}

type crearOrdenOutput struct {
	Body ordenOut
}

// mediaRef es un archivo publicado congelado en el snapshot de contenido.
type mediaRef struct {
	ID         string `json:"asset_id"`
	Rol        string `json:"rol"`
	MimeType   string `json:"mime_type"`
	StorageKey string `json:"storage_key"`
}

// contenidoPista es una pista publicada congelada en el snapshot de una orden.
type contenidoPista struct {
	TrackID string     `json:"track_id"`
	Titulo  string     `json:"titulo"`
	Artista string     `json:"artista"`
	Media   []mediaRef `json:"media"`
}

// crearOrden congela oferta + producto + contenido en una orden, con cupón
// opcional validado y descuento calculado en backend. Idempotente por
// (usuario, clave de cliente): un reintento devuelve la orden original;
// reutilizar la clave con otra oferta u otro cupón devuelve 409.
func crearOrden(db database.DB) func(context.Context, *crearOrdenInput) (*crearOrdenOutput, error) {
	return func(ctx context.Context, in *crearOrdenInput) (*crearOrdenOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}
		userID := claims.Subject

		// El perfil debe existir por la FK de orders.user_id.
		if _, err := ensureProfile(ctx, db, userID, claims.Email); err != nil {
			return nil, huma.Error500InternalServerError("error asegurando el perfil", err)
		}

		couponCode := strings.ToUpper(strings.TrimSpace(in.Body.CouponCode))

		// Reintento idempotente: la orden ya existe para esta clave.
		var existingID string
		err := db.QueryRow(ctx,
			`select id from orders where user_id = $1 and idempotency_key = $2`,
			userID, in.Body.IdempotencyKey).Scan(&existingID)
		if err == nil {
			return ordenIdempotenteValidada(ctx, db, existingID, userID, in.Body.OfertaID, couponCode)
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error500InternalServerError("error consultando la orden", err)
		}

		// Oferta vigente con su producto activo.
		var (
			offerID, productID, productType, productTitle, productDesc string
			planID, planCode, planName, planBeneficios                 string
			duracionDias                                               int
			amountMinor                                                int64
			currency                                                   string
		)
		err = db.QueryRow(ctx, `
			select o.id, o.amount_minor, o.currency, p.id, p.product_type, p.title, coalesce(p.description, ''),
			       coalesce(pl.id::text, ''), coalesce(pl.code, ''), coalesce(pl.name, ''),
			       coalesce(pl.duration_days, 0), coalesce(pl.benefits::text, '')
			from offers o
			join products p on p.id = o.product_id and p.active
			left join plans pl on pl.id = p.plan_id
			where o.id = $1 and o.active
			  and (o.starts_at is null or o.starts_at <= now())
			  and (o.ends_at is null or o.ends_at > now())`, in.Body.OfertaID,
		).Scan(&offerID, &amountMinor, &currency, &productID, &productType, &productTitle, &productDesc,
			&planID, &planCode, &planName, &duracionDias, &planBeneficios)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("oferta no encontrada o no vigente")
		}
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando la oferta", err)
		}

		productSnapshot, _ := json.Marshal(map[string]any{
			"product_id": productID, "tipo": productType,
			"titulo": productTitle, "descripcion": productDesc,
		})

		var contentSnapshot json.RawMessage
		var trackID string
		switch productType {
		case "premium":
			if planID == "" {
				return nil, huma.Error409Conflict("el producto premium no tiene un plan activo")
			}
			var beneficios json.RawMessage
			if planBeneficios == "" {
				beneficios = json.RawMessage(`{}`)
			} else {
				beneficios = json.RawMessage(planBeneficios)
			}
			contentSnapshot, _ = json.Marshal(map[string]any{
				"plan": map[string]any{
					"plan_id":       planID,
					"codigo":        planCode,
					"nombre":        planName,
					"duracion_dias": duracionDias,
					"beneficios":    beneficios,
				},
			})
		default:
			// Audio (track/album/catalog): todas las pistas publicadas del
			// producto se congelan en el snapshot (con include_future_tracks).
			var includeFuture bool
			if err := db.QueryRow(ctx, `select include_future_tracks from products where id = $1`, productID).Scan(&includeFuture); err != nil {
				return nil, huma.Error500InternalServerError("error consultando el producto", err)
			}
			pistas, err := pistasPublicadas(ctx, db, productID)
			if err != nil {
				return nil, err
			}
			if len(pistas) == 0 {
				return nil, huma.Error409Conflict("el producto no tiene contenido publicado")
			}
			trackID = pistas[0].TrackID
			if productType == "track" {
				// Formato plano heredado del Sprint 3A (content_snapshot.track_id).
				contentSnapshot, _ = json.Marshal(map[string]any{
					"track_id": pistas[0].TrackID, "titulo": pistas[0].Titulo,
					"artista": pistas[0].Artista, "media": pistas[0].Media,
				})
			} else {
				contentSnapshot, _ = json.Marshal(map[string]any{
					"pistas":                pistas,
					"include_future_tracks": includeFuture,
				})
			}
		}

		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, huma.Error500InternalServerError("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)

		// Cupón: validación y descuento exclusivamente en backend.
		subtotal := amountMinor
		var discount int64
		var couponID *string
		if couponCode != "" {
			var (
				id               string
				tipo             string
				percentOff       *int
				amountOff        *int64
				couponCurrency   *string
				minSubtotal      int64
				maxUsesTotal     *int
				maxUsesPerUser   int
				usedCount        int
				active           bool
				startsAt, endsAt *time.Time
			)
			err = tx.QueryRow(ctx, `
				select id, discount_type, percent_off, amount_minor, currency,
				       min_subtotal_minor, max_uses_total, max_uses_per_user, used_count,
				       active, starts_at, ends_at
				from coupons where code = $1
				for update`, couponCode,
			).Scan(&id, &tipo, &percentOff, &amountOff, &couponCurrency, &minSubtotal,
				&maxUsesTotal, &maxUsesPerUser, &usedCount, &active, &startsAt, &endsAt)
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, huma.Error404NotFound("cupón no encontrado")
			}
			if err != nil {
				return nil, huma.Error500InternalServerError("error consultando el cupón", err)
			}
			ahora := time.Now()
			switch {
			case !active:
				return nil, huma.Error409Conflict("el cupón está inactivo")
			case startsAt != nil && startsAt.After(ahora):
				return nil, huma.Error409Conflict("el cupón aún no está vigente")
			case endsAt != nil && !endsAt.After(ahora):
				return nil, huma.Error409Conflict("el cupón está vencido")
			case maxUsesTotal != nil && usedCount >= *maxUsesTotal:
				return nil, huma.Error409Conflict("el cupón agotó sus usos")
			case minSubtotal > subtotal:
				return nil, huma.Error422UnprocessableEntity("el subtotal no alcanza el mínimo del cupón")
			}
			var usosUsuario int
			if err := tx.QueryRow(ctx, `
				select count(*) from coupon_uses cu join coupons c on c.id = cu.coupon_id
				where c.code = $1 and cu.user_id = $2`, couponCode, userID).Scan(&usosUsuario); err != nil {
				return nil, huma.Error500InternalServerError("error consultando los usos del cupón", err)
			}
			if usosUsuario >= maxUsesPerUser {
				return nil, huma.Error409Conflict("alcanzaste el límite de usos de este cupón")
			}
			switch tipo {
			case "percent":
				discount = subtotal * int64(*percentOff) / 100
			case "fixed":
				if couponCurrency == nil || *couponCurrency != currency {
					return nil, huma.Error422UnprocessableEntity("la moneda del cupón no coincide con la de la orden")
				}
				discount = *amountOff
			}
			if subtotal-discount <= 0 {
				return nil, huma.Error422UnprocessableEntity("el cupón dejaría el total en cero o negativo")
			}
			couponID = &id
		}
		total := subtotal - discount

		var orderID string
		err = tx.QueryRow(ctx, `
			insert into orders (user_id, status, total_minor, subtotal_minor, discount_minor,
				currency, coupon_id, coupon_code, idempotency_key, expires_at)
			values ($1, 'pending', $2, $3, $4, $5, $6, $7, $8, now() + interval '48 hours')
			returning id`, userID, total, subtotal, discount, currency,
			couponID, couponCodeOrNil(couponCode), in.Body.IdempotencyKey).Scan(&orderID)
		if err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23505" {
				// Carrera entre dos reintentos: devuelve la orden ya creada.
				if selErr := db.QueryRow(ctx,
					`select id from orders where user_id = $1 and idempotency_key = $2`,
					userID, in.Body.IdempotencyKey).Scan(&orderID); selErr == nil {
					return ordenIdempotenteValidada(ctx, db, orderID, userID, in.Body.OfertaID, couponCode)
				}
			}
			return nil, huma.Error500InternalServerError("error creando la orden", err)
		}

		_, err = tx.Exec(ctx, `
			insert into order_items
				(order_id, product_id, offer_id, track_id, product_snapshot, content_snapshot,
				 license_snapshot, quantity, unit_amount_minor, line_total_minor)
			values ($1, $2, $3, $4, $5, $6, null, 1, $7, $7)`,
			orderID, productID, offerID, trackIDOrNil(trackID), productSnapshot, contentSnapshot, amountMinor)
		if err != nil {
			return nil, huma.Error500InternalServerError("error guardando el contenido de la orden", err)
		}

		if couponCode != "" {
			if _, err := tx.Exec(ctx, `
				insert into coupon_uses (coupon_id, user_id, order_id, discount_minor)
				values ((select id from coupons where code = $1), $2, $3, $4)`, couponCode, userID, orderID, discount); err != nil {
				return nil, huma.Error500InternalServerError("error registrando el uso del cupón", err)
			}
			if _, err := tx.Exec(ctx, `update coupons set used_count = used_count + 1 where code = $1`, couponCode); err != nil {
				return nil, huma.Error500InternalServerError("error actualizando el cupón", err)
			}
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, huma.Error500InternalServerError("error confirmando la orden", err)
		}

		return obtenerOrdenPorID(ctx, db, orderID, userID)
	}
}

// couponCodeOrNil convierte el código normalizado a puntero para persistirlo.
func couponCodeOrNil(code string) *string {
	if code == "" {
		return nil
	}
	return &code
}

func trackIDOrNil(id string) *string {
	if id == "" {
		return nil
	}
	return &id
}

// pistasPublicadas carga las pistas publicadas de un producto con sus archivos
// publicados, congeladas en el snapshot de la orden.
func pistasPublicadas(ctx context.Context, q database.Querier, productID string) ([]contenidoPista, error) {
	rows, err := q.Query(ctx, `
		select t.id, t.title, ar.name
		from product_items pi
		join tracks t on t.id = pi.track_id and t.is_published and t.deleted_at is null
		join artists ar on ar.id = t.artist_id and ar.is_published and ar.deleted_at is null
		where pi.product_id = $1
		order by pi.sort_order`, productID)
	if err != nil {
		return nil, huma.Error500InternalServerError("error consultando el contenido del producto", err)
	}
	defer rows.Close()

	pistas := []contenidoPista{}
	for rows.Next() {
		var p contenidoPista
		if err := rows.Scan(&p.TrackID, &p.Titulo, &p.Artista); err != nil {
			return nil, huma.Error500InternalServerError("error leyendo el contenido", err)
		}
		p.Media = []mediaRef{}
		pistas = append(pistas, p)
	}
	if err := rows.Err(); err != nil {
		return nil, huma.Error500InternalServerError("error leyendo el contenido", err)
	}
	rows.Close()

	for i := range pistas {
		media, err := mediaPublicada(ctx, q, pistas[i].TrackID)
		if err != nil {
			return nil, err
		}
		pistas[i].Media = media
	}
	return pistas, nil
}

// mediaPublicada carga los archivos publicados de una pista.
func mediaPublicada(ctx context.Context, q database.Querier, trackID string) ([]mediaRef, error) {
	rows, err := q.Query(ctx, `
		select ma.id, tm.role, ma.mime_type, ma.storage_key
		from track_media tm
		join media_assets ma on ma.id = tm.media_asset_id and ma.deleted_at is null
		where tm.track_id = $1 and tm.is_published
		order by tm.role`, trackID)
	if err != nil {
		return nil, huma.Error500InternalServerError("error consultando los archivos de la pista", err)
	}
	defer rows.Close()

	media := []mediaRef{}
	for rows.Next() {
		var m mediaRef
		if err := rows.Scan(&m.ID, &m.Rol, &m.MimeType, &m.StorageKey); err != nil {
			return nil, huma.Error500InternalServerError("error leyendo los archivos", err)
		}
		media = append(media, m)
	}
	if err := rows.Err(); err != nil {
		return nil, huma.Error500InternalServerError("error leyendo los archivos", err)
	}
	return media, nil
}

// ordenIdempotenteValidada devuelve una orden existente para una clave de
// cliente, exigiendo que oferta y cupón coincidan con el reintento.
func ordenIdempotenteValidada(ctx context.Context, db database.DB, orderID, userID, ofertaID, couponCode string) (*crearOrdenOutput, error) {
	var offerExistente *string
	var couponExistente *string
	err := db.QueryRow(ctx, `
		select oi.offer_id, o.coupon_code
		from orders o left join order_items oi on oi.order_id = o.id
		where o.id = $1 and o.user_id = $2`, orderID, userID,
	).Scan(&offerExistente, &couponExistente)
	if err != nil {
		return nil, huma.Error500InternalServerError("error consultando la orden", err)
	}
	if offerExistente == nil || *offerExistente != ofertaID {
		return nil, huma.Error409Conflict("la clave idempotente ya fue usada con otra oferta")
	}
	couponExistenteNorm := ""
	if couponExistente != nil {
		couponExistenteNorm = *couponExistente
	}
	if couponExistenteNorm != couponCode {
		return nil, huma.Error409Conflict("la clave idempotente ya fue usada con otro cupón")
	}
	return obtenerOrdenPorID(ctx, db, orderID, userID)
}

// ensureProfile crea el perfil si no existe (mismo patrón que /me, con el
// nombre visible inicial a partir del correo del token).
func ensureProfile(ctx context.Context, db database.DB, userID, email string) (bool, error) {
	var initial *string
	if email != "" {
		name := strings.SplitN(email, "@", 2)[0]
		initial = &name
	}
	var created bool
	err := db.QueryRow(ctx, `
		insert into profiles (id, display_name, email) values ($1, $2, $3)
		on conflict (id) do update set email = coalesce(excluded.email, profiles.email)
		returning (xmax = 0)`, userID, initial, email).Scan(&created)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	return created, err
}

// obtenerOrdenPorID carga la orden con sus ítems, verificando titularidad.
func obtenerOrdenPorID(ctx context.Context, db database.DB, orderID, userID string) (*crearOrdenOutput, error) {
	out := &crearOrdenOutput{}
	out.Body.Items = []ordenItemOut{}
	err := db.QueryRow(ctx, `
		select id, status, subtotal_minor, discount_minor, total_minor, currency,
		       coupon_code, created_at, expires_at, paid_at
		from orders where id = $1 and user_id = $2`, orderID, userID,
	).Scan(&out.Body.ID, &out.Body.Estado, &out.Body.SubtotalMinor, &out.Body.DescuentoMinor,
		&out.Body.TotalMinor, &out.Body.Moneda, &out.Body.CuponCode,
		&out.Body.CreadaEn, &out.Body.ExpiraEn, &out.Body.PagadaEn)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, huma.Error404NotFound("orden no encontrada")
	}
	if err != nil {
		return nil, huma.Error500InternalServerError("error consultando la orden", err)
	}

	rows, err := db.Query(ctx, `
		select id, offer_id, product_snapshot, content_snapshot, license_snapshot,
		       quantity, unit_amount_minor, line_total_minor
		from order_items where order_id = $1 order by id`, orderID)
	if err != nil {
		return nil, huma.Error500InternalServerError("error consultando los ítems", err)
	}
	defer rows.Close()
	for rows.Next() {
		var item ordenItemOut
		if err := rows.Scan(&item.ID, &item.OfertaID, &item.ProductSnapshot, &item.ContentSnapshot,
			&item.LicenseSnapshot, &item.Cantidad, &item.UnitarioMinor, &item.TotalMinor); err != nil {
			return nil, huma.Error500InternalServerError("error leyendo los ítems", err)
		}
		out.Body.Items = append(out.Body.Items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, huma.Error500InternalServerError("error leyendo los ítems", err)
	}
	return out, nil
}

type obtenerOrdenInput struct {
	ID string `path:"id" format:"uuid" doc:"ID de la orden"`
}

type obtenerOrdenOutput struct {
	Body struct {
		Orden ordenOut      `json:"orden"`
		Pagos []pagoResumen `json:"pagos"`
	}
}

type pagoResumen struct {
	ID           string     `json:"id"`
	Proveedor    string     `json:"proveedor" doc:"qr | transfer"`
	Estado       string     `json:"estado" doc:"awaiting_evidence | in_review | confirmed | rejected"`
	MontoMinor   int64      `json:"monto_minor"`
	Moneda       string     `json:"moneda"`
	CreadoEn     time.Time  `json:"creado_en"`
	ConfirmadoEn *time.Time `json:"confirmado_en,omitempty"`
}

func obtenerOrden(db database.DB) func(context.Context, *obtenerOrdenInput) (*obtenerOrdenOutput, error) {
	return func(ctx context.Context, in *obtenerOrdenInput) (*obtenerOrdenOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}
		orden, err := obtenerOrdenPorID(ctx, db, in.ID, claims.Subject)
		if err != nil {
			return nil, err
		}
		out := &obtenerOrdenOutput{}
		out.Body.Orden = orden.Body
		out.Body.Pagos = []pagoResumen{}

		rows, err := db.Query(ctx, `
			select id, provider, status, amount_minor, currency, created_at, confirmed_at
			from payment_attempts where order_id = $1 order by created_at desc`, in.ID)
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando los pagos", err)
		}
		defer rows.Close()
		for rows.Next() {
			var p pagoResumen
			if err := rows.Scan(&p.ID, &p.Proveedor, &p.Estado, &p.MontoMinor, &p.Moneda,
				&p.CreadoEn, &p.ConfirmadoEn); err != nil {
				return nil, huma.Error500InternalServerError("error leyendo los pagos", err)
			}
			out.Body.Pagos = append(out.Body.Pagos, p)
		}
		if err := rows.Err(); err != nil {
			return nil, huma.Error500InternalServerError("error leyendo los pagos", err)
		}
		return out, nil
	}
}
