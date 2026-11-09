// Administración de grupos (solo admin). Tipos del OpenAPI generado.
import { api, unwrap } from '../client';
import type { components } from '../generated/openapi';

export type GrupoItem = components['schemas']['GrupoItem'];
export type GrupoDetalle = components['schemas']['GrupoDetalle'];
export type GestorGrupo = components['schemas']['GestorGrupo'];
export type AlbumMio = components['schemas']['AlbumResumen'];

export type RedesGrupo = Partial<Record<'instagram' | 'youtube' | 'spotify' | 'facebook' | 'tiktok' | 'x' | 'web', string>>;

export interface DatosGrupo {
  nombre: string;
  pais?: string;
  bio?: string;
  redes?: RedesGrupo;
  cover_key?: string;
  publicado?: boolean;
  vende_pistas?: boolean;
  comision_pct?: number;
}

/** Limpia las redes vacías antes de enviarlas. */
const redesLimpias = (redes?: RedesGrupo): Record<string, string> | undefined => {
  if (!redes) return undefined;
  const salida: Record<string, string> = {};
  for (const [red, enlace] of Object.entries(redes)) {
    if (enlace && enlace.trim()) salida[red] = enlace.trim();
  }
  return salida;
};

export const gruposApi = {
  /** Búsqueda de grupos. Sin texto devuelve los primeros resultados. */
  listar: async (q = '', limite = 100): Promise<GrupoItem[]> => {
    const body = await unwrap(api.GET('/api/v1/staff/grupos', { params: { query: { q, limite } } }));
    return body.grupos ?? [];
  },
  obtener: async (id: string): Promise<GrupoDetalle> => {
    const g = await unwrap(api.GET('/api/v1/staff/grupos/{id}', { params: { path: { id } } }));
    return { ...g, gestores: g.gestores ?? [], redes: g.redes ?? {} };
  },
  crear: (datos: DatosGrupo): Promise<GrupoDetalle> =>
    unwrap(api.POST('/api/v1/staff/grupos', { body: { ...datos, redes: redesLimpias(datos.redes) } })),
  actualizar: (id: string, datos: Partial<DatosGrupo>): Promise<GrupoDetalle> =>
    unwrap(api.PATCH('/api/v1/staff/grupos/{id}', {
      params: { path: { id } },
      body: { ...datos, redes: datos.redes ? redesLimpias(datos.redes) : undefined },
    })),
  crearAlbum: (grupoId: string, datos: { titulo: string; anio?: number; orden?: number; cover_key?: string }) =>
    unwrap(api.POST('/api/v1/mis-artistas/{artistId}/albumes', { params: { path: { artistId: grupoId } }, body: datos })),
};

/**
 * Sube una imagen pública (portada o logo) con la subida firmada del servidor.
 * Devuelve la clave que se guarda como `cover_key`.
 */
export async function subirImagenPublica(file: File, tipo: 'grupo' | 'album'): Promise<string> {
  const tipoMime = file.type as 'image/jpeg' | 'image/png' | 'image/webp';
  const preparada = await unwrap(api.POST('/api/v1/staff/imagenes', {
    body: { tipo, content_type: tipoMime },
  }));
  const form = new FormData();
  for (const [campo, valor] of Object.entries(preparada.fields ?? {})) form.append(campo, valor);
  form.append('file', file);
  const respuesta = await fetch(preparada.upload_url, { method: 'POST', body: form });
  if (!respuesta.ok && respuesta.status !== 204) {
    throw new Error('No se pudo subir la imagen. Revisa el tamaño (máx. 2 MB) y el formato.');
  }
  return preparada.key;
}

/** Vinculados de un grupo: alta, cambio de rol o de estado, y baja (solo admin). */
export const miembrosGrupoApi = {
  vincular: (grupoId: string, userId: string, rol: 'member' | 'manager') =>
    unwrap(api.POST('/api/v1/staff/grupos/{id}/miembros', {
      params: { path: { id: grupoId } },
      body: { user_id: userId, rol },
    })),
  actualizar: (grupoId: string, userId: string, cambios: { rol?: 'member' | 'manager'; activo?: boolean }) =>
    unwrap(api.PATCH('/api/v1/staff/grupos/{id}/miembros/{userId}', {
      params: { path: { id: grupoId, userId } },
      body: cambios,
    })),
  desvincular: (grupoId: string, userId: string) =>
    unwrap(api.DELETE('/api/v1/staff/grupos/{id}/miembros/{userId}', {
      params: { path: { id: grupoId, userId } },
    })),
};
