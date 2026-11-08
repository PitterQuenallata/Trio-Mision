export type ConfigTab = 'general' | 'seguridad' | 'notificaciones' | 'backups' | 'api';

export interface GeneralConfig {
  organizationName: string;
  supportEmail: string;
  systemLanguage: 'es' | 'en';
  timezone: string;
  currency: 'USD' | 'EUR' | 'GBP';
  environment: 'Producción' | 'Staging' | 'Sandbox';
  maintenanceMode: boolean;
  maintenanceMessage: string;
}

export interface SecurityConfig {
  requireTwoFactor: boolean;
  passwordExpirationDays: number;
  maxFailedAttempts: number;
  sessionTimeoutMinutes: number;
  ipWhitelist: string[];
  ssoEnabled: boolean;
  ssoProvider: string;
  enforceHardwareKeys: boolean;
}

export interface NotificationChannel {
  id: string;
  name: string;
  type: 'email' | 'webhook' | 'slack' | 'pagerduty';
  target: string;
  enabled: boolean;
  events: string[];
}

export interface BackupConfig {
  provider: 'AWS S3' | 'Google Cloud Storage' | 'Azure Blob';
  frequency: 'hourly' | 'daily' | 'weekly';
  retentionDays: number;
  lastBackupDate: string;
  lastBackupSize: string;
  autoSnapshots: boolean;
}

export interface ApiKeyItem {
  id: string;
  name: string;
  prefix: string;
  keyMasked: string;
  fullKey: string;
  role: 'Admin Total' | 'Solo Lectura' | 'Billing API';
  createdAt: string;
  lastUsed: string;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  status: '200 OK' | 'Error 504' | 'Inactivo';
  lastDispatched: string;
}
