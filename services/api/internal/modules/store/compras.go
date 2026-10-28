package store

import (
	"context"
	"errors"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"

	"triomision/api/internal/auth"
	"triomision/api/internal/database"
	"triomision/api/internal/storage"
)

// ── Mis compras y descarga ─────────────────────────────────────────────────

type compraResumen struct {
	OrdenID    string    `json:"orden_id"`
	Estado     string    `json:"estado"`
	TotalMinor int64     `json:"total_minor"`
	Moneda     string    `json:"moneda"`
	PagadaEn   time.Time `json:"pagada_en"`
	Titulo     string    `json:"titulo" doc:"Título congelado del producto"`
}

type accesoResumen struct {
	ID          string       `json:"id"`
	Pista       pistaResumen `json:"pista"`
	Origen      string       `json:"origen" doc:"purchase | gift | creator_promo | redemption | manual"`
	ConcedidoEn time.Time    `json:"concedido_en"`
	Estado      string       `json:"estado" doc:"vigente | revocado | vencido"`
}

type suscripcionResumen struct {
	ID     string    `json:"id"`
	Plan   planCorto `json:"plan"`
	Origen string    `json:"origen" doc:"purchase | redemption | gift | manual"`
	Inicio time.Time `json:"inicio"`
	Fin    time.Time `json:"fin"`
	Estado string    `json:"estado" doc:"activa | revocada | vencida"`
}

type planCorto struct {
	ID     string `json:"id"`
	Codigo string `json:"codigo"`
	Nombre string `json:"nombre"`
}

type terminosResumen struct {
	VersionID string `json:"version_id,omitempty"`
	Etiqueta  string `json:"etiqueta,omitempty"`
}

type licenciaResumen struct {
	ID                string          `json:"id"`
	Pista             pistaResumen    `json:"pista"`
	Uso               string          `json:"uso" doc:"practica | interpretacion | grabacion_vocal | publicacion | monetizacion"`
	TerminosVersion   string          `json:"terminos_version,omitempty" doc:"Etiqueta de la versión de términos congelada"`
	TerminosVersionID string          `json:"terminos_version_id,omitempty" doc:"ID de la versión de términos"`
	Terminos          terminosResumen `json:"terminos" doc:"Términos aceptados congelados"`
	ConcedidaEn       time.Time       `json:"concedida_en"`
	RevocadaEn        *time.Time      `json:"revocada_en,omitempty"`
	Estado            string          `json:"estado" doc:"vigente | revocado"`
}

type misComprasOutput struct {
	Body struct {
		Compras       []compraResumen      `json:"compras"`
		Accesos       []accesoResumen      `json:"accesos"`
		Suscripciones []suscripcionResumen `json:"suscripciones" doc:"Períodos Premium del usuario"`
		Licencias     []licenciaResumen    `json:"licencias" doc:"Permisos adicionales concedidos al usuario"`
		PremiumActivo bool                 `json:"premium_activo" doc:"true cuando hay un período vigente ahora"`
	}
}

// misCompras lista las compras pagadas, los accesos, las suscripciones y las
// licencias del usuario. premium_activo se calcula por tiempo (período vigente ahora);
// Premium nunca crea entitlements de audio ni licencias.
func misCompras(db database.DB) func(context.Context, *struct{}) (*misComprasOutput, error) {
	return func(ctx context.Context, _ *struct{}) (*misComprasOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}
		out := &misComprasOutput{}
		out.Body.Compras = []compraResumen{}
		out.Body.Accesos = []accesoResumen{}
		out.Body.Suscripciones = []suscripcionResumen{}
		out.Body.Licencias = []licenciaResumen{}

		rows, err := db.Query(ctx, `
			select o.id, o.status, o.total_minor, o.currency, o.paid_at,
			       coalesce(pi.product_snapshot->>'titulo', '')
			from orders o
			left join order_items pi on pi.order_id = o.id
			where o.user_id = $1 and o.status = 'paid'
			order by o.paid_at desc`, claims.Subject)
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando las compras", err)
		}
		defer rows.Close()
		for rows.Next() {
			var c compraResumen
			if err := rows.Scan(&c.OrdenID, &c.Estado, &c.TotalMinor, &c.Moneda, &c.PagadaEn, &c.Titulo); err != nil {
				return nil, huma.Error500InternalServerError("error leyendo las compras", err)
			}
			out.Body.Compras = append(out.Body.Compras, c)
		}
		if err := rows.Err(); err != nil {
			return nil, huma.Error500InternalServerError("error leyendo las compras", err)
		}
		rows.Close()

		rows2, err := db.Query(ctx, `
			select e.id, t.id, t.title, ar.name, e.grant_source, e.granted_at,
			       e.revoked_at, e.valid_until
			from entitlements e
			join tracks t on t.id = e.track_id
			join artists ar on ar.id = t.artist_id
			where e.user_id = $1
			order by e.granted_at desc`, claims.Subject)
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando los accesos", err)
		}
		defer rows2.Close()
		for rows2.Next() {
			var (
				a          accesoResumen
				revokedAt  *time.Time
				validUntil *time.Time
			)
			if err := rows2.Scan(&a.ID, &a.Pista.ID, &a.Pista.Titulo, &a.Pista.Artista,
				&a.Origen, &a.ConcedidoEn, &revokedAt, &validUntil); err != nil {
				return nil, huma.Error500InternalServerError("error leyendo los accesos", err)
			}
			a.Estado = estadoAcceso(revokedAt, validUntil)
			out.Body.Accesos = append(out.Body.Accesos, a)
		}
		if err := rows2.Err(); err != nil {
			return nil, huma.Error500InternalServerError("error leyendo los accesos", err)
		}
		rows2.Close()

		rows3, err := db.Query(ctx, `
			select s.id, s.plan_id, pl.code, pl.name, s.grant_source,
			       s.period_start, s.period_end, s.status, s.revoked_at
			from subscriptions s
			join plans pl on pl.id = s.plan_id
			where s.user_id = $1
			order by s.period_end desc`, claims.Subject)
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando las suscripciones", err)
		}
		defer rows3.Close()
		for rows3.Next() {
			var (
				s         suscripcionResumen
				revokedAt *time.Time
			)
			if err := rows3.Scan(&s.ID, &s.Plan.ID, &s.Plan.Codigo, &s.Plan.Nombre,
				&s.Origen, &s.Inicio, &s.Fin, &s.Estado, &revokedAt); err != nil {
				return nil, huma.Error500InternalServerError("error leyendo las suscripciones", err)
			}
			s.Estado = estadoSuscripcion(revokedAt, s.Fin)
			out.Body.Suscripciones = append(out.Body.Suscripciones, s)
		}
		if err := rows3.Err(); err != nil {
			return nil, huma.Error500InternalServerError("error leyendo las suscripciones", err)
		}
		rows3.Close()

		rows4, err := db.Query(ctx, `
			select lg.id, t.id, t.title, ar.name,
			       coalesce(lg.accepted_uses->>'use_code', ''),
			       coalesce(lg.terms_version_id::text, lg.accepted_uses->>'terminos_version_id', ''),
			       coalesce(ltv.version_label, lg.accepted_uses->>'terminos_etiqueta', ''),
			       lg.granted_at, lg.revoked_at
			from license_grants lg
			join tracks t on t.id = lg.track_id
			join artists ar on ar.id = t.artist_id
			left join license_terms_versions ltv on ltv.id = lg.terms_version_id
			where lg.user_id = $1
			order by lg.granted_at desc`, claims.Subject)
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando las licencias", err)
		}
		defer rows4.Close()
		for rows4.Next() {
			var (
				l                 licenciaResumen
				terminosVersionID string
				terminosEtiqueta  string
				revokedAt         *time.Time
			)
			if err := rows4.Scan(&l.ID, &l.Pista.ID, &l.Pista.Titulo, &l.Pista.Artista,
				&l.Uso, &terminosVersionID, &terminosEtiqueta,
				&l.ConcedidaEn, &revokedAt); err != nil {
				return nil, huma.Error500InternalServerError("error leyendo las licencias", err)
			}
			l.RevocadaEn = revokedAt
			l.Estado = estadoLicencia(revokedAt)
			l.TerminosVersion = terminosEtiqueta
			l.TerminosVersionID = terminosVersionID
			l.Terminos.VersionID = terminosVersionID
			l.Terminos.Etiqueta = terminosEtiqueta
			out.Body.Licencias = append(out.Body.Licencias, l)
		}
		if err := rows4.Err(); err != nil {
			return nil, huma.Error500InternalServerError("error leyendo las licencias", err)
		}
		rows4.Close()

		err = db.QueryRow(ctx, `
			select exists(
				select 1 from subscriptions
				where user_id = $1 and status = 'active' and period_end > now())`, claims.Subject,
		).Scan(&out.Body.PremiumActivo)
		if err != nil {
			return nil, huma.Error500InternalServerError("error calculando premium activo", err)
		}
		return out, nil
	}
}

func estadoAcceso(revokedAt, validUntil *time.Time) string {
	switch {
	case revokedAt != nil:
		return "revocado"
	case validUntil != nil && validUntil.Before(time.Now()):
		return "vencido"
	default:
		return "vigente"
	}
}

func estadoLicencia(revokedAt *time.Time) string {
	if revokedAt != nil {
		return "revocado"
	}
	return "vigente"
}

func estadoSuscripcion(revokedAt *time.Time, fin time.Time) string {
	switch {
	case revokedAt != nil:
		return "revocada"
	case !fin.After(time.Now()):
		return "vencida"
	default:
		return "activa"
	}
}

type descargaInput struct {
	AccesoID string `path:"id" format:"uuid" doc:"ID del entitlement"`
}

type descargaOutput struct {
	Body struct {
		URL        string       `json:"url" doc:"URL firmada breve de descarga"`
		ExpiraEn   time.Time    `json:"expira_en"`
		StorageKey string       `json:"storage_key"`
		MimeType   string       `json:"mime_type"`
		ByteSize   int64        `json:"byte_size"`
		Pista      pistaResumen `json:"pista"`
	}
}

// descarga firma la URL del master solo si el usuario tiene un entitlement
// vigente sobre la pista. Es la única vía de descarga: los objetos son privados.
func descarga(db database.DB, store storage.Client, ttl time.Duration) func(context.Context, *descargaInput) (*descargaOutput, error) {
	return func(ctx context.Context, in *descargaInput) (*descargaOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}

		var (
			trackID, userID       string
			revokedAt, validUntil *time.Time
		)
		err := db.QueryRow(ctx, `
			select track_id, user_id, revoked_at, valid_until
			from entitlements where id = $1 and track_id is not null`, in.AccesoID,
		).Scan(&trackID, &userID, &revokedAt, &validUntil)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("acceso no encontrado")
		}
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando el acceso", err)
		}
		if userID != claims.Subject {
			// 404 (no 403) para no revelar la existencia de un acceso ajeno.
			return nil, huma.Error404NotFound("acceso no encontrado")
		}
		if revokedAt != nil || (validUntil != nil && validUntil.Before(time.Now())) {
			return nil, huma.Error403Forbidden("el acceso está revocado o vencido")
		}

		// Master publicado de la pista: es el archivo entregable.
		var (
			key, mime string
			size      int64
			titulo    string
			artista   string
		)
		err = db.QueryRow(ctx, `
			select ma.storage_key, ma.mime_type, ma.byte_size, t.title, ar.name
			from track_media tm
			join media_assets ma on ma.id = tm.media_asset_id and ma.deleted_at is null
			join tracks t on t.id = tm.track_id
			join artists ar on ar.id = t.artist_id
			where tm.track_id = $1 and tm.role = 'master' and tm.is_published
			order by tm.created_at desc
			limit 1`, trackID,
		).Scan(&key, &mime, &size, &titulo, &artista)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error409Conflict("la pista no tiene master publicado")
		}
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando el master", err)
		}

		url, err := store.PresignGet(ctx, key, ttl)
		if err != nil {
			return nil, huma.Error500InternalServerError("error firmando la descarga", err)
		}

		out := &descargaOutput{}
		out.Body.URL = url
		out.Body.ExpiraEn = time.Now().Add(ttl)
		out.Body.StorageKey = key
		out.Body.MimeType = mime
		out.Body.ByteSize = size
		out.Body.Pista = pistaResumen{ID: trackID, Titulo: titulo, Artista: artista}
		return out, nil
	}
}
