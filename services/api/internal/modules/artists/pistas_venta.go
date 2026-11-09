package artists

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"

	"triomision/api/internal/apierr"
	"triomision/api/internal/auth"
	"triomision/api/internal/authz"
	"triomision/api/internal/database"
)

// Venta de pistas. Una pista es un audio del grupo que se vende aparte y se
// VINCULA a una canción (tracks.song_id) con su propio precio (producto tipo
// track + oferta). La letra de la canción nunca se vende por separado. Solo
// grupos con can_sell_tracks pueden vincular; el admin lo habilita.

// RegisterPistasVenta registra el alta de pistas y la vinculación con canciones.
func RegisterPistasVenta(api huma.API, db database.DB) {
	managers := authz.RequireArtistRole(api, db, "artistId", "manager")
	seguridad := []map[string][]string{{"bearer": {}}}

	huma.Register(api, huma.Operation{
		OperationID:   "artistas-crear-pista",
		Method:        http.MethodPost,
		Path:          "/api/v1/mis-artistas/{artistId}/pistas",
		Summary:       "Crear una pista del grupo (manager o admin)",
		Description:   "Registra una pista (audio) del grupo. Aún no está a la venta: se vincula a una canción con PUT …/canciones/{songId}/pista.",
		Tags:          []string{"artistas", "pistas"},
		Security:      seguridad,
		Middlewares:   []func(huma.Context, func(huma.Context)){managers},
		DefaultStatus: http.StatusCreated,
	}, crearPista(db))

	huma.Register(api, huma.Operation{
		OperationID: "artistas-listar-pistas",
		Method:      http.MethodGet,
		Path:        "/api/v1/mis-artistas/{artistId}/pistas",
		Summary:     "Pistas del grupo (manager o admin)",
		Description: "Pistas del grupo y la canción a la que están vinculadas, si alguna.",
		Tags:        []string{"artistas", "pistas"},
		Security:    seguridad,
		Middlewares: []func(huma.Context, func(huma.Context)){managers},
	}, listarPistas(db))

	huma.Register(api, huma.Operation{
		OperationID: "artistas-vincular-pista",
		Method:      http.MethodPut,
		Path:        "/api/v1/mis-artistas/{artistId}/canciones/{songId}/pista",
		Summary:     "Vincular una pista a la venta a una canción (manager o admin)",
		Description: "Vincula una pista del grupo a la canción con su precio. Requiere que el grupo esté habilitado para vender pistas. Una canción tiene como máximo una pista vinculada.",
		Tags:        []string{"artistas", "pistas"},
		Security:    seguridad,
		Middlewares: []func(huma.Context, func(huma.Context)){managers},
	}, vincularPista(db))

	huma.Register(api, huma.Operation{
		OperationID: "artistas-desvincular-pista",
		Method:      http.MethodDelete,
		Path:        "/api/v1/mis-artistas/{artistId}/canciones/{songId}/pista",
		Summary:     "Desvincular la pista de una canción (manager o admin)",
		Description: "Quita la venta de la pista de la canción. La pista se conserva en el grupo.",
		Tags:        []string{"artistas", "pistas"},
		Security:    seguridad,
		Middlewares: []func(huma.Context, func(huma.Context)){managers},
	}, desvincularPista(db))
}

type grupoPath struct {
	ArtistID string `path:"artistId" format:"uuid" doc:"ID del grupo"`
}

type crearPistaInput struct {
	ArtistID string `path:"artistId" format:"uuid" doc:"ID del grupo"`
	Body     struct {
		Titulo      string  `json:"titulo" minLength:"1" maxLength:"200" doc:"Nombre de la pista"`
		Descripcion *string `json:"descripcion,omitempty" maxLength:"500"`
	}
}

type pistaOut struct {
	Body struct {
		ID     string `json:"id"`
		Titulo string `json:"titulo"`
	}
}

func crearPista(db database.DB) func(context.Context, *crearPistaInput) (*pistaOut, error) {
	return func(ctx context.Context, in *crearPistaInput) (*pistaOut, error) {
		claims, _ := auth.ClaimsFromContext(ctx)
		out := &pistaOut{}
		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, apierr.Internal("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)
		err = tx.QueryRow(ctx, `
			insert into tracks (artist_id, title, description, track_type, is_published)
			values ($1, $2, $3, 'audio', false)
			returning id::text, title`, in.ArtistID, in.Body.Titulo, in.Body.Descripcion).
			Scan(&out.Body.ID, &out.Body.Titulo)
		if err != nil {
			return nil, apierr.Internal("error creando la pista", err)
		}
		if err := registrarAuditoria(ctx, tx, claims.Subject, "pista.creada", "tracks", out.Body.ID,
			map[string]any{"artista_id": in.ArtistID}); err != nil {
			return nil, apierr.Internal("error registrando auditoría", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, apierr.Internal("error confirmando la pista", err)
		}
		return out, nil
	}
}

type pistaItem struct {
	ID        string  `json:"id"`
	Titulo    string  `json:"titulo"`
	CancionID *string `json:"cancion_id,omitempty" doc:"Canción a la que está vinculada, si alguna"`
}

type listarPistasOutput struct {
	Body struct {
		Pistas []pistaItem `json:"pistas"`
	}
}

func listarPistas(db database.DB) func(context.Context, *grupoPath) (*listarPistasOutput, error) {
	return func(ctx context.Context, in *grupoPath) (*listarPistasOutput, error) {
		rows, err := db.Query(ctx, `
			select id::text, title, song_id::text from tracks
			where artist_id = $1 and deleted_at is null
			order by title`, in.ArtistID)
		if err != nil {
			return nil, apierr.Internal("error consultando las pistas", err)
		}
		defer rows.Close()
		out := &listarPistasOutput{}
		out.Body.Pistas = []pistaItem{}
		for rows.Next() {
			var p pistaItem
			if err := rows.Scan(&p.ID, &p.Titulo, &p.CancionID); err != nil {
				return nil, apierr.Internal("error leyendo las pistas", err)
			}
			out.Body.Pistas = append(out.Body.Pistas, p)
		}
		if err := rows.Err(); err != nil {
			return nil, apierr.Internal("error leyendo las pistas", err)
		}
		return out, nil
	}
}

type vincularPistaInput struct {
	ArtistID string `path:"artistId" format:"uuid" doc:"ID del grupo"`
	SongID   string `path:"songId" format:"uuid" doc:"ID de la canción"`
	Body     struct {
		TrackID     string `json:"track_id" format:"uuid" doc:"Pista del grupo a vincular"`
		PrecioMinor int64  `json:"precio_minor" minimum:"1" maximum:"100000000" doc:"Precio en la unidad menor de la moneda (centavos)"`
		Moneda      string `json:"moneda,omitempty" default:"BOB" enum:"BOB,USD" doc:"Moneda del precio"`
	}
}

type vinculoPistaOutput struct {
	Body struct {
		CancionID   string    `json:"cancion_id"`
		TrackID     string    `json:"track_id"`
		PrecioMinor int64     `json:"precio_minor"`
		Moneda      string    `json:"moneda"`
		Momento     time.Time `json:"momento"`
	}
}

// asegurarGrupoVende comprueba que el grupo está habilitado para vender pistas.
func asegurarGrupoVende(ctx context.Context, tx pgx.Tx, grupoID string) error {
	var vende bool
	err := tx.QueryRow(ctx, `select can_sell_tracks from artists where id = $1 and deleted_at is null for update`, grupoID).Scan(&vende)
	if errors.Is(err, pgx.ErrNoRows) {
		return huma.Error404NotFound("grupo no encontrado")
	}
	if err != nil {
		return apierr.Internal("error consultando el grupo", err)
	}
	if !vende {
		return huma.Error422UnprocessableEntity("el grupo no está habilitado para vender pistas; lo habilita el administrador")
	}
	return nil
}

func vincularPista(db database.DB) func(context.Context, *vincularPistaInput) (*vinculoPistaOutput, error) {
	return func(ctx context.Context, in *vincularPistaInput) (*vinculoPistaOutput, error) {
		claims, _ := auth.ClaimsFromContext(ctx)
		moneda := in.Body.Moneda
		if moneda == "" {
			moneda = "BOB"
		}
		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, apierr.Internal("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)

		if err := asegurarGrupoVende(ctx, tx, in.ArtistID); err != nil {
			return nil, err
		}

		// La canción debe pertenecer al grupo.
		var cancionTitulo string
		err = tx.QueryRow(ctx, `
			select s.title from songs s join albums al on al.id = s.album_id
			where s.id = $1 and al.artist_id = $2 and s.deleted_at is null and al.deleted_at is null`,
			in.SongID, in.ArtistID).Scan(&cancionTitulo)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("canción no encontrada")
		}
		if err != nil {
			return nil, apierr.Internal("error consultando la canción", err)
		}

		// La pista debe ser del grupo y no estar vinculada a otra canción.
		var trackTitulo string
		var trackSong *string
		err = tx.QueryRow(ctx, `
			select title, song_id::text from tracks where id = $1 and artist_id = $2 and deleted_at is null for update`,
			in.Body.TrackID, in.ArtistID).Scan(&trackTitulo, &trackSong)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("pista no encontrada")
		}
		if err != nil {
			return nil, apierr.Internal("error consultando la pista", err)
		}
		if trackSong != nil && *trackSong != in.SongID {
			return nil, huma.Error409Conflict("la pista ya está vinculada a otra canción")
		}

		// Una canción tiene como máximo una pista vinculada.
		var otra string
		err = tx.QueryRow(ctx, `
			select id::text from tracks where song_id = $1 and id <> $2 and deleted_at is null limit 1`,
			in.SongID, in.Body.TrackID).Scan(&otra)
		if err == nil {
			return nil, huma.Error409Conflict("la canción ya tiene una pista vinculada; desvincúlala primero")
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return nil, apierr.Internal("error revisando la canción", err)
		}

		if _, err := tx.Exec(ctx, `update tracks set song_id = $2 where id = $1`, in.Body.TrackID, in.SongID); err != nil {
			return nil, apierr.Internal("error vinculando la pista", err)
		}

		// Producto de tipo pista: se crea una vez y se reutiliza.
		var productoID string
		err = tx.QueryRow(ctx, `
			select p.id::text from products p join product_items pi on pi.product_id = p.id
			where p.product_type = 'track' and pi.track_id = $1 limit 1`, in.Body.TrackID).Scan(&productoID)
		if errors.Is(err, pgx.ErrNoRows) {
			if err := tx.QueryRow(ctx, `
				insert into products (artist_id, product_type, title, active)
				values ($1, 'track', $2, true) returning id::text`, in.ArtistID, trackTitulo).Scan(&productoID); err != nil {
				return nil, apierr.Internal("error creando el producto", err)
			}
			if _, err := tx.Exec(ctx, `
				insert into product_items (product_id, track_id, sort_order) values ($1, $2, 0)`,
				productoID, in.Body.TrackID); err != nil {
				return nil, apierr.Internal("error asociando la pista al producto", err)
			}
		} else if err != nil {
			return nil, apierr.Internal("error consultando el producto", err)
		}
		if _, err := tx.Exec(ctx, `update products set active = true where id = $1`, productoID); err != nil {
			return nil, apierr.Internal("error activando el producto", err)
		}

		// Precio: se actualiza la oferta activa o se crea una.
		tag, err := tx.Exec(ctx, `
			update offers set amount_minor = $2, currency = $3
			where product_id = $1 and active`, productoID, in.Body.PrecioMinor, moneda)
		if err != nil {
			return nil, apierr.Internal("error actualizando el precio", err)
		}
		if tag.RowsAffected() == 0 {
			if _, err := tx.Exec(ctx, `
				insert into offers (product_id, amount_minor, currency, sales_channel, active)
				values ($1, $2, $3, 'web', true)`, productoID, in.Body.PrecioMinor, moneda); err != nil {
				return nil, apierr.Internal("error creando el precio", err)
			}
		}

		if err := registrarAuditoria(ctx, tx, claims.Subject, "pista.vinculada", "tracks", in.Body.TrackID,
			map[string]any{"cancion_id": in.SongID, "precio_minor": in.Body.PrecioMinor, "moneda": moneda}); err != nil {
			return nil, apierr.Internal("error registrando auditoría", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, apierr.Internal("error confirmando la vinculación", err)
		}
		out := &vinculoPistaOutput{}
		out.Body.CancionID = in.SongID
		out.Body.TrackID = in.Body.TrackID
		out.Body.PrecioMinor = in.Body.PrecioMinor
		out.Body.Moneda = moneda
		out.Body.Momento = time.Now()
		return out, nil
	}
}

type desvincularPistaInput struct {
	ArtistID string `path:"artistId" format:"uuid" doc:"ID del grupo"`
	SongID   string `path:"songId" format:"uuid" doc:"ID de la canción"`
}

type desvincularPistaOutput struct {
	Body struct {
		CancionID     string `json:"cancion_id"`
		Desvinculadas int    `json:"desvinculadas"`
	}
}

func desvincularPista(db database.DB) func(context.Context, *desvincularPistaInput) (*desvincularPistaOutput, error) {
	return func(ctx context.Context, in *desvincularPistaInput) (*desvincularPistaOutput, error) {
		claims, _ := auth.ClaimsFromContext(ctx)
		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, apierr.Internal("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)

		var existe bool
		if err := tx.QueryRow(ctx, `
			select exists (select 1 from songs s join albums al on al.id = s.album_id
			  where s.id = $1 and al.artist_id = $2 and s.deleted_at is null)`, in.SongID, in.ArtistID).Scan(&existe); err != nil {
			return nil, apierr.Internal("error consultando la canción", err)
		}
		if !existe {
			return nil, huma.Error404NotFound("canción no encontrada")
		}

		// Las ofertas de las pistas desvinculadas se desactivan; el producto se conserva.
		if _, err := tx.Exec(ctx, `
			update offers set active = false where product_id in (
			  select pi.product_id from product_items pi join tracks t on t.id = pi.track_id
			  where t.song_id = $1)`, in.SongID); err != nil {
			return nil, apierr.Internal("error desactivando el precio", err)
		}
		if _, err := tx.Exec(ctx, `
			update products set active = false where id in (
			  select pi.product_id from product_items pi join tracks t on t.id = pi.track_id
			  where t.song_id = $1)`, in.SongID); err != nil {
			return nil, apierr.Internal("error desactivando el producto", err)
		}
		tag, err := tx.Exec(ctx, `update tracks set song_id = null where song_id = $1`, in.SongID)
		if err != nil {
			return nil, apierr.Internal("error desvinculando la pista", err)
		}
		if err := registrarAuditoria(ctx, tx, claims.Subject, "pista.desvinculada", "songs", in.SongID,
			map[string]any{"artista_id": in.ArtistID}); err != nil {
			return nil, apierr.Internal("error registrando auditoría", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, apierr.Internal("error confirmando la desvinculación", err)
		}
		out := &desvincularPistaOutput{}
		out.Body.CancionID = in.SongID
		out.Body.Desvinculadas = int(tag.RowsAffected())
		return out, nil
	}
}
