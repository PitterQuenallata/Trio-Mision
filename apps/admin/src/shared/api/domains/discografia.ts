// Discografía de un grupo para gestión (manager o admin): álbumes, EP,
// sencillos y canciones, publicados o en borrador. Tipos del OpenAPI generado.
import { api, unwrap } from '../client';
import type { components } from '../generated/openapi';

export type AlbumGestion = components['schemas']['AlbumGestion'];
export type CancionGestion = components['schemas']['CancionGestion'];
export type TipoLanzamiento = 'album' | 'ep' | 'sencillo';
export type Acceso = 'free' | 'premium';

export interface DatosLanzamiento {
  titulo: string;
  tipo: TipoLanzamiento;
  anio?: number;
  orden?: number;
  cover_key?: string;
}

export interface DatosCancion {
  titulo: string;
  chordpro: string;
  tono?: string;
  capo?: number;
  bpm?: number;
  autor?: string;
  arreglista?: string;
  acceso?: Acceso;
  orden?: number;
}

export const discografiaApi = {
  /** Discografía completa con borradores, ya ordenada. */
  obtener: async (grupoId: string) => {
    const d = await unwrap(api.GET('/api/v1/mis-artistas/{artistId}/discografia', {
      params: { path: { artistId: grupoId } },
    }));
    return {
      ...d,
      albumes: (d.albumes ?? []).map((a) => ({ ...a, canciones: a.canciones ?? [] })),
    };
  },
  crearLanzamiento: (grupoId: string, datos: DatosLanzamiento) =>
    unwrap(api.POST('/api/v1/mis-artistas/{artistId}/albumes', {
      params: { path: { artistId: grupoId } },
      body: datos,
    })),
  actualizarLanzamiento: (grupoId: string, albumId: string, cambios: Partial<DatosLanzamiento> & { publicado?: boolean }) =>
    unwrap(api.PATCH('/api/v1/mis-artistas/{artistId}/albumes/{albumId}', {
      params: { path: { artistId: grupoId, albumId } },
      body: cambios,
    })),
  crearCancion: (grupoId: string, albumId: string, datos: DatosCancion) =>
    unwrap(api.POST('/api/v1/mis-artistas/{artistId}/canciones', {
      params: { path: { artistId: grupoId } },
      body: { ...datos, album_id: albumId },
    })),
  actualizarCancion: (grupoId: string, cancionId: string, cambios: Partial<DatosCancion> & { publicada?: boolean }) =>
    unwrap(api.PATCH('/api/v1/mis-artistas/{artistId}/canciones/{songId}', {
      params: { path: { artistId: grupoId, songId: cancionId } },
      body: cambios,
    })),
  ordenarCanciones: (grupoId: string, albumId: string, canciones: string[]) =>
    unwrap(api.PUT('/api/v1/mis-artistas/{artistId}/albumes/{albumId}/orden', {
      params: { path: { artistId: grupoId, albumId } },
      body: { canciones },
    })),
};

/** Etiquetas de tipo de lanzamiento. */
export const etiquetaTipo: Record<TipoLanzamiento, string> = {
  album: 'Álbum',
  ep: 'EP',
  sencillo: 'Sencillo',
};

export interface PistaGrupo {
  id: string;
  titulo: string;
  cancion_id?: string;
}

/** Pistas del grupo para venta vinculada a canciones (solo si el grupo vende pistas). */
export const pistasApi = {
  listar: async (grupoId: string): Promise<PistaGrupo[]> => {
    const body = await unwrap(api.GET('/api/v1/mis-artistas/{artistId}/pistas', {
      params: { path: { artistId: grupoId } },
    }));
    return (body.pistas ?? []) as PistaGrupo[];
  },
  crear: (grupoId: string, titulo: string) =>
    unwrap(api.POST('/api/v1/mis-artistas/{artistId}/pistas', {
      params: { path: { artistId: grupoId } },
      body: { titulo },
    })),
  vincular: (grupoId: string, cancionId: string, trackId: string, precioMinor: number, moneda: 'BOB' | 'USD' = 'BOB') =>
    unwrap(api.PUT('/api/v1/mis-artistas/{artistId}/canciones/{songId}/pista', {
      params: { path: { artistId: grupoId, songId: cancionId } },
      body: { track_id: trackId, precio_minor: precioMinor, moneda },
    })),
  desvincular: (grupoId: string, cancionId: string) =>
    unwrap(api.DELETE('/api/v1/mis-artistas/{artistId}/canciones/{songId}/pista', {
      params: { path: { artistId: grupoId, songId: cancionId } },
    })),
};
