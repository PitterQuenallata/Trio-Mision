export type ReportCategory = 'all' | 'financiero' | 'seguridad' | 'producto' | 'operaciones';
export type ReportFormat = 'PDF' | 'CSV' | 'XLSX' | 'JSON';
export type ReportStatus = 'Completado' | 'En Proceso' | 'Programado';

export interface ReportItem {
  id: string;
  title: string;
  category: 'financiero' | 'seguridad' | 'producto' | 'operaciones';
  desc: string;
  format: ReportFormat;
  frequency: string;
  lastGenerated: string;
  size: string;
  status: ReportStatus;
  downloadsCount: number;
}

export interface ReportMetric {
  label: string;
  value: string;
  change: string;
  isPositive: boolean;
  sub: string;
}

export interface GeneratedReportRecord {
  id: string;
  reportName: string;
  category: 'financiero' | 'seguridad' | 'producto' | 'operaciones';
  format: ReportFormat;
  generatedAt: string;
  requestedBy: string;
  size: string;
  status: ReportStatus;
}
