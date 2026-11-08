export type TicketStatus = 'open' | 'in_progress' | 'pending' | 'closed';
export type TicketPriority = 'urgent' | 'high' | 'medium' | 'low';
export type TicketCategory = 'Facturación' | 'Técnico' | 'Licencias' | 'Seguridad' | 'Infraestructura';
export type SlaStatus = 'on_track' | 'warning' | 'breached';

export interface TicketMessage {
  id: string;
  senderName: string;
  senderAvatar: string;
  senderRole: 'customer' | 'agent' | 'system';
  timestamp: string;
  content: string;
  isInternalNote?: boolean;
  attachments?: string[];
}

export interface Ticket {
  id: string; // e.g. "TK-4821"
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  customerName: string;
  customerEmail: string;
  customerCompany: string;
  customerAvatar: string;
  agentName: string;
  agentAvatar: string;
  agentRole: string;
  createdAt: string;
  updatedAt: string;
  slaDueHours: number;
  slaStatus: SlaStatus;
  messages: TicketMessage[];
}
