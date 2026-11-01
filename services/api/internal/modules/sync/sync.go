// Package sync implementa la sincronización incremental del catálogo
// (delta por cursor opuesto con tombstones) y las licencias de descarga
// offline con vencimiento: un dispositivo registrado del usuario obtiene
// licencias temporales (30 días, renovables) solo para las pistas a las que
// el usuario tiene acceso vigente (entitlement activo o Premium activo).
// La licencia offline habilita la reproducción cifrada en el cliente y
// jamás la descarga del master por la vía de la tienda. Revocar el
// dispositivo o el entitlement revoca sus licencias en la misma transacción.
package sync

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"

	"triomision/api/internal/auth"
	"triomision/api/internal/database"
)

// limiteDefault es el tamaño de página por defecto del delta de catálogo.
const limiteDefault = 100

// entidades del delta, en el orden estable del contrato.
const (
	kindArtista = iota
	kindAlbum
	kindCancion
	kindHimno
	kindVersionHimno
	kindPista
)

// filaCatalogo es una fila del delta con su clave de ordenación (updated_at, id).
type filaCatalogo struct {
	ts   time.Time
	id   string
	data json.RawMessage
	kind int
}

// Register registra los endpoints del titular: delta de catálogo y licencias
// offline de sus dispositivos.
func Register(api huma.API, db database.DB) {
	huma.Register(api, huma.Operation{
		OperationID: "sync-catalogo",
		Method:      http.MethodGet,
		Path:        "/api/v1/sync/catalogo",
		Summary:     "Delta incremental del catálogo",
		Description: "Devuelve las filas de catálogo público e himnario cambiadas desde el cursor " +
			"(artistas, álbumes, canciones con ChordPro, himnos, versiones de himno con ChordPro y pistas " +
			"publicadas). Las filas con deleted_at viajan como tombstones (eliminado=true); las despublicadas " +
			"viajan con publicado=false para que el cliente las retire. El cursor es opaco " +
			"(base64 de updated_at + id); sin cursor devuelve el catálogo publicado completo, paginado.",
		Tags:     []string{"sync"},
		Security: []map[string][]string{{"bearer": {}}},
	}, catalogo(db))

	huma.Register(api, huma.Operation{
		OperationID: "sync-crear-descargas-offline",
		Method:      http.MethodPost,
		Path:        "/api/v1/dispositivos/{installId}/descargas-offline",
		Summary:     "Solicitar licencias offline de mis pistas",
		Description: "Por cada pista exige acceso vigente del usuario: entitlement activo (origen " +
			"entitlement) o, en su defecto, Premium activo (origen premium); sin acceso se reporta rechazada " +
			"con motivo. Crea o renueva la licencia del dispositivo (30 días, idempotente por el índice único " +
			"vigente). La licencia jamás habilita la descarga del master.",
		Tags:     []string{"sync"},
		Security: []map[string][]string{{"bearer": {}}},
	}, crearDescargasOffline(db))

	huma.Register(api, huma.Operation{
		OperationID: "sync-listar-descargas-offline",
		Method:      http.MethodGet,
		Path:        "/api/v1/dispositivos/{installId}/descargas-offline",
		Summary:     "Mis licencias offline del dispositivo",
		Description: "Licencias de descarga offline del dispositivo con su origen, concesión, vencimiento " +
			"y estado (vigente | revocada | vencida). Dispositivo ajeno → 404; revocado → 409.",
		Tags:     []string{"sync"},
		Security: []map[string][]string{{"bearer": {}}},
	}, listarDescargasOffline(db))

	registerStaff(api, db)
}

// ── Delta de catálogo ──────────────────────────────────────────────────────

type catalogoInput struct {
	Desde  string `query:"desde" required:"false" doc:"Cursor opaco devuelto por la página anterior"`
	Limite int    `query:"limite" required:"false" maximum:"500" doc:"Máximo de filas por página (default 100, máx 500)"`
}

type catalogoOutput struct {
	Body struct {
		Cursor       string            `json:"cursor" doc:"Cursor de la última fila de la página: sírvelo en la siguiente llamada para continuar o para el próximo delta (vacío solo si la página no trajo filas)"`
		HasMore      bool              `json:"has_more"`
		Limite       int               `json:"limite"`
		Artists      []json.RawMessage `json:"artists"`
		Albums       []json.RawMessage `json:"albums"`
		Songs        []json.RawMessage `json:"songs"`
		Hymns        []json.RawMessage `json:"hymns"`
		HymnVersions []json.RawMessage `json:"hymn_versions"`
		Tracks       []json.RawMessage `json:"tracks"`
	}
}

// consultas del delta: cada una pagina por (updated_at, id) con el mismo
// cursor y devuelve la fila como jsonb junto a su clave de ordenación. La
// visibilidad es uniforme: filas publicadas vivas siempre; filas no
// publicadas o eliminadas solo si cambiaron desde el cursor (la baja debe
// actualizar updated_at).
var consultasDelta = []struct {
	kind int
	sql  string
}{
	{kindArtista, `
		select t.updated_at, t.id::text, jsonb_build_object(
		         'id', t.id, 'slug', t.slug, 'nombre', t.name, 'pais', t.country,
		         'publicado', t.is_published, 'eliminado', t.deleted_at is not null,
		         'actualizado_en', t.updated_at)
		from artists t
		where ($4::bool or (t.updated_at, t.id::text) > ($1::timestamptz, $2::text))
		  and ((t.is_published and t.deleted_at is null) or t.updated_at > $1::timestamptz)
		order by t.updated_at, t.id
		limit $3`},
	{kindAlbum, `
		select t.updated_at, t.id::text, jsonb_build_object(
		         'id', t.id, 'artista_id', t.artist_id, 'titulo', t.title, 'anio', t.year,
		         'publicado', t.is_published, 'eliminado', t.deleted_at is not null,
		         'actualizado_en', t.updated_at)
		from albums t
		where ($4::bool or (t.updated_at, t.id::text) > ($1::timestamptz, $2::text))
		  and ((t.is_published and t.deleted_at is null) or t.updated_at > $1::timestamptz)
		order by t.updated_at, t.id
		limit $3`},
	{kindCancion, `
		select t.updated_at, t.id::text, jsonb_build_object(
		         'id', t.id, 'album_id', t.album_id, 'titulo', t.title,
		         'tono', t.original_key, 'capo', t.capo, 'bpm', t.bpm,
		         'acceso', t.publication_access, 'publicado', t.is_published,
		         'eliminado', t.deleted_at is not null, 'actualizado_en', t.updated_at,
		         'chordpro', t.chordpro)
		from songs t
		where ($4::bool or (t.updated_at, t.id::text) > ($1::timestamptz, $2::text))
		  and ((t.is_published and t.deleted_at is null) or t.updated_at > $1::timestamptz)
		order by t.updated_at, t.id
		limit $3`},
	{kindHimno, `
		select t.updated_at, t.id::text, jsonb_build_object(
		         'id', t.id, 'coleccion', c.slug, 'numero', t.hymn_number, 'titulo', t.title,
		         'eliminado', t.deleted_at is not null, 'actualizado_en', t.updated_at)
		from hymns t
		join hymn_collections c on c.id = t.collection_id
		where ($4::bool or (t.updated_at, t.id::text) > ($1::timestamptz, $2::text))
		  and (t.deleted_at is null or t.updated_at > $1::timestamptz)
		order by t.updated_at, t.id
		limit $3`},
	{kindVersionHimno, `
		select t.updated_at, t.id::text, jsonb_build_object(
		         'id', t.id, 'himno_id', t.hymn_id, 'version', t.version_code,
		         'alcance', t.chord_scope, 'publicado', t.is_published,
		         'eliminado', t.deleted_at is not null, 'actualizado_en', t.updated_at,
		         'chordpro', t.chordpro)
		from hymn_versions t
		where ($4::bool or (t.updated_at, t.id::text) > ($1::timestamptz, $2::text))
		  and ((t.is_published and t.deleted_at is null) or t.updated_at > $1::timestamptz)
		order by t.updated_at, t.id
		limit $3`},
	{kindPista, `
		select t.updated_at, t.id::text, jsonb_build_object(
		         'id', t.id, 'artista_id', t.artist_id, 'titulo', t.title,
		         'publicado', t.is_published, 'eliminado', t.deleted_at is not null,
		         'actualizado_en', t.updated_at)
		from tracks t
		where ($4::bool or (t.updated_at, t.id::text) > ($1::timestamptz, $2::text))
		  and ((t.is_published and t.deleted_at is null) or t.updated_at > $1::timestamptz)
		order by t.updated_at, t.id
		limit $3`},
}

// catalogo devuelve la primera página (limite filas en orden global
// updated_at+id) del delta desde el cursor. Sin cursor sincroniza el
// catálogo publicado completo.
func catalogo(db database.DB) func(ctx context.Context, in *catalogoInput) (*catalogoOutput, error) {
	return func(ctx context.Context, in *catalogoInput) (*catalogoOutput, error) {
		if _, ok := auth.ClaimsFromContext(ctx); !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}

		limite := in.Limite
		if limite <= 0 {
			limite = limiteDefault
		}
		cursorTS, cursorID, inicial, err := parseCursor(in.Desde)
		if err != nil {
			return nil, huma.Error422UnprocessableEntity("cursor inválido; reinicia la sincronización sin cursor")
		}

		filas := []filaCatalogo{}
		for _, q := range consultasDelta {
			rows, err := db.Query(ctx, q.sql, cursorTS, cursorID, limite+1, inicial)
			if err != nil {
				return nil, huma.Error500InternalServerError("error consultando el delta del catálogo", err)
			}
			for rows.Next() {
				var f filaCatalogo
				if err := rows.Scan(&f.ts, &f.id, &f.data); err != nil {
					rows.Close()
					return nil, huma.Error500InternalServerError("error leyendo el delta del catálogo", err)
				}
				f.kind = q.kind
				filas = append(filas, f)
			}
			if err := rows.Err(); err != nil {
				rows.Close()
				return nil, huma.Error500InternalServerError("error leyendo el delta del catálogo", err)
			}
			rows.Close()
		}

		sort.SliceStable(filas, func(i, j int) bool {
			if filas[i].ts.Equal(filas[j].ts) {
				return filas[i].id < filas[j].id
			}
			return filas[i].ts.Before(filas[j].ts)
		})

		out := &catalogoOutput{}
		out.Body.Limite = limite
		out.Body.Artists = []json.RawMessage{}
		out.Body.Albums = []json.RawMessage{}
		out.Body.Songs = []json.RawMessage{}
		out.Body.Hymns = []json.RawMessage{}
		out.Body.HymnVersions = []json.RawMessage{}
		out.Body.Tracks = []json.RawMessage{}

		if len(filas) > limite {
			out.Body.HasMore = true
			filas = filas[:limite]
		}
		for _, f := range filas {
			switch f.kind {
			case kindArtista:
				out.Body.Artists = append(out.Body.Artists, f.data)
			case kindAlbum:
				out.Body.Albums = append(out.Body.Albums, f.data)
			case kindCancion:
				out.Body.Songs = append(out.Body.Songs, f.data)
			case kindHimno:
				out.Body.Hymns = append(out.Body.Hymns, f.data)
			case kindVersionHimno:
				out.Body.HymnVersions = append(out.Body.HymnVersions, f.data)
			case kindPista:
				out.Body.Tracks = append(out.Body.Tracks, f.data)
			}
		}
		if len(filas) > 0 {
			ultima := filas[len(filas)-1]
			out.Body.Cursor = armarCursor(ultima.ts, ultima.id)
		}
		return out, nil
	}
}

// parseCursor decodifica el cursor opaco. Sin cursor devuelve inicial=true y
// un timestamp infinito de modo que solo entren las filas publicadas vivas.
func parseCursor(cursor string) (time.Time, string, bool, error) {
	if strings.TrimSpace(cursor) == "" {
		return time.Date(9999, 12, 31, 23, 59, 59, 0, time.UTC), "", true, nil
	}
	decodificado, err := base64.RawURLEncoding.DecodeString(cursor)
	if err != nil {
		return time.Time{}, "", false, err
	}
	partes := strings.SplitN(string(decodificado), "|", 2)
	if len(partes) != 2 {
		return time.Time{}, "", false, errors.New("cursor sin separador")
	}
	ts, err := time.Parse(time.RFC3339Nano, partes[0])
	if err != nil {
		return time.Time{}, "", false, err
	}
	return ts, partes[1], false, nil
}

func armarCursor(ts time.Time, id string) string {
	return base64.RawURLEncoding.EncodeToString([]byte(ts.Format(time.RFC3339Nano) + "|" + id))
}

// ── Licencias offline ──────────────────────────────────────────────────────

type descargaOfflineItem struct {
	ID          string     `json:"id"`
	PistaID     string     `json:"pista_id"`
	PistaTitulo string     `json:"pista_titulo"`
	Origen      string     `json:"origen" doc:"entitlement | premium"`
	ConcedidaEn time.Time  `json:"concedida_en"`
	ExpiraEn    time.Time  `json:"expira_en"`
	ActividadEn *time.Time `json:"actividad_en,omitempty"`
	RevocadaEn  *time.Time `json:"revocada_en,omitempty"`
	Estado      string     `json:"estado" doc:"vigente | revocada | vencida"`
}

type crearDescargasInput struct {
	InstallID string `path:"installId" doc:"Identificador de instalación del dispositivo"`
	Body      struct {
		TrackIDs []string `json:"track_ids" minItems:"1" maxItems:"50" format:"uuid" doc:"Pistas solicitadas"`
	}
}

type crearDescargasOutput struct {
	Body struct {
		Concedidas []descargaOfflineItem `json:"concedidas" doc:"Licencias nuevas (30 días)"`
		Renovadas  []descargaOfflineItem `json:"renovadas" doc:"Licencias vigentes renovadas por otros 30 días"`
		Rechazadas []rechazoDescarga     `json:"rechazadas" doc:"Pistas sin acceso vigente o inexistentes"`
	}
}

type rechazoDescarga struct {
	PistaID string `json:"pista_id"`
	Motivo  string `json:"motivo"`
}

// crearDescargasOffline concede o renueva licencias offline del dispositivo
// para las pistas solicitadas. Exige acceso vigente por pista y un
// dispositivo propio no revocado. Idempotente: repetir renueva la vigente.
func crearDescargasOffline(db database.DB) func(ctx context.Context, in *crearDescargasInput) (*crearDescargasOutput, error) {
	return func(ctx context.Context, in *crearDescargasInput) (*crearDescargasOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}

		deviceID, err := dispositivoPropio(ctx, db, claims.Subject, in.InstallID)
		if err != nil {
			return nil, err
		}

		out := &crearDescargasOutput{}
		out.Body.Concedidas = []descargaOfflineItem{}
		out.Body.Renovadas = []descargaOfflineItem{}
		out.Body.Rechazadas = []rechazoDescarga{}

		for _, trackID := range in.Body.TrackIDs {
			origen, motivo, err := accesoVigente(ctx, db, claims.Subject, trackID)
			if err != nil {
				return nil, err
			}
			if origen == "" {
				out.Body.Rechazadas = append(out.Body.Rechazadas, rechazoDescarga{PistaID: trackID, Motivo: motivo})
				continue
			}

			var item descargaOfflineItem
			var creada bool
			err = db.QueryRow(ctx, `
				insert into offline_downloads (user_id, device_id, track_id, origen, expires_at)
				values ($1, $2, $3, $4, now() + interval '30 days')
				on conflict (device_id, track_id) where revoked_at is null
				do update set
				  expires_at   = now() + interval '30 days',
				  last_seen_at = now(),
				  origen       = excluded.origen
				returning id, track_id, origen, granted_at, expires_at, (xmax = 0)`,
				claims.Subject, deviceID, trackID, origen,
			).Scan(&item.ID, &item.PistaID, &item.Origen, &item.ConcedidaEn, &item.ExpiraEn, &creada)
			if err != nil {
				return nil, huma.Error500InternalServerError("error guardando la licencia offline", err)
			}
			item.Estado = "vigente"
			if creada {
				out.Body.Concedidas = append(out.Body.Concedidas, item)
			} else {
				out.Body.Renovadas = append(out.Body.Renovadas, item)
			}
		}
		return out, nil
	}
}

// dispositivoPropio resuelve el dispositivo del usuario por install_id:
// ajeno o inexistente → 404; revocado → 409.
func dispositivoPropio(ctx context.Context, q database.Querier, userID, installID string) (string, error) {
	var (
		deviceID  string
		revokedAt *time.Time
	)
	err := q.QueryRow(ctx, `
		select id, revoked_at from devices where user_id = $1 and install_id = $2`,
		userID, installID).Scan(&deviceID, &revokedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", huma.Error404NotFound("dispositivo no encontrado")
	}
	if err != nil {
		return "", huma.Error500InternalServerError("error consultando el dispositivo", err)
	}
	if revokedAt != nil {
		return "", huma.Error409Conflict("el dispositivo está revocado")
	}
	return deviceID, nil
}

// accesoVigente decide el origen de la licencia: entitlement activo de la
// pista, o Premium activo; si ninguno, devuelve el motivo del rechazo.
// El entitlement vale para cualquier pista (incluidas las entregadas por un
// encargo, que no se publican en la tienda); Premium solo cubre el catálogo
// publicado: sin esa restricción cualquier suscriptor podría licenciar offline
// pistas en borrador o encargos ajenos adivinando el UUID.
func accesoVigente(ctx context.Context, q database.Querier, userID, trackID string) (string, string, error) {
	var publicada bool
	if err := q.QueryRow(ctx, `
		select is_published from tracks where id = $1 and deleted_at is null`, trackID,
	).Scan(&publicada); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", "pista no encontrada", nil
		}
		return "", "", huma.Error500InternalServerError("error consultando la pista", err)
	}

	var entitlement bool
	if err := q.QueryRow(ctx, `
		select exists(
		  select 1 from entitlements
		  where user_id = $1 and track_id = $2 and revoked_at is null
		    and (valid_until is null or valid_until > now()))`, userID, trackID,
	).Scan(&entitlement); err != nil {
		return "", "", huma.Error500InternalServerError("error consultando el acceso", err)
	}
	if entitlement {
		return "entitlement", "", nil
	}

	if !publicada {
		return "", "sin acceso vigente a la pista", nil
	}
	var premium bool
	if err := q.QueryRow(ctx, `
		select exists(
		  select 1 from subscriptions
		  where user_id = $1 and status = 'active' and period_end > now())`, userID,
	).Scan(&premium); err != nil {
		return "", "", huma.Error500InternalServerError("error consultando el período premium", err)
	}
	if premium {
		return "premium", "", nil
	}
	return "", "sin acceso vigente a la pista", nil
}

type listarDescargasOutput struct {
	Body struct {
		Descargas []descargaOfflineItem `json:"descargas"`
	}
}

func listarDescargasOffline(db database.DB) func(ctx context.Context, in *dispositivoPath) (*listarDescargasOutput, error) {
	return func(ctx context.Context, in *dispositivoPath) (*listarDescargasOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}
		deviceID, err := dispositivoPropio(ctx, db, claims.Subject, in.InstallID)
		if err != nil {
			return nil, err
		}
		out := &listarDescargasOutput{}
		out.Body.Descargas = []descargaOfflineItem{}

		rows, err := db.Query(ctx, `
			select od.id, od.track_id, t.title, od.origen, od.granted_at, od.expires_at,
			       od.last_seen_at, od.revoked_at
			from offline_downloads od
			join tracks t on t.id = od.track_id
			where od.device_id = $1
			order by od.granted_at desc`, deviceID)
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando las licencias offline", err)
		}
		defer rows.Close()
		for rows.Next() {
			var (
				d         descargaOfflineItem
				actividad *time.Time
			)
			if err := rows.Scan(&d.ID, &d.PistaID, &d.PistaTitulo, &d.Origen, &d.ConcedidaEn,
				&d.ExpiraEn, &actividad, &d.RevocadaEn); err != nil {
				return nil, huma.Error500InternalServerError("error leyendo las licencias offline", err)
			}
			d.ActividadEn = actividad
			d.Estado = estadoDescarga(d.RevocadaEn, d.ExpiraEn)
			out.Body.Descargas = append(out.Body.Descargas, d)
		}
		if err := rows.Err(); err != nil {
			return nil, huma.Error500InternalServerError("error leyendo las licencias offline", err)
		}
		return out, nil
	}
}

type dispositivoPath struct {
	InstallID string `path:"installId" doc:"Identificador de instalación del dispositivo"`
}

func estadoDescarga(revocadaEn *time.Time, expiraEn time.Time) string {
	switch {
	case revocadaEn != nil:
		return "revocada"
	case !expiraEn.After(time.Now()):
		return "vencida"
	default:
		return "vigente"
	}
}
