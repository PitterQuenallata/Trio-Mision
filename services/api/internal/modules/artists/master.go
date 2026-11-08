package artists

import (
	"bytes"
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"triomision/api/internal/apierr"

	"triomision/api/internal/auth"
	"triomision/api/internal/database"
	"triomision/api/internal/storage"
)

// maxMasterBytes es el máximo de la subida de un master de audio (100 MiB).
const maxMasterBytes = 100 << 20

// masterExt asocia el MIME de audio detectado por contenido a su extensión
// (net/http detecta RIFF/WAVE como audio/wave).
var masterExt = map[string]string{
	"audio/wav":       ".wav",
	"audio/wave":      ".wav",
	"audio/mpeg":      ".mp3",
	"audio/aiff":      ".aiff",
	"application/ogg": ".ogg",
}

type subirMasterInput struct {
	ArtistID string `path:"artistId" format:"uuid" doc:"ID del artista"`
	TrackID  string `path:"trackId" format:"uuid" doc:"ID de la pista del artista"`
	RawBody  huma.MultipartFormFiles[struct {
		Archivo huma.FormFile `form:"archivo" required:"true" doc:"Audio master (WAV, MP3, AIFF u OGG)"`
	}]
}

type subirMasterOutput struct {
	Body struct {
		PistaID         string    `json:"pista_id"`
		AssetID         string    `json:"asset_id"`
		Mime            string    `json:"mime"`
		ByteSize        int64     `json:"byte_size"`
		ChecksumSHA256  string    `json:"checksum_sha256"`
		MasterPublicado bool      `json:"master_publicado" doc:"true: el master quedó publicado para esta pista"`
		SubidoEn        time.Time `json:"subido_en"`
	}
}

// subirMaster publica el master de una pista del artista: sube el objeto
// privado a MinIO y en una misma transacción registra el media_asset, la
// relación track_media (role='master', is_published=true, despublicando el
// master anterior) y su auditoría. La pista puede seguir is_published=false
// en el catálogo: el acceso del comprador depende de su entitlement, no de la
// publicación en tienda.
func subirMaster(db database.DB, objects storage.Client) func(ctx context.Context, in *subirMasterInput) (*subirMasterOutput, error) {
	return func(ctx context.Context, in *subirMasterInput) (*subirMasterOutput, error) {
		claims, ok := auth.ClaimsFromContext(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("no autenticado")
		}

		// Alcance: la pista debe existir, no estar eliminada y ser de este
		// artista (la membresía manager ya quedó validada en el middleware).
		var existe bool
		if err := db.QueryRow(ctx, `
			select exists(select 1 from tracks where id = $1 and artist_id = $2 and deleted_at is null)`,
			in.TrackID, in.ArtistID).Scan(&existe); err != nil {
			return nil, apierr.Internal("error consultando la pista", err)
		}
		if !existe {
			return nil, huma.Error404NotFound("pista no encontrada en este artista")
		}

		archivo := in.RawBody.Data().Archivo
		if archivo.Size > maxMasterBytes {
			return nil, huma.Error422UnprocessableEntity("el master supera el máximo de 100 MiB")
		}
		header := make([]byte, 512)
		n, err := archivo.Read(header)
		if err != nil && !errors.Is(err, io.EOF) {
			return nil, huma.Error422UnprocessableEntity("no se pudo leer el master")
		}
		if _, err := archivo.Seek(0, io.SeekStart); err != nil {
			return nil, huma.Error422UnprocessableEntity("no se pudo leer el master")
		}
		mimeType := http.DetectContentType(header[:n])
		ext, allowed := masterExt[mimeType]
		if !allowed {
			return nil, huma.Error422UnprocessableEntity("el contenido no es audio WAV, MP3, AIFF u OGG")
		}

		data, err := io.ReadAll(archivo)
		if err != nil {
			return nil, huma.Error422UnprocessableEntity("no se pudo leer el master")
		}
		sum := sha256.Sum256(data)
		key := fmt.Sprintf("tracks/%s/master/%d%s", in.TrackID, time.Now().UnixNano(), ext)
		if err := objects.PutObject(ctx, key, mimeType, bytes.NewReader(data)); err != nil {
			return nil, apierr.Internal("error guardando el master", err)
		}

		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, apierr.Internal("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)

		var assetID string
		var subidoEn time.Time
		err = tx.QueryRow(ctx, `
			insert into media_assets (storage_key, media_type, mime_type, byte_size, checksum_sha256,
				visibility, processing_status)
			values ($1, 'audio', $2, $3, $4, 'private', 'ready')
			returning id, created_at`, key, mimeType, len(data), fmt.Sprintf("%x", sum),
		).Scan(&assetID, &subidoEn)
		if err != nil {
			return nil, apierr.Internal("error registrando el activo", err)
		}

		// Solo un master publicado por pista: se despublica el anterior.
		if _, err := tx.Exec(ctx, `
			update track_media set is_published = false
			where track_id = $1 and role = 'master' and is_published`, in.TrackID); err != nil {
			return nil, apierr.Internal("error despublicando el master anterior", err)
		}
		if _, err := tx.Exec(ctx, `
			insert into track_media (track_id, media_asset_id, role, is_published)
			values ($1, $2, 'master', true)
			on conflict (track_id, media_asset_id, role) do update set is_published = true`,
			in.TrackID, assetID); err != nil {
			return nil, apierr.Internal("error publicando el master", err)
		}
		if err := registrarAuditoria(ctx, tx, claims.Subject, "pista.master_subido", "track", in.TrackID,
			map[string]any{"asset_id": assetID, "mime": mimeType, "bytes": len(data)}); err != nil {
			return nil, apierr.Internal("error registrando auditoría", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, apierr.Internal("error confirmando la transacción", err)
		}

		out := &subirMasterOutput{}
		out.Body.PistaID = in.TrackID
		out.Body.AssetID = assetID
		out.Body.Mime = mimeType
		out.Body.ByteSize = int64(len(data))
		out.Body.ChecksumSHA256 = fmt.Sprintf("%x", sum)
		out.Body.MasterPublicado = true
		out.Body.SubidoEn = subidoEn
		return out, nil
	}
}
