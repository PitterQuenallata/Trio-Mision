export interface AuditLog {
  id: string;
  actor: string;
  action: string;
  target: string;
  ip: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: string;
  metadata: Record<string, unknown>;
}
