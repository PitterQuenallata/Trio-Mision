import React, { useState } from 'react';
import {
  FileText,
  Plus,
  Eye,
  Tag,
  CreditCard,
} from 'lucide-react';
import { initialInvoices } from '../data/pagos-data';
import { Invoice } from '../types/pagos.types';
import { PagosListTab } from '../components/pagos-list-tab';
import { PagosCreateTab } from '../components/pagos-create-tab';
import { PagosDetailTab } from '../components/pagos-detail-tab';
import { PagosPricingTab } from '../components/pagos-pricing-tab';
import { useSound } from '../../../shared/context/sound-context';
import { cn } from '../../../shared/lib/utils';

export type PagosSubTab = 'list' | 'create' | 'detail' | 'pricing';

export const PagosPage: React.FC = () => {
  const { play } = useSound();
  const [activeTab, setActiveTab] = useState<PagosSubTab>('list');
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice>(initialInvoices[0]);

  const handleSelectInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setActiveTab('detail');
  };

  const handleCreateInvoice = (newInvoice: Invoice) => {
    setInvoices((prev) => [newInvoice, ...prev]);
    setSelectedInvoice(newInvoice);
    setActiveTab('detail');
  };

  const handleDeleteInvoice = (id: string) => {
    setInvoices((prev) => prev.filter((inv) => inv.id !== id));
  };

  const handleMarkAsPaid = (invoiceId: string) => {
    setInvoices((prev) =>
      prev.map((inv) => (inv.id === invoiceId ? { ...inv, status: 'Paid' } : inv))
    );
    if (selectedInvoice.id === invoiceId) {
      setSelectedInvoice((prev) => ({ ...prev, status: 'Paid' }));
    }
  };

  const subTabs: {
    id: PagosSubTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }[] = [
    { id: 'list', label: 'Directorio de Facturas', icon: FileText, badge: String(invoices.length) },
    { id: 'create', label: 'Nueva Factura', icon: Plus },
    { id: 'detail', label: 'Ficha de Factura', icon: Eye },
    { id: 'pricing', label: 'Planes & Tarifas', icon: Tag },
  ];

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5 font-mono">
          <span>Gestión Financiera</span>
          <span>/</span>
          <span className="text-foreground">Suite de Facturación & Cobros</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Facturación, Recibos & Tarifas SaaS
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-3xl leading-relaxed">
              Estructura integral adaptada de la plantilla Modernize: directorio general de cobros, generador dinámico de facturas con cálculo en vivo, comprobante oficial para impresión digital y comparador de planes comerciales.
            </p>
          </div>
        </div>
      </div>

      {/* Segmented Sub-Tabs Navigation */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-secondary/50 border border-border overflow-x-auto">
        {subTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                play('tab');
                setActiveTab(tab.id as PagosSubTab);
              }}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap cursor-pointer',
                isActive
                  ? 'bg-card text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className={cn('h-3.5 w-3.5', isActive ? 'text-primary' : 'text-muted-foreground')} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className={cn(
                    'font-mono text-[10px] px-1.5 py-0.2 rounded-full tabular-nums',
                    isActive
                      ? 'bg-primary text-white font-bold'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* SUB-TAB CONTENTS */}
      {activeTab === 'list' && (
        <PagosListTab
          invoices={invoices}
          onSelectInvoice={handleSelectInvoice}
          onNavigateToCreate={() => setActiveTab('create')}
          onDeleteInvoice={handleDeleteInvoice}
        />
      )}

      {activeTab === 'create' && (
        <PagosCreateTab
          onCreateInvoice={handleCreateInvoice}
          onCancel={() => setActiveTab('list')}
        />
      )}

      {activeTab === 'detail' && (
        <PagosDetailTab
          invoice={selectedInvoice}
          onBack={() => setActiveTab('list')}
          onMarkAsPaid={handleMarkAsPaid}
        />
      )}

      {activeTab === 'pricing' && (
        <PagosPricingTab />
      )}
    </div>
  );
};
