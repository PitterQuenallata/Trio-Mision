import { License, LicenseMetric } from '../types/licencias.types';

export const initialLicenses: License[] = [
  {
    id: 'LIC-01',
    client: 'Acme Cloud Inc.',
    tier: 'Enterprise Unlimited',
    key: 'BLK-ENT-9941-8821-X99',
    seats: '120 / 200',
    status: 'Activa',
    expiresAt: '24 Oct 2027',
  },
  {
    id: 'LIC-02',
    client: 'Starlight Labs',
    tier: 'Pro Commercial',
    key: 'BLK-PRO-7723-1102-Q44',
    seats: '24 / 25',
    status: 'Activa',
    expiresAt: '15 Nov 2026',
  },
  {
    id: 'LIC-03',
    client: 'Vanguard Media',
    tier: 'Starter Developer',
    key: 'BLK-STA-3321-0091-B12',
    seats: '5 / 5',
    status: 'Por Vencer (14d)',
    expiresAt: '11 Nov 2026',
  },
  {
    id: 'LIC-04',
    client: 'Apex Global Corp',
    tier: 'Pro Commercial',
    key: 'BLK-PRO-5541-6677-M88',
    seats: '0 / 25',
    status: 'Suspendida',
    expiresAt: '01 Oct 2026',
  },
];

export const initialLicenseMetrics: LicenseMetric[] = [
  {
    title: 'Licencias Emitidas',
    value: '4,105',
    subtitle: '+85 esta semana',
    trendColor: 'text-emerald-500',
  },
  {
    title: 'Tasa de Renovación',
    value: '98.4%',
    subtitle: 'Líder en categoría SaaS B2B',
  },
  {
    title: 'Asientos Activos',
    value: '18,490',
    subtitle: '78% de capacidad asignada',
    trendColor: 'text-primary',
  },
];
