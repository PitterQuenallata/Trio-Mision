// Control de acceso del panel administrativo por rol. Es solo interfaz: la API
// autoriza de verdad en cada endpoint (staff_roles y artist_members).
//
// Reglas:
// - Entran al panel solo el staff (admin, editor, vendedor) y los managers de
//   algún artista. Un member, un cliente o un usuario de la APK no entran.
// - Cada ruta declara quién la ve. Una ruta no declarada se deniega.

import type { Identidad, StaffRole } from './types';

const ANY_STAFF: readonly StaffRole[] = ['admin', 'editor', 'vendedor'];

interface RouteRule {
  /** Roles staff que ven la ruta (cualquiera basta). */
  staff: readonly StaffRole[];
  /** Si true, también la ve un manager de algún artista. */
  managers?: boolean;
}

// Solo rutas que existen en el panel. Las secciones pendientes de conectar a la
// API no están aquí hasta que se implementen.
const ROUTE_RULES: Record<string, RouteRule> = {
  '/': { staff: ANY_STAFF, managers: true },
  '/dashboard': { staff: ANY_STAFF, managers: true },
  '/mi-grupo': { staff: [], managers: true },
  '/usuarios': { staff: ['admin'] },
  '/grupos': { staff: ['admin'] },
  '/grupos/:id': { staff: ['admin'] },
  '/grupos/:id/albumes/:albumId': { staff: ['admin'] },
  '/grupos/:id/nuevo': { staff: ['admin'] },
  // Vista del manager de su artista (la API valida que sea su artista).
  '/mi-grupo/:id': { staff: ['admin'], managers: true },
  '/mi-grupo/:id/albumes/:albumId': { staff: ['admin'], managers: true },
  '/mi-grupo/:id/nuevo': { staff: ['admin'], managers: true },
  // Importación de PDF de grupos: la API admite admin y vendedor.
  '/herramientas/grupos': { staff: ['admin', 'vendedor'] },
};

/** Clave de regla para una ruta concreta (las rutas con parámetros usan su patrón). */
export function ruleKey(pathname: string): string {
  if (/^\/(grupos|mi-grupo)\/[^/]+\/albumes\/[^/]+$/.test(pathname)) {
    return pathname.startsWith('/mi-grupo') ? '/mi-grupo/:id/albumes/:albumId' : '/grupos/:id/albumes/:albumId';
  }
  if (/^\/(grupos|mi-grupo)\/[^/]+\/nuevo$/.test(pathname)) {
    return pathname.startsWith('/mi-grupo') ? '/mi-grupo/:id/nuevo' : '/grupos/:id/nuevo';
  }
  if (/^\/mi-grupo\/[^/]+$/.test(pathname)) return '/mi-grupo/:id';
  if (/^\/grupos\/[^/]+$/.test(pathname)) return '/grupos/:id';
  return pathname;
}

const isManager = (identidad: Identidad): boolean =>
  identidad.artist_memberships.some((m) => m.role === 'manager');

/** Puede entrar al panel: staff o manager de algún artista. */
export function canEnterPanel(identidad: Identidad): boolean {
  return identidad.staff_roles.length > 0 || isManager(identidad);
}

/** Puede ver la ruta indicada (path sin query string). */
export function canAccessRoute(pathname: string, identidad: Identidad): boolean {
  if (!canEnterPanel(identidad)) return false;
  const rule = ROUTE_RULES[ruleKey(pathname)];
  if (!rule) return false;
  if (identidad.staff_roles.some((role) => rule.staff.includes(role))) return true;
  return Boolean(rule.managers && isManager(identidad));
}

/** Rutas del panel, para mostrar la matriz de permisos. */
export const PANEL_ROUTES: readonly string[] = Object.keys(ROUTE_RULES);

/** Roles staff que pueden ver una ruta (vacío si la ruta no existe). */
export function staffRolesFor(pathname: string): readonly StaffRole[] {
  return ROUTE_RULES[pathname]?.staff ?? [];
}

/** Si la ruta también la ve un manager. */
export function managersCanSee(pathname: string): boolean {
  return Boolean(ROUTE_RULES[pathname]?.managers);
}
