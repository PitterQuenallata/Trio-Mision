export type InvoiceStatus = 'Paid' | 'Pending' | 'Overdue' | 'Draft';

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  total: number;
}

export interface ClientEntity {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  address: string;
  taxId: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  client: ClientEntity;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  items: InvoiceItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  paymentMethod?: string;
  notes?: string;
}

export interface PricingPlan {
  id: string;
  name: string;
  badge?: string;
  monthlyPrice: number;
  annualPrice: number;
  description: string;
  image: string;
  isPopular?: boolean;
  features: { name: string; included: boolean }[];
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}
