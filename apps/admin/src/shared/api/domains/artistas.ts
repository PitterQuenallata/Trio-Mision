// Artistas: catálogo público (lista de referencia) y artistas que administra
// el usuario (manager). Tipos del OpenAPI generado.
import { api, unwrap } from '../client';
import type { components } from '../generated/openapi';

export type ArtistaResumen = components['schemas']['ArtistaResumen'];
export type ArtistaMio = components['schemas']['ArtistaMio'];
export type ObtenerMio = components['schemas']['ObtenerMioOutputBody'];

export const artistasApi = {
  /** Artistas del catálogo público (para elegir artista al asignar managers). */
  listarCatalogo: async (): Promise<ArtistaResumen[]> => {
    const body = await unwrap(api.GET('/api/v1/catalogo/artistas', {}));
    return body.artistas ?? [];
  },
  /** Artistas donde el usuario actual es member o manager. */
  listarMios: async (): Promise<ArtistaMio[]> => {
    const body = await unwrap(api.GET('/api/v1/mis-artistas', {}));
    return body.artistas ?? [];
  },
  /** Detalle de un artista del usuario, con sus álbumes. */
  obtenerMio: (artistId: string): Promise<ObtenerMio> =>
    unwrap(api.GET('/api/v1/mis-artistas/{artistId}', { params: { path: { artistId } } })),
};

export type ArtistaBusqueda = components['schemas']['ArtistaBusqueda'];

/**
 * Busca artistas por nombre o slug (solo admin). Se usa al escribir: nunca
 * carga el catálogo completo. Con menos de 2 caracteres no devuelve nada.
 */
export const buscarArtistasStaff = async (q: string, limite = 20): Promise<ArtistaBusqueda[]> => {
  const body = await unwrap(api.GET('/api/v1/staff/artistas', { params: { query: { q, limite } } }));
  return body.artistas ?? [];
};
