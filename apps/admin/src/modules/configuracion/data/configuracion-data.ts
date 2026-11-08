import {
  GeneralConfig,
  SecurityConfig,
  NotificationChannel,
  BackupConfig,
  ApiKeyItem,
  WebhookEndpoint,
} from '../types/configuracion.types';

export const initialGeneralConfig: GeneralConfig = {
  organizationName: 'Blakor Enterprise Technologies Ltd',
  supportEmail: 'infra-support@blakor.dev',
  systemLanguage: 'es',
  timezone: 'UTC / Europe/Berlin',
  currency: 'USD',
  environment: 'Producción',
  maintenanceMode: false,
  maintenanceMessage: 'El sistema se encuentra en una breve ventana de actualización de infraestructura. Volvemos en 15 minutos.',
};

export const initialSecurityConfig: SecurityConfig = {
  requireTwoFactor: true,
  passwordExpirationDays: 90,
  maxFailedAttempts: 5,
  sessionTimeoutMinutes: 30,
  ipWhitelist: ['192.168.1.0/24', '10.0.4.0/22', '185.220.100.0/24'],
  ssoEnabled: true,
  ssoProvider: 'Okta SAML 2.0 / Azure AD',
  enforceHardwareKeys: false,
};

export const initialNotificationChannels: NotificationChannel[] = [
  {
    id: 'ch-1',
    name: 'Canal Central de Operaciones DevOps',
    type: 'slack',
    target: '#ops-alerts-production',
    enabled: true,
    events: ['Fallos 5xx en API', 'Deadlocks en DB', 'Picos de CPU > 85%'],
  },
  {
    id: 'ch-2',
    name: 'PagerDuty Guardias de Emergencia L3',
    type: 'pagerduty',
    target: 'service-key: pd-live-8841-p1',
    enabled: true,
    events: ['Caída de Cluster', 'Brecha de SLA < 99%'],
  },
  {
    id: 'ch-3',
    name: 'Equipo de Tesorería & Facturación',
    type: 'email',
    target: 'finance-alerts@blakor.dev',
    enabled: true,
    events: ['Cobros fallidos > $5,000', 'Discrepancias en reconciliación'],
  },
  {
    id: 'ch-4',
    name: 'Auditoría Forense de Seguridad',
    type: 'webhook',
    target: 'https://siem.corp.internal/v1/sec-events',
    enabled: false,
    events: ['Intentos de fuerza bruta', 'Modificaciones de roles RBAC'],
  },
];

export const initialBackupConfig: BackupConfig = {
  provider: 'AWS S3',
  frequency: 'daily',
  retentionDays: 365,
  lastBackupDate: 'Hoy, 03:00 UTC',
  lastBackupSize: '42.8 GB',
  autoSnapshots: true,
};

export const initialApiKeys: ApiKeyItem[] = [
  {
    id: 'key-1',
    name: 'API Key de Producción - Backend Core',
    prefix: 'blk_live_prod',
    keyMasked: 'blk_live_prod_9942••••••••••••x771',
    fullKey: 'blk_live_prod_9942881900124781x771',
    role: 'Admin Total',
    createdAt: '12 Ene 2026',
    lastUsed: 'Hace 4 segundos',
  },
  {
    id: 'key-2',
    name: 'Conector de Facturación Stripe Sync',
    prefix: 'blk_live_bill',
    keyMasked: 'blk_live_bill_4412••••••••••••b992',
    fullKey: 'blk_live_bill_4412889912003411b992',
    role: 'Billing API',
    createdAt: '18 Mar 2026',
    lastUsed: 'Hace 12 min',
  },
  {
    id: 'key-3',
    name: 'Integración Auditoría SIEM & Splunk',
    prefix: 'blk_live_read',
    keyMasked: 'blk_live_read_1109••••••••••••q441',
    fullKey: 'blk_live_read_1109441188992200q441',
    role: 'Solo Lectura',
    createdAt: '01 Jun 2026',
    lastUsed: 'Hace 1 hora',
  },
];

export const initialWebhooks: WebhookEndpoint[] = [
  {
    id: 'wh-1',
    url: 'https://erp.enterprise-corp.com/api/webhooks/billing-events',
    events: ['invoice.paid', 'subscription.renewed', 'refund.processed'],
    status: '200 OK',
    lastDispatched: 'Hace 8 min',
  },
  {
    id: 'wh-2',
    url: 'https://crm.cloudscale.net/integrations/lead-synced',
    events: ['user.registered', 'account.upgraded'],
    status: '200 OK',
    lastDispatched: 'Hace 24 min',
  },
  {
    id: 'wh-3',
    url: 'https://legacy-gateway.partner.io/v1/notify',
    events: ['license.revoked'],
    status: 'Error 504',
    lastDispatched: 'Hace 2 horas',
  },
];
