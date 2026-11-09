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
	"triomision/api/internal/storage"
)

// Gestión de la discografía (manager del grupo y admin). A diferencia de la
// ficha pública de /mis-artistas, incluye borradores (álbumes y canciones no
// publicados) para poder editarlos antes de publicar.

// RegisterDiscografia registra la lectura de gestión y la reordenación de canciones.
func RegisterDiscografia(api huma.API, db database.DB, objects storage.Client) {
	managers := authz.RequireArtistRole(api, db, "artistId", "manager")
	seguridad := []map[string][]string{{"bearer": {}}}

	huma.Register(api, huma.Operation{
		OperationID: "artistas-gestion-discografia",
		Method:      http.MethodGet,
		Path:        "/api/v1/mis-artistas/{artistId}/discografia",
		Summary:     "Discografía completa para gestión (manager o admin)",
		Description: "Álbumes, EP y sencillos con todas sus canciones, publicadas o en borrador, en orden. " +
			"Solo manager del grupo o admin.",
		Tags:        []string{"artistas", "discografia"},
		Security:    seguridad,
		Middlewares: []func(huma.Context, func(huma.Context)){managers},
	}, obtenerDiscografia(db, objects))

	huma.Register(api, huma.Operation{
		OperationID: "artistas-ordenar-canciones",
		Method:      http.MethodPut,
		Path:        "/api/v1/mis-artistas/{artistId}/albumes/{albumId}/orden",
		Summary:     "Ordenar las canciones de un álbum (manager o admin)",
		Description: "Recibe la lista completa de canciones del álbum en el orden deseado. Debe incluir cada canción una sola vez.",
		Tags:        []string{"artistas", "discografia"},
		Security:    seguridad,
		Middlewares: []func(huma.Context, func(huma.Context)){managers},
	}, ordenarCanciones(db))
}

type discografiaInput struct {
	ArtistID string `path:"artistId" format:"uuid" doc:"ID del grupo"`
}

// pistaVinculada es la pista a la venta de una canción.
type pistaVinculada struct {
	ID          string `json:"id"`
	Titulo      string `json:"titulo"`
	PrecioMinor int64  `json:"precio_minor"`
	Moneda      string `json:"moneda"`
	Activa      bool   `json:"activa"`
}

type cancionGestion struct {
	ID         string          `json:"id"`
	Titulo     string          `json:"titulo"`
	Orden      int             `json:"orden"`
	Tono       string          `json:"tono,omitempty"`
	Capo       *int            `json:"capo,omitempty"`
	Bpm        *int            `json:"bpm,omitempty"`
	Autor      string          `json:"autor,omitempty"`
	Arreglista string          `json:"arreglista,omitempty"`
	Acceso     string          `json:"acceso" enum:"free,premium"`
	Publicado  bool            `json:"publicado"`
	Chordpro   string          `json:"chordpro" doc:"Letra y acordes en ChordPro"`
	Pista      *pistaVinculada `json:"pista,omitempty" doc:"Pista a la venta vinculada (solo si el grupo vende pistas)"`
}

type albumGestion struct {
	ID        string           `json:"id"`
	Tipo      string           `json:"tipo" enum:"album,ep,sencillo"`
	Titulo    string           `json:"titulo"`
	Anio      *int             `json:"anio,omitempty"`
	Orden     int              `json:"orden"`
	Publicado bool             `json:"publicado"`
	CoverURL  string           `json:"cover_url,omitempty"`
	Canciones []cancionGestion `json:"canciones"`
}

type discografiaOutput struct {
	Body struct {
		GrupoID     string         `json:"grupo_id"`
		Nombre      string         `json:"nombre"`
		VendePistas bool           `json:"vende_pistas" doc:"El grupo está habilitado para vender pistas"`
		Albumes     []albumGestion `json:"albumes"`
	}
}

func obtenerDiscografia(db database.DB, objects storage.Client) func(context.Context, *discografiaInput) (*discografiaOutput, error) {
	return func(ctx context.Context, in *discografiaInput) (*discografiaOutput, error) {
		out := &discografiaOutput{}
		out.Body.GrupoID = in.ArtistID
		out.Body.Albumes = []albumGestion{}

		err := db.QueryRow(ctx, `select name, can_sell_tracks from artists where id = $1 and deleted_at is null`, in.ArtistID).
			Scan(&out.Body.Nombre, &out.Body.VendePistas)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("grupo no encontrado")
		}
		if err != nil {
			return nil, apierr.Internal("error consultando el grupo", err)
		}

		rows, err := db.Query(ctx, `
			select id::text, tipo, title, year, coalesce(cover_key, ''), sort_order, is_published
			from albums where artist_id = $1 and deleted_at is null
			order by sort_order, title`, in.ArtistID)
		if err != nil {
			return nil, apierr.Internal("error consultando los álbumes", err)
		}
		indice := map[string]int{}
		for rows.Next() {
			var a albumGestion
			var anio *int
			var cover string
			if err := rows.Scan(&a.ID, &a.Tipo, &a.Titulo, &anio, &cover, &a.Orden, &a.Publicado); err != nil {
				rows.Close()
				return nil, apierr.Internal("error leyendo los álbumes", err)
			}
			a.Anio = anio
			if cover != "" {
				a.CoverURL = objects.PublicURL(cover)
			}
			a.Canciones = []cancionGestion{}
			indice[a.ID] = len(out.Body.Albumes)
			out.Body.Albumes = append(out.Body.Albumes, a)
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			return nil, apierr.Internal("error leyendo los álbumes", err)
		}

		songs, err := db.Query(ctx, `
			select s.id::text, s.album_id::text, s.title, s.sort_order, coalesce(s.original_key, ''), s.capo,
			       s.bpm, coalesce(s.author, ''), coalesce(s.arranger, ''), s.publication_access, s.is_published, s.chordpro
			from songs s join albums al on al.id = s.album_id
			where al.artist_id = $1 and al.deleted_at is null and s.deleted_at is null
			order by s.album_id, s.sort_order, s.title`, in.ArtistID)
		if err != nil {
			return nil, apierr.Internal("error consultando las canciones", err)
		}
		defer songs.Close()
		for songs.Next() {
			var c cancionGestion
			var albumID string
			var capo, bpm *int16
			if err := songs.Scan(&c.ID, &albumID, &c.Titulo, &c.Orden, &c.Tono, &capo, &bpm,
				&c.Autor, &c.Arreglista, &c.Acceso, &c.Publicado, &c.Chordpro); err != nil {
				return nil, apierr.Internal("error leyendo las canciones", err)
			}
			if capo != nil {
				v := int(*capo)
				c.Capo = &v
			}
			if bpm != nil {
				v := int(*bpm)
				c.Bpm = &v
			}
			if i, ok := indice[albumID]; ok {
				out.Body.Albumes[i].Canciones = append(out.Body.Albumes[i].Canciones, c)
			}
		}
		if err := songs.Err(); err != nil {
			return nil, apierr.Internal("error leyendo las canciones", err)
		}

		// Las pistas a la venta solo se muestran si el grupo vende pistas.
		if out.Body.VendePistas {
			vinculos, err := db.Query(ctx, `
				select t.song_id::text, t.id::text, t.title,
				       coalesce(pr.amount, 0), coalesce(pr.currency, 'BOB'), pr.amount is not null
				from tracks t
				left join lateral (
				  select o.amount_minor as amount, o.currency
				  from product_items pi
				  join products p on p.id = pi.product_id and p.product_type = 'track'
				  join offers o on o.product_id = p.id and o.active
				  where pi.track_id = t.id
				  order by o.amount_minor desc
				  limit 1
				) pr on true
				where t.artist_id = $1 and t.song_id is not null and t.deleted_at is null`, in.ArtistID)
			if err != nil {
				return nil, apierr.Internal("error consultando las pistas", err)
			}
			defer vinculos.Close()
			porCancion := map[string]pistaVinculada{}
			for vinculos.Next() {
				var songID string
				var pv pistaVinculada
				if err := vinculos.Scan(&songID, &pv.ID, &pv.Titulo, &pv.PrecioMinor, &pv.Moneda, &pv.Activa); err != nil {
					return nil, apierr.Internal("error leyendo las pistas", err)
				}
				porCancion[songID] = pv
			}
			if err := vinculos.Err(); err != nil {
				return nil, apierr.Internal("error leyendo las pistas", err)
			}
			for ai := range out.Body.Albumes {
				for ci := range out.Body.Albumes[ai].Canciones {
					c := &out.Body.Albumes[ai].Canciones[ci]
					if pv, ok := porCancion[c.ID]; ok {
						pvCopia := pv
						c.Pista = &pvCopia
					}
				}
			}
		}
		return out, nil
	}
}

type ordenarInput struct {
	ArtistID string `path:"artistId" format:"uuid" doc:"ID del grupo"`
	AlbumID  string `path:"albumId" format:"uuid" doc:"ID del álbum"`
	Body     struct {
		Canciones []string `json:"canciones" minItems:"1" maxItems:"500" doc:"IDs de todas las canciones del álbum, en el orden deseado"`
	}
}

type ordenarOutput struct {
	Body struct {
		AlbumID   string    `json:"album_id"`
		Canciones []string  `json:"canciones"`
		Momento   time.Time `json:"momento"`
	}
}

func ordenarCanciones(db database.DB) func(context.Context, *ordenarInput) (*ordenarOutput, error) {
	return func(ctx context.Context, in *ordenarInput) (*ordenarOutput, error) {
		claims, _ := auth.ClaimsFromContext(ctx)
		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, apierr.Internal("error iniciando la transacción", err)
		}
		defer tx.Rollback(ctx)

		// Bloquea el álbum: serializa reordenaciones concurrentes.
		var albumID string
		err = tx.QueryRow(ctx, `
			select id::text from albums where id = $1 and artist_id = $2 and deleted_at is null for update`,
			in.AlbumID, in.ArtistID).Scan(&albumID)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("álbum no encontrado")
		}
		if err != nil {
			return nil, apierr.Internal("error consultando el álbum", err)
		}

		actuales := map[string]bool{}
		rows, err := tx.Query(ctx, `select id::text from songs where album_id = $1 and deleted_at is null`, in.AlbumID)
		if err != nil {
			return nil, apierr.Internal("error consultando las canciones", err)
		}
		for rows.Next() {
			var id string
			if err := rows.Scan(&id); err != nil {
				rows.Close()
				return nil, apierr.Internal("error leyendo las canciones", err)
			}
			actuales[id] = true
		}
		rows.Close()

		enviadas := map[string]bool{}
		for _, id := range in.Body.Canciones {
			if enviadas[id] {
				return nil, huma.Error422UnprocessableEntity("una canción aparece más de una vez en la lista")
			}
			enviadas[id] = true
		}
		if len(enviadas) != len(actuales) {
			return nil, huma.Error422UnprocessableEntity("la lista debe incluir todas las canciones del álbum y solo esas")
		}
		for id := range enviadas {
			if !actuales[id] {
				return nil, huma.Error422UnprocessableEntity("una canción no pertenece a este álbum")
			}
		}

		for i, id := range in.Body.Canciones {
			if _, err := tx.Exec(ctx, `update songs set sort_order = $2 where id = $1`, id, i+1); err != nil {
				return nil, apierr.Internal("error ordenando las canciones", err)
			}
		}
		if err := registrarAuditoria(ctx, tx, claims.Subject, "album.canciones_ordenadas", "album", in.AlbumID,
			map[string]any{"artista_id": in.ArtistID, "total": len(in.Body.Canciones)}); err != nil {
			return nil, apierr.Internal("error registrando auditoría", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, apierr.Internal("error confirmando el orden", err)
		}
		out := &ordenarOutput{}
		out.Body.AlbumID = in.AlbumID
		out.Body.Canciones = in.Body.Canciones
		out.Body.Momento = time.Now()
		return out, nil
	}
}
