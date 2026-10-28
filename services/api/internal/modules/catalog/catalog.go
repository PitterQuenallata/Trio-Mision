// Package catalog expone el catálogo público (artistas, álbumes, canciones)
// en solo lectura.
package catalog

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"

	"triomision/api/internal/database"
)

// Register registra los endpoints públicos de lectura del catálogo.
func Register(api huma.API, db database.DB) {
	huma.Register(api, huma.Operation{
		OperationID: "catalog-listar-artistas",
		Method:      http.MethodGet,
		Path:        "/api/v1/catalogo/artistas",
		Summary:     "Lista de artistas",
		Description: "Artistas publicados del catálogo.",
		Tags:        []string{"catalogo"},
	}, listarArtistas(db))

	huma.Register(api, huma.Operation{
		OperationID: "catalog-obtener-artista",
		Method:      http.MethodGet,
		Path:        "/api/v1/catalogo/artistas/{slug}",
		Summary:     "Detalle de un artista",
		Description: "Artista publicado con sus álbumes y canciones publicados (sin contenido ChordPro).",
		Tags:        []string{"catalogo"},
	}, obtenerArtista(db))

	huma.Register(api, huma.Operation{
		OperationID: "catalog-obtener-cancion",
		Method:      http.MethodGet,
		Path:        "/api/v1/catalogo/canciones/{id}",
		Summary:     "Detalle de una canción",
		Description: "Canción publicada con su contenido ChordPro si su acceso es libre; si requiere premium o compra, responde 403.",
		Tags:        []string{"catalogo"},
	}, obtenerCancion(db))
}

type artistaResumen struct {
	ID       string          `json:"id"`
	Slug     string          `json:"slug" example:"trio-mision"`
	Nombre   string          `json:"nombre" example:"Trio Misión"`
	Estilo   string          `json:"estilo,omitempty" example:"Trío"`
	Pais     string          `json:"pais,omitempty" example:"Bolivia"`
	Bio      string          `json:"bio,omitempty"`
	CoverKey string          `json:"cover_key,omitempty"`
	Redes    json.RawMessage `json:"redes" doc:"Enlaces sociales (social_links)"`
}

type listarArtistasOutput struct {
	Body struct {
		Artistas []artistaResumen `json:"artistas"`
	}
}

const artistaColumnas = `
	a.id, a.slug, a.name, coalesce(s.name, ''), coalesce(a.country, ''),
	coalesce(a.bio, ''), coalesce(a.cover_key, ''), a.social_links`

func listarArtistas(db database.DB) func(context.Context, *struct{}) (*listarArtistasOutput, error) {
	return func(ctx context.Context, _ *struct{}) (*listarArtistasOutput, error) {
		rows, err := db.Query(ctx, `
			select`+artistaColumnas+`
			from artists a
			left join styles s on s.id = a.style_id
			where a.is_published and a.deleted_at is null
			order by a.name`)
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando el catálogo", err)
		}
		defer rows.Close()

		out := &listarArtistasOutput{}
		out.Body.Artistas = []artistaResumen{}
		for rows.Next() {
			var a artistaResumen
			if err := rows.Scan(&a.ID, &a.Slug, &a.Nombre, &a.Estilo, &a.Pais, &a.Bio, &a.CoverKey, &a.Redes); err != nil {
				return nil, huma.Error500InternalServerError("error leyendo el catálogo", err)
			}
			out.Body.Artistas = append(out.Body.Artistas, a)
		}
		if err := rows.Err(); err != nil {
			return nil, huma.Error500InternalServerError("error leyendo el catálogo", err)
		}
		return out, nil
	}
}

type cancionResumen struct {
	ID      string `json:"id"`
	Titulo  string `json:"titulo"`
	Tono    string `json:"tono,omitempty"`
	Capo    *int   `json:"capo,omitempty"`
	BPM     *int   `json:"bpm,omitempty"`
	Autor   string `json:"autor,omitempty"`
	Arreglo string `json:"arreglista,omitempty"`
	Acceso  string `json:"acceso" example:"free" doc:"free | premium | purchase | creator"`
	Orden   int    `json:"orden"`
}

type albumItem struct {
	ID        string           `json:"id"`
	Titulo    string           `json:"titulo"`
	Anio      *int             `json:"anio,omitempty"`
	CoverKey  string           `json:"cover_key,omitempty"`
	Canciones []cancionResumen `json:"canciones"`
}

type obtenerArtistaInput struct {
	Slug string `path:"slug" doc:"Slug del artista"`
}

type obtenerArtistaOutput struct {
	Body struct {
		ID       string          `json:"id"`
		Slug     string          `json:"slug"`
		Nombre   string          `json:"nombre"`
		Estilo   string          `json:"estilo,omitempty"`
		Pais     string          `json:"pais,omitempty"`
		Bio      string          `json:"bio,omitempty"`
		CoverKey string          `json:"cover_key,omitempty"`
		Redes    json.RawMessage `json:"redes"`
		Albumes  []albumItem     `json:"albumes"`
	}
}

func obtenerArtista(db database.DB) func(context.Context, *obtenerArtistaInput) (*obtenerArtistaOutput, error) {
	return func(ctx context.Context, in *obtenerArtistaInput) (*obtenerArtistaOutput, error) {
		out := &obtenerArtistaOutput{}
		out.Body.Albumes = []albumItem{}

		err := db.QueryRow(ctx, `
			select`+artistaColumnas+`
			from artists a
			left join styles s on s.id = a.style_id
			where a.slug = $1 and a.is_published and a.deleted_at is null`, in.Slug,
		).Scan(&out.Body.ID, &out.Body.Slug, &out.Body.Nombre, &out.Body.Estilo,
			&out.Body.Pais, &out.Body.Bio, &out.Body.CoverKey, &out.Body.Redes)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("artista no encontrado")
		}
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando el artista", err)
		}

		// Un solo viaje: álbumes y canciones publicados del artista, agrupados en memoria.
		rows, err := db.Query(ctx, `
			select al.id, al.title, al.year, coalesce(al.cover_key, ''),
			       s.id, s.title, coalesce(s.original_key, ''), s.capo, s.bpm,
			       coalesce(s.author, ''), coalesce(s.arranger, ''),
			       s.publication_access, s.sort_order
			from albums al
			left join songs s
			       on s.album_id = al.id and s.is_published and s.deleted_at is null
			where al.artist_id = $1 and al.is_published and al.deleted_at is null
			order by al.sort_order, al.title, s.sort_order, s.title`, out.Body.ID)
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando los álbumes", err)
		}
		defer rows.Close()

		indices := map[string]int{}
		for rows.Next() {
			var (
				albumID, albumTitulo, cover string
				anio                        *int
				cancion                     cancionResumen
				cancionID                   *string
			)
			if err := rows.Scan(&albumID, &albumTitulo, &anio, &cover,
				&cancionID, &cancion.Titulo, &cancion.Tono, &cancion.Capo, &cancion.BPM,
				&cancion.Autor, &cancion.Arreglo, &cancion.Acceso, &cancion.Orden); err != nil {
				return nil, huma.Error500InternalServerError("error leyendo los álbumes", err)
			}
			idx, ok := indices[albumID]
			if !ok {
				indices[albumID] = len(out.Body.Albumes)
				out.Body.Albumes = append(out.Body.Albumes, albumItem{
					ID: albumID, Titulo: albumTitulo, Anio: anio, CoverKey: cover,
					Canciones: []cancionResumen{},
				})
				idx = len(out.Body.Albumes) - 1
			}
			if cancionID != nil {
				cancion.ID = *cancionID
				out.Body.Albumes[idx].Canciones = append(out.Body.Albumes[idx].Canciones, cancion)
			}
		}
		if err := rows.Err(); err != nil {
			return nil, huma.Error500InternalServerError("error leyendo los álbumes", err)
		}
		return out, nil
	}
}

type obtenerCancionInput struct {
	ID string `path:"id" format:"uuid" doc:"ID de la canción"`
}

type obtenerCancionOutput struct {
	Body struct {
		ID       string `json:"id"`
		Titulo   string `json:"titulo"`
		Tono     string `json:"tono,omitempty"`
		Capo     *int   `json:"capo,omitempty"`
		BPM      *int   `json:"bpm,omitempty"`
		Autor    string `json:"autor,omitempty"`
		Arreglo  string `json:"arreglista,omitempty"`
		Acceso   string `json:"acceso" doc:"free | premium | purchase | creator"`
		Orden    int    `json:"orden"`
		Artista  string `json:"artista"`
		Album    string `json:"album"`
		Chordpro string `json:"chordpro,omitempty" doc:"Presente solo si el acceso es libre"`
	}
}

func obtenerCancion(db database.DB) func(context.Context, *obtenerCancionInput) (*obtenerCancionOutput, error) {
	return func(ctx context.Context, in *obtenerCancionInput) (*obtenerCancionOutput, error) {
		out := &obtenerCancionOutput{}
		var chordpro string
		err := db.QueryRow(ctx, `
			select s.id, s.title, coalesce(s.original_key, ''), s.capo, s.bpm,
			       coalesce(s.author, ''), coalesce(s.arranger, ''), s.publication_access,
			       s.sort_order, ar.name, al.title, s.chordpro
			from songs s
			join albums al on al.id = s.album_id
			join artists ar on ar.id = al.artist_id
			where s.id = $1
			  and s.is_published and s.deleted_at is null
			  and al.is_published and al.deleted_at is null
			  and ar.is_published and ar.deleted_at is null`, in.ID,
		).Scan(&out.Body.ID, &out.Body.Titulo, &out.Body.Tono, &out.Body.Capo, &out.Body.BPM,
			&out.Body.Autor, &out.Body.Arreglo, &out.Body.Acceso, &out.Body.Orden,
			&out.Body.Artista, &out.Body.Album, &chordpro)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("canción no encontrada")
		}
		if err != nil {
			return nil, huma.Error500InternalServerError("error consultando la canción", err)
		}
		if out.Body.Acceso != "free" {
			return nil, huma.Error403Forbidden("el contenido de esta canción requiere premium o compra")
		}
		out.Body.Chordpro = chordpro
		return out, nil
	}
}
