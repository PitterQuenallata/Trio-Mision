import React, { useState } from 'react';
import { Plus, KeyRound, Tag, CreditCard } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '../../../shared/components/ui/button';
import { LicenciasMetrics } from '../components/licencias-metrics';
import { LicenciasTable } from '../components/licencias-table';
import { PagosPricingTab } from '../../pagos/components/pagos-pricing-tab';
import { initialLicenses, initialLicenseMetrics } from '../data/licencias-data';
import { useLicencias, useLicenciasMetrics } from '../hooks/use-licencias';
import { useSound } from '../../../shared/context/sound-context';
import { pillToast } from '../../../shared/components/ui/pill-toast';
import { cn } from '../../../shared/lib/utils';

export type LicenciasSubTab = 'licencias' | 'planes';

export const LicenciasPage: React.FC = () => {
  const { play } = useSound();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<LicenciasSubTab>('licencias');
  const { data: licenses = initialLicenses } = useLicencias();
  const { data: metrics = initialLicenseMetrics } = useLicenciasMetrics();

  const handleEmitLicense = () => {
    play('pop');
    pillToast.info('Emisión de Licencia', 'Abriendo asistente de emisión criptográfica...');
  };

  const subTabs: {
    id: LicenciasSubTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }[] = [
    { id: 'licencias', label: 'Licencias Activas', icon: KeyRound, badge: String(licenses.length) },
    { id: 'planes', label: 'Catálogo de Planes & Tarifas', icon: Tag, badge: '3 Planes' },
  ];

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {/* Top Header & Breadcrumbs */}
      <div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5 font-mono">
          <span>Gestión Financiera</span>
          <span>/</span>
          <span className="text-foreground">Licencias & Planes SaaS</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Licencias & Planes SaaS
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-3xl leading-relaxed">
              Control centralizado de suscripciones comerciales: emisión de claves criptográficas, auditoría de asientos concurrentes y catálogo unificado de planes Starter, Pro y Enterprise.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                play('click');
                navigate({ to: '/pagos' });
              }}
              className="gap-1.5 text-xs rounded-xl"
            >
              <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Ver Facturación</span>
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={handleEmitLicense}
              className="gap-1.5 text-xs rounded-xl shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Emitir Nueva Licencia</span>
            </Button>
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
                setActiveTab(tab.id);
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
      {activeTab === 'licencias' && (
        <div className="space-y-6">
          <LicenciasMetrics metrics={metrics} />
          <LicenciasTable licenses={licenses} />
        </div>
      )}

      {activeTab === 'planes' && (
        <PagosPricingTab
          context="licencias"
          onSelectPlan={(plan) => {
            pillToast.success(
              'Plan Seleccionado',
              `Nivel ${plan.name} seleccionado. Listo para asignar asientos o emitir clave.`
            );
          }}
        />
      )}
    </div>
  );
};
export default LicenciasPage;
