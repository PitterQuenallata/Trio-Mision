import { AuditLog } from '../types/auditoria.types';

export const initialAuditLogs: AuditLog[] = [
  {
    id: 'LOG-7701',
    actor: 'admin@blakor.dev',
    action: 'staff.role_updated',
    target: 'Camila Torres (Billing Specialist)',
    ip: '192.168.1.45',
    severity: 'medium',
    timestamp: '28 Oct 2026, 17:42:10',
    metadata: { previousRole: 'Support', newRole: 'Billing Specialist', changedBy: 'JD' },
  },
  {
    id: 'LOG-7700',
    actor: 'system.cron',
    action: 'licenses.batch_sync',
    target: 'Cluster AWS us-east-1',
    ip: '10.0.4.12',
    severity: 'low',
    timestamp: '28 Oct 2026, 17:00:00',
    metadata: { syncedCount: 4105, durationMs: 420, errors: 0 },
  },
  {
    id: 'LOG-7699',
    actor: 'unknown_client',
    action: 'auth.failed_login_attempt',
    target: 'mariana.sec@blakor.dev',
    ip: '185.220.101.5',
    severity: 'high',
    timestamp: '28 Oct 2026, 16:18:32',
    metadata: { reason: 'Invalid 2FA token', attemptNumber: 3, userAgent: 'Python-Requests/2.31' },
  },
  {
    id: 'LOG-7698',
    actor: 'carlos.mendoza@empresa.com',
    action: 'billing.invoice_downloaded',
    target: 'INV-2026-089',
    ip: '200.48.91.14',
    severity: 'low',
    timestamp: '28 Oct 2026, 15:02:19',
    metadata: { format: 'PDF', invoiceAmount: 4800 },
  },
];
