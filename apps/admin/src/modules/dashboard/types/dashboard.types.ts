export type DashboardType = 'ejecutivo' | 'analytics';

// Executive
export interface KpiMetric {
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down';
  subtitle: string;
}

export interface RecentTransaction {
  id: string;
  client: string;
  plan: string;
  amount: number;
  status: 'Completado' | 'Procesando' | 'Fallido';
  date: string;
}

export interface RevenueChartPoint {
  month: string;
  value: number;
}

// eCommerce
export interface EcommerceKpi {
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down';
  subtitle: string;
}

export interface TopProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  soldUnits: number;
  revenue: number;
  stock: number;
}

// CRM
export interface DealFunnelStage {
  stage: string;
  dealsCount: number;
  volume: number;
  percentage: number;
}

export interface AccountExecutive {
  name: string;
  avatar: string;
  quotaPercent: number;
  dealsClosed: number;
  revenueGenerated: number;
}

// Analytics
export interface TrafficSourceItem {
  channel: string;
  percentage: number;
  visits: number;
  bounceRate: string;
  color: string;
}

export interface GeoTrafficItem {
  region: string;
  country: string;
  percentage: number;
  usersCount: number;
}
