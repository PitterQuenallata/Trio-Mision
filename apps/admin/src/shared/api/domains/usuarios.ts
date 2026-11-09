// Usuarios y roles para administración (solo admin). Tipos del OpenAPI generado.
import { api, unwrap } from '../client';
import type { components, paths } from '../generated/openapi';

export type MembresiaUsuario = components['schemas']['MembresiaUsuario'];

/**
 * Usuario tal como lo usa el panel. El esquema OpenAPI marca las listas como
 * nullables; aquí se normalizan a arrays vacíos.
 */
export type UsuarioStaff = Omit<components['schemas']['UsuarioStaff'], 'staff_roles' | 'artist_memberships'> & {
  staff_roles: string[];
  artist_memberships: MembresiaUsuario[];
};

export type RolStaff = NonNullable<
  NonNullable<paths['/api/v1/staff/usuarios']['get']['parameters']['query']>['rol']
>;

export const usuariosApi = {
  /** Busca cuentas por correo o nombre (admin). Con menos de 2 caracteres no busca. */
  buscar: async (q: string, limite = 20): Promise<UsuarioStaff[]> => {
    if (q.trim().length < 2) return [];
    const body = await unwrap(api.GET('/api/v1/staff/usuarios', { params: { query: { q: q.trim() } } }));
    return (body.usuarios ?? []).slice(0, limite).map((u) => ({
      ...u,
      staff_roles: u.staff_roles ?? [],
      artist_memberships: u.artist_memberships ?? [],
    }));
  },
  /** Usuarios con sus roles. Filtro opcional por rol staff. */
  list: async (rol?: RolStaff): Promise<UsuarioStaff[]> => {
    const body = await unwrap(api.GET('/api/v1/staff/usuarios', { params: { query: { rol } } }));
    return (body.usuarios ?? []).map((u) => ({
      ...u,
      staff_roles: u.staff_roles ?? [],
      artist_memberships: u.artist_memberships ?? [],
    }));
  },
};

/** Acciones de administración de cuentas y roles (solo admin). */
export const adminUsuariosApi = {
  /** Crea una cuenta staff con correo confirmado y un rol inicial. */
  crear: async (input: { email: string; password: string; display_name?: string; rol: RolStaff }) => {
    return unwrap(api.POST('/api/v1/staff/usuarios', { body: input }));
  },
  /** Concede (true) o quita (false) un rol staff. */
  cambiarRol: async (userId: string, rol: RolStaff, conceder: boolean): Promise<void> => {
    if (conceder) {
      await unwrap(api.PUT('/api/v1/staff/usuarios/{id}/roles/{rol}', { params: { path: { id: userId, rol } } }));
    } else {
      await unwrap(api.DELETE('/api/v1/staff/usuarios/{id}/roles/{rol}', { params: { path: { id: userId, rol } } }));
    }
  },
  /** Añade (true) o quita (false) un manager de un artista. */
  cambiarManager: async (artistId: string, userId: string, conceder: boolean): Promise<void> => {
    if (conceder) {
      await unwrap(api.PUT('/api/v1/staff/artistas/{artistId}/managers/{userId}', { params: { path: { artistId, userId } } }));
    } else {
      await unwrap(api.DELETE('/api/v1/staff/artistas/{artistId}/managers/{userId}', { params: { path: { artistId, userId } } }));
    }
  },
};
