import {
  KpiMetric,
  RecentTransaction,
  RevenueChartPoint,
  TopProduct,
  DealFunnelStage,
  AccountExecutive,
  TrafficSourceItem,
  GeoTrafficItem,
} from '../types/dashboard.types';
import { formatCurrency } from '../../../shared/lib/utils';

// Executive Data
export const initialKpiMetrics: KpiMetric[] = [
  {
    title: 'Ingresos Totales (MRR)',
    value: formatCurrency(128450.0),
    change: '+14.2%',
    trend: 'up',
    subtitle: 'vs. mes anterior',
  },
  {
    title: 'Usuarios Activos',
    value: '24,892',
    change: '+8.1%',
    trend: 'up',
    subtitle: '1,420 nuevos este mes',
  },
  {
    title: 'Licencias SaaS Activas',
    value: '4,105',
    change: '+19.5%',
    trend: 'up',
    subtitle: '98.4% retención',
  },
  {
    title: 'Tasa de Cancelación (Churn)',
    value: '1.2%',
    change: '-0.4%',
    trend: 'down',
    subtitle: 'Dentro del objetivo < 2%',
  },
];

export const initialRecentTransactions: RecentTransaction[] = [
  {
    id: 'TX-9821',
    client: 'Acme Cloud Inc.',
    plan: 'Enterprise Anual',
    amount: 4800.0,
    status: 'Completado',
    date: 'Hace 12 min',
  },
  {
    id: 'TX-9820',
    client: 'Starlight Labs',
    plan: 'Pro Mensual',
    amount: 290.0,
    status: 'Completado',
    date: 'Hace 45 min',
  },
  {
    id: 'TX-9819',
    client: 'Nordic Digital AS',
    plan: 'Enterprise Plus',
    amount: 7200.0,
    status: 'Procesando',
    date: 'Hace 2 horas',
  },
  {
    id: 'TX-9818',
    client: 'Vanguard Media',
    plan: 'Pro Mensual',
    amount: 290.0,
    status: 'Completado',
    date: 'Hace 3 horas',
  },
  {
    id: 'TX-9817',
    client: 'Apex Global Corp',
    plan: 'Starter Plan',
    amount: 89.0,
    status: 'Fallido',
    date: 'Hace 5 horas',
  },
];

export const initialRevenueChartPoints: RevenueChartPoint[] = [
  { month: 'Ene', value: 68 },
  { month: 'Feb', value: 74 },
  { month: 'Mar', value: 82 },
  { month: 'Abr', value: 79 },
  { month: 'May', value: 94 },
  { month: 'Jun', value: 106 },
  { month: 'Jul', value: 112 },
  { month: 'Ago', value: 109 },
  { month: 'Sep', value: 121 },
  { month: 'Oct', value: 128 },
];

// eCommerce Data
export const ecommerceKpisData: KpiMetric[] = [
  {
    title: 'Ventas Brutas (GMV)',
    value: '$248,920.00',
    change: '+18.4%',
    trend: 'up',
    subtitle: 'vs. $210k mes anterior',
  },
  {
    title: 'Pedidos del Mes',
    value: '3,842',
    change: '+12.1%',
    trend: 'up',
    subtitle: '98.2% despachados a tiempo',
  },
  {
    title: 'Ticket Promedio (AOV)',
    value: '$64.78',
    change: '+5.3%',
    trend: 'up',
    subtitle: 'Promedio global por orden',
  },
  {
    title: 'Tasa de Conversión',
    value: '3.42%',
    change: '+0.6%',
    trend: 'up',
    subtitle: 'Benchmark del sector: 2.8%',
  },
];

export const topProductsData: TopProduct[] = [
  {
    id: 'prod-1',
    name: 'Teclado Mecánico Ergonómico Apple Layout',
    category: 'Periféricos',
    price: 189.0,
    soldUnits: 420,
    revenue: 79380.0,
    stock: 84,
  },
  {
    id: 'prod-2',
    name: 'Monitor Studio Display 4K 120Hz',
    category: 'Monitores',
    price: 849.0,
    soldUnits: 142,
    revenue: 120558.0,
    stock: 22,
  },
  {
    id: 'prod-3',
    name: 'Dock Thunderbolt 4 Multi-Puertos',
    category: 'Conectividad',
    price: 229.0,
    soldUnits: 285,
    revenue: 65265.0,
    stock: 45,
  },
  {
    id: 'prod-4',
    name: 'Brazo Articulado de Aluminio Aeroespacial',
    category: 'Soportes',
    price: 119.0,
    soldUnits: 310,
    revenue: 36890.0,
    stock: 62,
  },
];

// CRM Data
export const crmKpisData: KpiMetric[] = [
  {
    title: 'Pipeline Ponderado Total',
    value: '$1,420,000.00',
    change: '+22.8%',
    trend: 'up',
    subtitle: '246 oportunidades en curso',
  },
  {
    title: 'Tasa de Cierre (Win Rate)',
    value: '38.5%',
    change: '+4.2%',
    trend: 'up',
    subtitle: 'Líder en contratos Enterprise',
  },
  {
    title: 'Ciclo Medio de Cierre',
    value: '18.4 días',
    change: '-3.2d',
    trend: 'up',
    subtitle: 'Reducción de fricción legal',
  },
  {
    title: 'Valor Medio de Deal (ACV)',
    value: '$28,400.00',
    change: '+9.1%',
    trend: 'up',
    subtitle: 'Crecimiento de contratos multi-año',
  },
];

export const dealFunnelData: DealFunnelStage[] = [
  { stage: 'Prospección & Calificación', dealsCount: 142, volume: 3840000, percentage: 100 },
  { stage: 'Demostración Técnica & PoC', dealsCount: 64, volume: 1920000, percentage: 50 },
  { stage: 'Propuesta Comercial & Legal', dealsCount: 28, volume: 980000, percentage: 25 },
  { stage: 'Negociación Final de Cierre', dealsCount: 12, volume: 420000, percentage: 11 },
];

export const accountExecutivesData: AccountExecutive[] = [
  {
    name: 'Mathew Anderson',
    avatar: '/images/profile/user-1.jpg',
    quotaPercent: 114,
    dealsClosed: 18,
    revenueGenerated: 428000,
  },
  {
    name: 'Elena Rostova',
    avatar: '/images/profile/user-2.jpg',
    quotaPercent: 108,
    dealsClosed: 14,
    revenueGenerated: 362000,
  },
  {
    name: 'Carlos Mendoza',
    avatar: '/images/profile/user-3.jpg',
    quotaPercent: 96,
    dealsClosed: 11,
    revenueGenerated: 294000,
  },
  {
    name: 'Amara Okafor',
    avatar: '/images/profile/user-8.jpg',
    quotaPercent: 102,
    dealsClosed: 12,
    revenueGenerated: 336000,
  },
];

// Analytics Data
export const analyticsKpisData: KpiMetric[] = [
  {
    title: 'Usuarios Activos Concurrentes',
    value: '1,842',
    change: '+310',
    trend: 'up',
    subtitle: 'Pico de concurrencia actual',
  },
  {
    title: 'Sesiones Totales Mensuales',
    value: '482,900',
    change: '+16.4%',
    trend: 'up',
    subtitle: '88% tráfico autenticado',
  },
  {
    title: 'Duración Media de Sesión',
    value: '4m 38s',
    change: '+24s',
    trend: 'up',
    subtitle: 'Interacción profunda en dashboards',
  },
  {
    title: 'Tasa de Rebote (Bounce Rate)',
    value: '24.2%',
    change: '-3.8%',
    trend: 'up',
    subtitle: 'Optimización de carga inicial',
  },
];

export const trafficSourcesData: TrafficSourceItem[] = [
  { channel: 'Tráfico Directo (Aplicación)', percentage: 42, visits: 202818, bounceRate: '18.4%', color: 'bg-primary' },
  { channel: 'Búsqueda Orgánica (SEO)', percentage: 28, visits: 135212, bounceRate: '26.1%', color: 'bg-emerald-500' },
  { channel: 'Referencias B2B & Partners', percentage: 18, visits: 86922, bounceRate: '21.5%', color: 'bg-blue-500' },
  { channel: 'Campañas de Crecimiento', percentage: 12, visits: 57948, bounceRate: '34.2%', color: 'bg-amber-500' },
];

export const geoTrafficData: GeoTrafficItem[] = [
  { region: 'Norteamérica', country: 'Estados Unidos & Canadá', percentage: 46, usersCount: 222134 },
  { region: 'Unión Europea', country: 'Alemania, Francia & Países Bajos', percentage: 32, usersCount: 154528 },
  { region: 'Latinoamérica', country: 'México, Chile & Colombia', percentage: 14, usersCount: 67606 },
  { region: 'Asia-Pacífico', country: 'Japón & Singapur', percentage: 8, usersCount: 38632 },
];
