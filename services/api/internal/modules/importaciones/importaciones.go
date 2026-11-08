// Package importaciones implementa la importación editorial PDF→ChordPro:
// un staff (admin/vendedor) sube un PDF con letra y acordes; la API crea un
// media_job encolado con el PDF como media_asset privado en MinIO (imports/);
// el worker (services/worker) lo convierte con un algoritmo determinista y
// llena result_json. La conversión es editorial y el worker JAMÁS escribe en
// el catálogo: solo la API publica, tras la revisión humana explícita, las
// canciones aprobadas como borradores (is_published=false) en un álbum o en
// el himnario. Nada se publica sin revisión.
package importaciones

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"triomision/api/internal/apierr"

	"triomision/api/internal/auth"
	"triomision/api/internal/authz"
	"triomision/api/internal/database"
	"triomision/api/internal/storage"
)

// maxPDFBytes es el máximo de la subida de un PDF editorial (20 MiB).
const maxPDFBytes = 20 << 20

// pdfExt asocia el MIME detectado por contenido a su extensión.
var pdfExt = map[string]string{
	"application/pdf": ".pdf",
}

// uuidRe valida UUIDs recibidos por cuerpo JSON (los path params ya los
// valida Huma con format:"uuid", pero los campos condicionales del destino
// se validan a mano, igual que los formularios multipart).
var uuidRe = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// estadosValidos filtra el listado staff.
var estadosValidos = map[string]bool{
	"queued": true, "running": true, "done": true, "failed": true,
}

// Register registra los endpoints staff de importaciones bajo
// /api/v1/staff/importaciones (admin/vendedor; editor → 403).
func Register(api huma.API, db database.DB, objects storage.Client, presignTTL time.Duration) {
	staff := authz.RequireStaff(api, db, "admin", "vendedor")

	huma.Register(api, huma.Operation{
		OperationID: "staff-importaciones-subir-pdf",
		Method:      http.MethodPost,
		Path:        "/api/v1/staff/importaciones/pdf",
		Summary:     "Subir un PDF editorial para convertir a ChordPro",
		Description: "Multipart con PDF de máximo 20 MiB (MIME detectado por contenido) y " +
			"idempotency_key. Sube el PDF a MinIO (imports/, privado), crea el media_job encolado " +
			"(pdf_chordpro) con su media_asset de entrada y audita importacion.creada en la misma " +
			"transacción. Repetir la clave con el mismo archivo devuelve el job original; con otro " +
			"archivo devuelve 409.",
		MaxBodyBytes: maxPDFBytes + 64*1024,
		Tags:         []string{"staff"},
		Security:     []map[string][]string{{"bearer": {}}},
		Middlewares:  []func(huma.Context, func(huma.Context)){staff},
	}, subirPDF(db, objects))

	huma.Register(api, huma.Operation{
		OperationID: "staff-importaciones-listar",
		Method:      http.MethodGet,
		Path:        "/api/v1/staff/importaciones",
		Summary:     "Listar importaciones",
		Description: "Jobs de importación con filtro opcional por estado " +
			"(queued | running | done | failed) y paginación limite/desde.",
		Tags:        []string{"staff"},
		Security:    []map[string][]string{{"bearer": {}}},
		Middlewares: []func(huma.Context, func(huma.Context)){staff},
	}, listar(db))

	huma.Register(api, huma.Operation{
		OperationID: "staff-importaciones-obtener",
		Method:      http.MethodGet,
		Path:        "/api/v1/staff/importaciones/{id}",
		Summary:     "Detalle de una importación",
		Description: "Estado, progreso, error_code y, cuando el job está done, el resultado: " +
			"canciones con título, número, tono, capo, autor, ChordPro, status (ok | revisar) e " +
			"issues, más los índices ya publicados. Incluye URL firmada breve del PDF original " +
			"(privado en MinIO). Inexistente → 404.",
		Tags:        []string{"staff"},
		Security:    []map[string][]string{{"bearer": {}}},
		Middlewares: []func(huma.Context, func(huma.Context)){staff},
	}, obtener(db, objects, presignTTL))

	huma.Register(api, huma.Operation{
		OperationID: "staff-importaciones-publicar",
		Method:      http.MethodPost,
		Path:        "/api/v1/staff/importaciones/{id}/publicar",
		Summary:     "Publicar canciones aprobadas como borradores",
		Description: "Transacción idempotente: crea las canciones (destino tipo=album) o himnos con " +
			"su versión chords_full (tipo=himnario) como BORRADORES (is_published=false), solo de " +
			"índices aprobados de un job done. Los índices publicados quedan marcados en result_json: " +
			"repetir la publicación de los mismos índices devuelve el estado actual sin duplicar filas. " +
			"Los himnos cuyo (colección, número) ya existen se reportan en ya_existentes. Auditoría " +
			"importacion.publicada en la misma transacción.",
		Tags:        []string{"staff"},
		Security:    []map[string][]string{{"bearer": {}}},
		Middlewares: []func(huma.Context, func(huma.Context)){staff},
	}, publicar(db))

	huma.Register(api, huma.Operation{
		OperationID: "staff-importaciones-reintentar",
		Method:      http.MethodPost,
		Path:        "/api/v1/staff/importaciones/{id}/reintentar",
		Summary:     "Reintentar una importación fallida",
		Description: "Solo jobs failed: vuelve a queued limpiando error, progreso, resultado y " +
			"fechas, para que el worker lo procese de nuevo. Auditoría importacion.reintentada.",
		Tags:        []string{"staff"},
		Security:    []map[string][]string{{"bearer": {}}},
		Middlewares: []func(huma.Context, func(huma.Context)){staff},
	}, reintentar(db))
}

// ── Tipos de respuesta ─────────────────────────────────────────────────────

type importacionResumen struct {
	ID             string     `json:"id"`
	Tipo           string     `json:"tipo" doc:"pdf_chordpro"`
	Estado         string     `json:"estado" doc:"queued | running | done | failed"`
	Progreso       int        `json:"progreso" doc:"0-100"`
	ErrorCode      *string    `json:"error_code"`
	ToolVersion    *string    `json:"tool_version" doc:"Versión del conversor que procesó el job"`
	TotalCanciones int        `json:"total_canciones"`
	CreadoPor      string     `json:"creado_por"`
	CreadoEn       time.Time  `json:"creado_en"`
	IniciadoEn     *time.Time `json:"iniciado_en"`
	CompletadoEn   *time.Time `json:"completado_en"`
}

type cancionImportada struct {
	Indice   int      `json:"indice"`
	Titulo   string   `json:"titulo"`
	Numero   *int     `json:"numero"`
	Tono     *string  `json:"tono"`
	Capo     *int     `json:"capo"`
	Autor    *string  `json:"autor"`
	ChordPro string   `json:"chordpro"`
	Status   string   `json:"status" doc:"ok | revisar"`
	Issues   []string `json:"issues"`
}

type publicadoItem struct {
	Indice int    `json:"indice"`
	Tipo   string `json:"tipo" doc:"cancion | himno"`
	ID     string `json:"id"`
	Titulo string `json:"titulo"`
}

type destinoPublicacion struct {
	Tipo        string `json:"tipo" doc:"album | himnario"`
	AlbumID     string `json:"album_id,omitempty"`
	ColeccionID string `json:"coleccion_id,omitempty"`
}

type pdfAdjunto struct {
	AssetID  string `json:"asset_id"`
	Mime     string `json:"mime"`
	ByteSize int64  `json:"byte_size"`
	URL      string `json:"url" doc:"URL firmada breve del PDF privado"`
}

// resultadoImportacion es la forma de media_jobs.result_json: la escribe el
// worker (tool_version, total_canciones, canciones, publicados vacío) y la API
// enriquece publicados al publicar borradores.
type resultadoImportacion struct {
	ToolVersion    string             `json:"tool_version"`
	TotalCanciones int                `json:"total_canciones"`
	Canciones      []cancionImportada `json:"canciones"`
	Publicados     []publicadoItem    `json:"publicados"`
}

// ── Subida del PDF ─────────────────────────────────────────────────────────

type subirPDFInput struct {
	RawBody huma.MultipartFormFiles[struct {
		Archivo        huma.FormFile `form:"archivo" required:"true" doc:"PDF editorial con letra y acordes (máximo 20 MiB)"`
		IdempotencyKey string        `form:"idempotency_key" required:"true" minLength:"8" maxLength:"128" doc:"Clave de cliente: repetirla con el mismo archivo devuelve el mismo job"`
	}]
}

type subirPDFOutput struct {
	Body importacionResumen
}

// subirPDF guarda el PDF en MinIO y en una misma transacción registra el
// media_asset, el media_job encolado, su vínculo de entrada y la auditoría.
// La clave idempotente es por staff: mismo archivo → mismo job; otro → 409.
func subirPDF(db database.DB, objects storage.Client) func(ctx context.Context, in *subirPDFInput) (*subirPDFOutput, error) {
	return func(ctx context.Context, in *subirPDFInput) (*subirPDFOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}

		archivo := in.RawBody.Data().Archivo
		if archivo.Size > maxPDFBytes {
			return nil, huma.Error422UnprocessableEntity("el PDF supera el máximo de 20 MiB")
		}
		mimeType, err := detectarMIME(archivo)
		if err != nil {
			return nil, err
		}
		data, err := io.ReadAll(archivo)
		if err != nil {
			return nil, huma.Error422UnprocessableEntity("no se pudo leer el PDF")
		}
		sum := sha256.Sum256(data)
		checksum := fmt.Sprintf("%x", sum)
		clave := in.RawBody.Data().IdempotencyKey

		// Reintento idempotente: el job ya existe para esta clave.
		var existente importacionResumen
		var checksumExistente string
		err = db.QueryRow(ctx, `
			select id, job_type, status, progress, error_code, tool_version,
			       coalesce((result_json->>'total_canciones')::int, 0),
			       created_by, created_at, started_at, completed_at,
			       coalesce(parameters_json->>'sha256', '')
			from media_jobs
			where created_by = $1 and idempotency_key = $2`, claims.Subject, clave,
		).Scan(&existente.ID, &existente.Tipo, &existente.Estado, &existente.Progreso,
			&existente.ErrorCode, &existente.ToolVersion, &existente.TotalCanciones,
			&existente.CreadoPor, &existente.CreadoEn, &existente.IniciadoEn,
			&existente.CompletadoEn, &checksumExistente)
		if err == nil {
			if checksumExistente != checksum {
				return nil, huma.Error409Conflict("la clave idempotente ya fue usada con otro archivo")
			}
			out := &subirPDFOutput{}
			out.Body = existente
			return out, nil
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return nil, apierr.Internal("error consultando la importación", err)
		}

		key := fmt.Sprintf("imports/%s.pdf", nuevoUUID())
		if err := objects.PutObject(ctx, key, mimeType, bytes.NewReader(data)); err != nil {
			return nil, apierr.Internal("error guardando el PDF", err)
		}

		parameters, _ := json.Marshal(map[string]any{
			"archivo": archivo.Filename, "mime": mimeType,
			"bytes": len(data), "sha256": checksum,
		})

		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, apierr.Internal("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)

		var assetID string
		err = tx.QueryRow(ctx, `
			insert into media_assets (storage_key, media_type, mime_type, byte_size, checksum_sha256,
				visibility, processing_status)
			values ($1, 'pdf', $2, $3, $4, 'private', 'ready')
			returning id`, key, mimeType, len(data), checksum).Scan(&assetID)
		if err != nil {
			return nil, apierr.Internal("error registrando el activo", err)
		}

		var job importacionResumen
		err = tx.QueryRow(ctx, `
			insert into media_jobs (job_type, parameters_json, created_by, idempotency_key)
			values ('pdf_chordpro', $1, $2, $3)
			returning id, job_type, status, progress, created_by, created_at`,
			parameters, claims.Subject, clave,
		).Scan(&job.ID, &job.Tipo, &job.Estado, &job.Progreso, &job.CreadoPor, &job.CreadoEn)
		if err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23505" {
				// Carrera de dos subidas con la misma clave: la segunda
				// re-lee y compara el checksum como un reintento normal.
				if selErr := db.QueryRow(ctx, `
					select id, job_type, status, progress, error_code, tool_version,
					       coalesce((result_json->>'total_canciones')::int, 0),
					       created_by, created_at, started_at, completed_at,
					       coalesce(parameters_json->>'sha256', '')
					from media_jobs
					where created_by = $1 and idempotency_key = $2`, claims.Subject, clave,
				).Scan(&existente.ID, &existente.Tipo, &existente.Estado, &existente.Progreso,
					&existente.ErrorCode, &existente.ToolVersion, &existente.TotalCanciones,
					&existente.CreadoPor, &existente.CreadoEn, &existente.IniciadoEn,
					&existente.CompletadoEn, &checksumExistente); selErr == nil {
					if checksumExistente != checksum {
						return nil, huma.Error409Conflict("la clave idempotente ya fue usada con otro archivo")
					}
					out := &subirPDFOutput{}
					out.Body = existente
					return out, nil
				}
			}
			return nil, apierr.Internal("error creando la importación", err)
		}
		if _, err := tx.Exec(ctx, `
			insert into media_job_assets (media_job_id, media_asset_id, input_output_role)
			values ($1, $2, 'input')`, job.ID, assetID); err != nil {
			return nil, apierr.Internal("error vinculando el activo de entrada", err)
		}
		if err := registrarAuditoria(ctx, tx, claims.Subject, "importacion.creada", "media_job", job.ID,
			map[string]any{"asset_id": assetID, "mime": mimeType, "bytes": len(data)}); err != nil {
			return nil, apierr.Internal("error registrando auditoría", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, apierr.Internal("error confirmando la transacción", err)
		}
		out := &subirPDFOutput{}
		out.Body = job
		return out, nil
	}
}

// ── Listado ────────────────────────────────────────────────────────────────

type listarImportacionesInput struct {
	Estado string `query:"estado" required:"false" doc:"Filtro opcional: queued | running | done | failed"`
	Limite int    `query:"limite" required:"false" minimum:"1" maximum:"100" default:"20" doc:"Máximo de resultados"`
	Desde  int    `query:"desde" required:"false" minimum:"0" default:"0" doc:"Desplazamiento (offset)"`
}

type listarImportacionesOutput struct {
	Body struct {
		Importaciones []importacionResumen `json:"importaciones"`
	}
}

func listar(db database.DB) func(ctx context.Context, in *listarImportacionesInput) (*listarImportacionesOutput, error) {
	return func(ctx context.Context, in *listarImportacionesInput) (*listarImportacionesOutput, error) {
		if in.Estado != "" && !estadosValidos[in.Estado] {
			return nil, huma.Error422UnprocessableEntity("estado no válido")
		}
		out := &listarImportacionesOutput{}
		out.Body.Importaciones = []importacionResumen{}

		query := `
			select id, job_type, status, progress, error_code, tool_version,
			       coalesce((result_json->>'total_canciones')::int, 0),
			       created_by, created_at, started_at, completed_at
			from media_jobs`
		args := []any{}
		if in.Estado != "" {
			query += ` where status = $1`
			args = append(args, in.Estado)
		}
		query += ` order by created_at desc limit $` + fmt.Sprint(len(args)+1) +
			` offset $` + fmt.Sprint(len(args)+2)
		args = append(args, in.Limite, in.Desde)

		rows, err := db.Query(ctx, query, args...)
		if err != nil {
			return nil, apierr.Internal("error consultando las importaciones", err)
		}
		defer rows.Close()
		for rows.Next() {
			var j importacionResumen
			if err := rows.Scan(&j.ID, &j.Tipo, &j.Estado, &j.Progreso, &j.ErrorCode, &j.ToolVersion,
				&j.TotalCanciones, &j.CreadoPor, &j.CreadoEn, &j.IniciadoEn, &j.CompletadoEn); err != nil {
				return nil, apierr.Internal("error leyendo las importaciones", err)
			}
			out.Body.Importaciones = append(out.Body.Importaciones, j)
		}
		if err := rows.Err(); err != nil {
			return nil, apierr.Internal("error leyendo las importaciones", err)
		}
		return out, nil
	}
}

// ── Detalle ────────────────────────────────────────────────────────────────

type importacionPath struct {
	ID string `path:"id" format:"uuid" doc:"ID de la importación"`
}

type obtenerImportacionOutput struct {
	Body struct {
		ID             string             `json:"id"`
		Tipo           string             `json:"tipo"`
		Estado         string             `json:"estado"`
		Progreso       int                `json:"progreso"`
		ErrorCode      *string            `json:"error_code"`
		ToolVersion    *string            `json:"tool_version"`
		TotalCanciones int                `json:"total_canciones"`
		CreadoPor      string             `json:"creado_por"`
		CreadoEn       time.Time          `json:"creado_en"`
		IniciadoEn     *time.Time         `json:"iniciado_en"`
		CompletadoEn   *time.Time         `json:"completado_en"`
		PDF            *pdfAdjunto        `json:"pdf"`
		Canciones      []cancionImportada `json:"canciones"`
		Publicados     []publicadoItem    `json:"publicados"`
	}
}

func obtener(db database.DB, objects storage.Client, presignTTL time.Duration) func(ctx context.Context, in *importacionPath) (*obtenerImportacionOutput, error) {
	return func(ctx context.Context, in *importacionPath) (*obtenerImportacionOutput, error) {
		out := &obtenerImportacionOutput{}
		out.Body.Canciones = []cancionImportada{}
		out.Body.Publicados = []publicadoItem{}

		var resultJSON []byte
		err := db.QueryRow(ctx, `
			select id, job_type, status, progress, error_code, tool_version,
			       coalesce((result_json->>'total_canciones')::int, 0),
			       created_by, created_at, started_at, completed_at, result_json
			from media_jobs where id = $1`, in.ID,
		).Scan(&out.Body.ID, &out.Body.Tipo, &out.Body.Estado, &out.Body.Progreso,
			&out.Body.ErrorCode, &out.Body.ToolVersion, &out.Body.TotalCanciones,
			&out.Body.CreadoPor, &out.Body.CreadoEn, &out.Body.IniciadoEn,
			&out.Body.CompletadoEn, &resultJSON)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("importación no encontrada")
		}
		if err != nil {
			return nil, apierr.Internal("error consultando la importación", err)
		}

		var assetID, storageKey, mime string
		var byteSize int64
		err = db.QueryRow(ctx, `
			select a.id, a.storage_key, a.mime_type, a.byte_size
			from media_job_assets jma
			join media_assets a on a.id = jma.media_asset_id
			where jma.media_job_id = $1 and jma.input_output_role = 'input'`, in.ID,
		).Scan(&assetID, &storageKey, &mime, &byteSize)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return nil, apierr.Internal("error consultando el PDF de entrada", err)
		}
		if err == nil {
			url, err := objects.PresignGet(ctx, storageKey, presignTTL)
			if err != nil {
				return nil, apierr.Internal("error firmando el PDF", err)
			}
			out.Body.PDF = &pdfAdjunto{AssetID: assetID, Mime: mime, ByteSize: byteSize, URL: url}
		}

		if len(resultJSON) > 0 {
			var res resultadoImportacion
			if err := json.Unmarshal(resultJSON, &res); err != nil {
				return nil, apierr.Internal("error leyendo el resultado", err)
			}
			if res.Canciones != nil {
				out.Body.Canciones = res.Canciones
			}
			if res.Publicados != nil {
				out.Body.Publicados = res.Publicados
			}
		}
		return out, nil
	}
}

// ── Publicación de borradores ──────────────────────────────────────────────

type publicarImportacionInput struct {
	ID   string `path:"id" format:"uuid" doc:"ID de la importación"`
	Body struct {
		Indices []int `json:"indices" minItems:"1" doc:"Índices de canciones aprobadas del resultado"`
		Destino struct {
			Tipo        string `json:"tipo" enum:"album,himnario" doc:"album: canciones de un álbum; himnario: himnos de una colección"`
			AlbumID     string `json:"album_id,omitempty" doc:"UUID del álbum destino (obligatorio con tipo=album)"`
			ColeccionID string `json:"coleccion_id,omitempty" doc:"UUID de la colección del himnario (obligatorio con tipo=himnario)"`
		} `json:"destino"`
	}
}

type publicarImportacionOutput struct {
	Body struct {
		ImportacionID string             `json:"importacion_id"`
		Destino       destinoPublicacion `json:"destino"`
		Creados       []publicadoItem    `json:"creados"`
		YaPublicados  []int              `json:"ya_publicados"`
		YaExistentes  []int              `json:"ya_existentes"`
		TotalCreados  int                `json:"total_creados"`
	}
}

// publicar crea las canciones/himnos aprobados como borradores en la misma
// transacción, marca los índices en result_json y audita. Repetir los mismos
// índices no duplica filas: se reportan en ya_publicados.
func publicar(db database.DB) func(ctx context.Context, in *publicarImportacionInput) (*publicarImportacionOutput, error) {
	return func(ctx context.Context, in *publicarImportacionInput) (*publicarImportacionOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}

		// Validación manual del destino (campos condicionales).
		destino := destinoPublicacion{Tipo: in.Body.Destino.Tipo, AlbumID: in.Body.Destino.AlbumID, ColeccionID: in.Body.Destino.ColeccionID}
		switch destino.Tipo {
		case "album":
			if destino.AlbumID == "" || !uuidRe.MatchString(destino.AlbumID) {
				return nil, huma.Error422UnprocessableEntity("destino.album_id debe ser un UUID válido")
			}
			if destino.ColeccionID != "" {
				return nil, huma.Error422UnprocessableEntity("destino.coleccion_id no aplica con tipo=album")
			}
		case "himnario":
			if destino.ColeccionID == "" || !uuidRe.MatchString(destino.ColeccionID) {
				return nil, huma.Error422UnprocessableEntity("destino.coleccion_id debe ser un UUID válido")
			}
			if destino.AlbumID != "" {
				return nil, huma.Error422UnprocessableEntity("destino.album_id no aplica con tipo=himnario")
			}
		default:
			return nil, huma.Error422UnprocessableEntity("destino.tipo debe ser album o himnario")
		}

		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, apierr.Internal("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)

		var estado string
		var resultJSON []byte
		err = tx.QueryRow(ctx, `
			select status, coalesce(result_json, '{}'::jsonb)
			from media_jobs where id = $1
			for update`, in.ID).Scan(&estado, &resultJSON)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("importación no encontrada")
		}
		if err != nil {
			return nil, apierr.Internal("error consultando la importación", err)
		}
		if estado != "done" {
			return nil, huma.Error409Conflict("la importación no está lista para publicar (estado " + estado + ")")
		}

		var res resultadoImportacion
		if err := json.Unmarshal(resultJSON, &res); err != nil {
			return nil, apierr.Internal("error leyendo el resultado", err)
		}

		// Índices deduplicados preservando el orden pedido.
		indices := []int{}
		visto := map[int]bool{}
		for _, idx := range in.Body.Indices {
			if idx < 0 || idx >= len(res.Canciones) {
				return nil, huma.Error422UnprocessableEntity(fmt.Sprintf("el índice %d no existe en el resultado", idx))
			}
			if !visto[idx] {
				visto[idx] = true
				indices = append(indices, idx)
			}
		}
		if destino.Tipo == "himnario" {
			for _, idx := range indices {
				if res.Canciones[idx].Numero == nil {
					return nil, huma.Error422UnprocessableEntity(fmt.Sprintf("el índice %d no tiene número de himno detectado", idx))
				}
			}
		}

		// El destino debe existir (staff editorial actúa sobre cualquier
		// artista/colección; la existencia no se revela a no-staff).
		switch destino.Tipo {
		case "album":
			var existe bool
			if err := tx.QueryRow(ctx, `
				select exists(select 1 from albums where id = $1 and deleted_at is null)`, destino.AlbumID,
			).Scan(&existe); err != nil {
				return nil, apierr.Internal("error consultando el álbum", err)
			}
			if !existe {
				return nil, huma.Error404NotFound("álbum destino no encontrado")
			}
		case "himnario":
			var existe bool
			if err := tx.QueryRow(ctx, `
				select exists(select 1 from hymn_collections where id = $1)`, destino.ColeccionID,
			).Scan(&existe); err != nil {
				return nil, apierr.Internal("error consultando la colección", err)
			}
			if !existe {
				return nil, huma.Error404NotFound("colección del himnario no encontrada")
			}
		}

		publicadosPorIndice := map[int]bool{}
		for _, p := range res.Publicados {
			publicadosPorIndice[p.Indice] = true
		}

		out := &publicarImportacionOutput{}
		out.Body.ImportacionID = in.ID
		out.Body.Destino = destino
		out.Body.Creados = []publicadoItem{}
		out.Body.YaPublicados = []int{}
		out.Body.YaExistentes = []int{}

		var sortOrder int
		if destino.Tipo == "album" {
			if err := tx.QueryRow(ctx, `
				select coalesce(max(sort_order), 0) from songs where album_id = $1`, destino.AlbumID,
			).Scan(&sortOrder); err != nil {
				return nil, apierr.Internal("error consultando el álbum", err)
			}
		}

		for _, idx := range indices {
			if publicadosPorIndice[idx] {
				out.Body.YaPublicados = append(out.Body.YaPublicados, idx)
				continue
			}
			cancion := res.Canciones[idx]
			switch destino.Tipo {
			case "album":
				sortOrder++
				var songID string
				err := tx.QueryRow(ctx, `
					insert into songs (album_id, title, chordpro, original_key, capo, author, sort_order, is_published)
					values ($1, $2, $3, $4, $5, $6, $7, false)
					returning id`,
					destino.AlbumID, cancion.Titulo, cancion.ChordPro, cancion.Tono, cancion.Capo,
					cancion.Autor, sortOrder).Scan(&songID)
				if err != nil {
					return nil, apierr.Internal("error creando la canción", err)
				}
				item := publicadoItem{Indice: idx, Tipo: "cancion", ID: songID, Titulo: cancion.Titulo}
				out.Body.Creados = append(out.Body.Creados, item)
				res.Publicados = append(res.Publicados, item)
			case "himnario":
				var hymnID string
				err := tx.QueryRow(ctx, `
					insert into hymns (collection_id, hymn_number, title)
					values ($1, $2, $3)
					on conflict (collection_id, hymn_number) do nothing
					returning id`,
					destino.ColeccionID, *cancion.Numero, cancion.Titulo).Scan(&hymnID)
				if errors.Is(err, pgx.ErrNoRows) {
					// El himno ya existe en la colección: no se toca (el
					// himnario versionado congela su contenido).
					out.Body.YaExistentes = append(out.Body.YaExistentes, idx)
					continue
				}
				if err != nil {
					return nil, apierr.Internal("error creando el himno", err)
				}
				var versionID string
				err = tx.QueryRow(ctx, `
					insert into hymn_versions (hymn_id, version_code, chord_scope, chordpro, original_key, capo, is_published)
					values ($1, 'chords_full', 'full_song', $2, $3, $4, false)
					returning id`,
					hymnID, cancion.ChordPro, cancion.Tono, cancion.Capo).Scan(&versionID)
				if err != nil {
					return nil, apierr.Internal("error creando la versión del himno", err)
				}
				item := publicadoItem{Indice: idx, Tipo: "himno", ID: versionID, Titulo: cancion.Titulo}
				out.Body.Creados = append(out.Body.Creados, item)
				res.Publicados = append(res.Publicados, item)
			}
		}
		out.Body.TotalCreados = len(out.Body.Creados)

		resultadoNuevo, err := json.Marshal(res)
		if err != nil {
			return nil, apierr.Internal("error actualizando el resultado", err)
		}
		if _, err := tx.Exec(ctx, `
			update media_jobs set result_json = $2 where id = $1`, in.ID, resultadoNuevo); err != nil {
			return nil, apierr.Internal("error guardando los índices publicados", err)
		}
		destinoID := destino.AlbumID
		if destino.Tipo == "himnario" {
			destinoID = destino.ColeccionID
		}
		if err := registrarAuditoria(ctx, tx, claims.Subject, "importacion.publicada", "media_job", in.ID,
			map[string]any{
				"destino_tipo":    destino.Tipo,
				"destino_id":      destinoID,
				"total_creados":   out.Body.TotalCreados,
				"indices_creados": out.Body.Creados,
				"ya_publicados":   out.Body.YaPublicados,
				"ya_existentes":   out.Body.YaExistentes,
			}); err != nil {
			return nil, apierr.Internal("error registrando auditoría", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, apierr.Internal("error confirmando la transacción", err)
		}
		return out, nil
	}
}

// ── Reintento ──────────────────────────────────────────────────────────────

type reintentarImportacionOutput struct {
	Body struct {
		ID     string `json:"id"`
		Estado string `json:"estado" doc:"queued"`
	}
}

// reintentar vuelve a encolar un job failed limpiando su resultado. Un job
// running huérfano (worker muerto a mitad) se reseta manualmente por SQL por
// ahora (documentado en services/worker/README.md).
func reintentar(db database.DB) func(ctx context.Context, in *importacionPath) (*reintentarImportacionOutput, error) {
	return func(ctx context.Context, in *importacionPath) (*reintentarImportacionOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}

		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, apierr.Internal("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)

		var estado string
		err = tx.QueryRow(ctx, `
			select status from media_jobs where id = $1 for update`, in.ID).Scan(&estado)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("importación no encontrada")
		}
		if err != nil {
			return nil, apierr.Internal("error consultando la importación", err)
		}
		if estado != "failed" {
			return nil, huma.Error409Conflict("solo los jobs fallidos admiten reintento")
		}
		if _, err := tx.Exec(ctx, `
			update media_jobs
			set status = 'queued', progress = 0, error_code = null, result_json = null,
			    tool_version = null, started_at = null, completed_at = null
			where id = $1`, in.ID); err != nil {
			return nil, apierr.Internal("error reencolando la importación", err)
		}
		if err := registrarAuditoria(ctx, tx, claims.Subject, "importacion.reintentada", "media_job", in.ID, nil); err != nil {
			return nil, apierr.Internal("error registrando auditoría", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, apierr.Internal("error confirmando la transacción", err)
		}
		out := &reintentarImportacionOutput{}
		out.Body.ID = in.ID
		out.Body.Estado = "queued"
		return out, nil
	}
}

// ── Helpers ────────────────────────────────────────────────────────────────

// detectarMIME lee la cabecera del archivo y exige PDF por contenido.
func detectarMIME(archivo huma.FormFile) (string, error) {
	header := make([]byte, 512)
	n, err := archivo.Read(header)
	if err != nil && !errors.Is(err, io.EOF) {
		return "", huma.Error422UnprocessableEntity("no se pudo leer el PDF")
	}
	if _, err := archivo.Seek(0, io.SeekStart); err != nil {
		return "", huma.Error422UnprocessableEntity("no se pudo leer el PDF")
	}
	mimeType := http.DetectContentType(header[:n])
	if _, allowed := pdfExt[mimeType]; !allowed {
		return "", huma.Error422UnprocessableEntity("el contenido no es un PDF válido")
	}
	return mimeType, nil
}

// nuevoUUID genera un UUID v4 (para la clave del objeto en MinIO).
func nuevoUUID() string {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		panic(err)
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

// registrarAuditoria inserta un evento de auditoría (usa la tx activa).
func registrarAuditoria(ctx context.Context, q database.Querier, actorID, action, entityType, entityID string, metadata map[string]any) error {
	if metadata == nil {
		metadata = map[string]any{}
	}
	_, err := q.Exec(ctx, `
		insert into audit_events (actor_id, action, entity_type, entity_id, metadata)
		values ($1, $2, $3, $4, $5)`, actorID, action, entityType, entityID, metadata)
	return err
}
