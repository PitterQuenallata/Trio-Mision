// Importación de PDF a ChordPro (staff): subir, revisar, corregir y publicar.
// Tipos del OpenAPI generado. El destino de un álbum se fija al subir y la
// publicación lo usa por defecto.
import { api, unwrap } from '../client';
import type { components } from '../generated/openapi';

export type ImportacionResumen = components['schemas']['ImportacionResumen'];
export type ImportacionDetalle = components['schemas']['ObtenerImportacionOutputBody'];
export type CancionImportada = components['schemas']['CancionImportada'];

export type EstadoImportacion = 'queued' | 'running' | 'done' | 'failed';

/** Edición de una canción de la revisión (solo los campos que cambian). */
export interface EdicionCancion {
  titulo?: string;
  numero?: number;
  tono?: string;
  capo?: number;
  autor?: string;
  chordpro?: string;
}

export const importacionesApi = {
  /**
   * Sube el PDF de un álbum enrutado a ese álbum del grupo. La clave idempotente
   * evita duplicar el job si se reenvía el mismo archivo.
   */
  subirPdfAlbum: async (archivo: File, grupoId: string, albumId: string, claveIdempotente: string): Promise<ImportacionResumen> => {
    const form = new FormData();
    form.append('archivo', archivo);
    form.append('idempotency_key', claveIdempotente);
    form.append('grupo_id', grupoId);
    form.append('album_id', albumId);
    // openapi-fetch envía el FormData tal cual; el tipo generado describe el archivo como string.
    return unwrap(api.POST('/api/v1/staff/importaciones/pdf', {
      body: form as unknown as { archivo: string; idempotency_key: string },
    }));
  },
  listar: async (): Promise<ImportacionResumen[]> => {
    const body = await unwrap(api.GET('/api/v1/staff/importaciones', { params: { query: { limite: 20 } } }));
    return body.importaciones ?? [];
  },
  obtener: (id: string): Promise<ImportacionDetalle> =>
    unwrap(api.GET('/api/v1/staff/importaciones/{id}', { params: { path: { id } } })),
  /** Corrige una canción de la revisión antes de publicarla. */
  editarCancion: (id: string, indice: number, cambios: EdicionCancion): Promise<CancionImportada> =>
    unwrap(api.PATCH('/api/v1/staff/importaciones/{id}/canciones/{indice}', {
      params: { path: { id, indice } },
      body: cambios,
    })),
  /** Publica las canciones indicadas al álbum fijado al subir (sin repetir el destino). */
  publicar: (id: string, indices: number[]) =>
    unwrap(api.POST('/api/v1/staff/importaciones/{id}/publicar', {
      params: { path: { id } },
      body: { indices },
    })),
  reintentar: (id: string) =>
    unwrap(api.POST('/api/v1/staff/importaciones/{id}/reintentar', { params: { path: { id } } })),
};

/** Etiquetas de estado para mostrar al staff. */
export const etiquetaEstado: Record<EstadoImportacion, string> = {
  queued: 'En cola',
  running: 'Convirtiendo',
  done: 'Lista para revisar',
  failed: 'Falló',
};
