import { useQuery } from '@tanstack/react-query';
import { staffApi } from '../../../shared/api/domains/staff';
import { useAuth } from '../../../shared/auth/auth-context';
import type { StaffRole } from '../../../shared/auth/types';

export interface DashboardKpi {
  id: string;
  title: string;
  value: number | undefined;
  loading: boolean;
  error: boolean;
}

// Indicadores del panel. Cada uno se consulta solo si el rol puede verlo, para no
// llamar endpoints que devolverían 403 (las secciones de detalle llegan después).
const KPI_ROLES: readonly StaffRole[] = ['admin', 'vendedor'];

/** KPIs reales del dashboard para los roles que los ven. */
export function useDashboardKpis(): DashboardKpi[] {
  const { identidad } = useAuth();
  const puedeVer = Boolean(identidad?.staff_roles.some((r) => KPI_ROLES.includes(r)));

  const pagos = useQuery({
    queryKey: ['dashboard', 'pagos-en-revision'],
    queryFn: () => staffApi.listPagos('in_review'),
    enabled: puedeVer,
  });
  const licencias = useQuery({
    queryKey: ['dashboard', 'licencias-vigentes'],
    queryFn: () => staffApi.listLicencias(),
    enabled: puedeVer,
  });
  const tickets = useQuery({
    queryKey: ['dashboard', 'tickets-abiertos'],
    queryFn: () => staffApi.listTickets(),
    enabled: puedeVer,
  });
  const solicitudes = useQuery({
    queryKey: ['dashboard', 'solicitudes-sin-cotizar'],
    queryFn: () => staffApi.listSolicitudes(),
    enabled: puedeVer,
  });

  if (!puedeVer) return [];

  return [
    {
      id: 'pagos',
      title: 'Pagos en revisión',
      value: pagos.data?.length,
      loading: pagos.isPending,
      error: pagos.isError,
    },
    {
      id: 'licencias',
      title: 'Licencias vigentes',
      value: licencias.data?.filter((l) => l.estado === 'vigente').length,
      loading: licencias.isPending,
      error: licencias.isError,
    },
    {
      id: 'soporte',
      title: 'Tickets abiertos',
      value: tickets.data?.filter((t) => t.estado === 'abierto' || t.estado === 'en_atencion').length,
      loading: tickets.isPending,
      error: tickets.isError,
    },
    {
      id: 'servicios',
      title: 'Solicitudes sin cotizar',
      value: solicitudes.data?.filter((s) => s.estado === 'nueva' || s.estado === 'en_revision').length,
      loading: solicitudes.isPending,
      error: solicitudes.isError,
    },
  ];
}
