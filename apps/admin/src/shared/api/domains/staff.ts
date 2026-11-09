// Endpoints staff de lectura usados por el panel. Tipos del OpenAPI generado.
import { api, unwrap } from '../client';
import type { components, paths } from '../generated/openapi';

export type PagoStaff = components['schemas']['PagoListItem'];
export type LicenciaStaff = components['schemas']['LicenciaStaffItem'];
export type TicketStaff = components['schemas']['TicketStaffItem'];
export type SolicitudStaff = components['schemas']['SolicitudStaffItem'];

type PagoEstado = NonNullable<
  NonNullable<paths['/api/v1/staff/pagos']['get']['parameters']['query']>['estado']
>;

/**
 * El esquema OpenAPI marca las listas como nullables. En las pruebas la API
 * devolvió [] para listas vacías, pero se normaliza por defensa.
 */
const orEmpty = <T,>(list: T[] | null | undefined): T[] => list ?? [];

export const staffApi = {
  /** Intentos de pago. Filtro opcional por estado. */
  listPagos: async (estado?: PagoEstado): Promise<PagoStaff[]> => {
    const body = await unwrap(api.GET('/api/v1/staff/pagos', { params: { query: { estado } } }));
    return orEmpty(body.pagos);
  },
  listLicencias: async (): Promise<LicenciaStaff[]> => {
    const body = await unwrap(api.GET('/api/v1/staff/licencias', {}));
    return orEmpty(body.licencias);
  },
  listTickets: async (): Promise<TicketStaff[]> => {
    const body = await unwrap(api.GET('/api/v1/staff/soporte/tickets', {}));
    return orEmpty(body.tickets);
  },
  listSolicitudes: async (): Promise<SolicitudStaff[]> => {
    const body = await unwrap(api.GET('/api/v1/staff/servicios/solicitudes', {}));
    return orEmpty(body.solicitudes);
  },
};
