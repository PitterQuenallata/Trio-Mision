export interface License {
  id: string;
  client: string;
  tier: string;
  key: string;
  seats: string;
  status: 'Activa' | 'Por Vencer (14d)' | 'Suspendida';
  expiresAt: string;
}

export interface LicenseMetric {
  title: string;
  value: string;
  subtitle: string;
  trendColor?: string;
}
