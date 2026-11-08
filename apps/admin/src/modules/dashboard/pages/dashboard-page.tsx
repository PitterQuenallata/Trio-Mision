import React, { useState, useEffect } from 'react';
import { useLocation } from '@tanstack/react-router';
import { Calendar } from 'lucide-react';
import { useIconHover } from '@animateicons/react';
import { DownloadIcon, CompassIcon } from '@animateicons/react/lucide';
import { Button } from '../../../shared/components/ui/button';
import { DashboardType } from '../types/dashboard.types';
import { DashboardExecutiveView } from '../components/dashboard-executive-view';
import { DashboardAnalyticsView } from '../components/dashboard-analytics-view';
import { DashboardTour } from '../components/dashboard-tour';
import { useSound } from '../../../shared/context/sound-context';
import { pillToast } from '../../../shared/components/ui/pill-toast';
import { cn } from '../../../shared/lib/utils';

const DASHBOARD_TABS: { id: DashboardType; label: string }[] = [
  { id: 'ejecutivo', label: 'Ejecutivo (Finanzas)' },
  { id: 'analytics', label: 'Analítica Global' },
];

export const DashboardPage: React.FC = () => {
  const { play } = useSound();
  const location = useLocation();
  const [activeDashboard, setActiveDashboard] = useState<DashboardType>('ejecutivo');
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  const compassHover = useIconHover();
  const downloadHover = useIconHover();

  // Automatically trigger tour if accessed via /dashboard?tour=true or /dashboard?guide=true
  useEffect(() => {
    const searchObj = (location.search as Record<string, string>) || {};
    const hasTourParam =
      searchObj.tour === 'true' ||
      searchObj.guide === 'true' ||
      window.location.hash.includes('tour=true') ||
      window.location.hash.includes('guide=true');

    if (hasTourParam) {
      setTourStep(0);
      setIsTourOpen(true);
    }
  }, [location.search]);

  const handleDownloadReport = () => {
    play('pop');
    pillToast.success('Informe Generado', `Reporte ejecutivo de ${activeDashboard.toUpperCase()} exportado en PDF.`);
  };

  const getDashboardMetadata = () => {
    switch (activeDashboard) {
      case 'ejecutivo':
        return {
          title: 'Dashboard Ejecutivo & Finanzas SaaS',
          subtitle: 'Monitoreo en tiempo real de ingresos recurrentes (MRR), retención de licencias y balances.',
        };
      case 'analytics':
        return {
          title: 'Dashboard Analítico & Tráfico de Plataforma',
          subtitle: 'Concurrencia de usuarios en tiempo real, canales de adquisición y desglose geográfico global.',
        };
    }
  };

  const meta = getDashboardMetadata();

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header & Global Actions */}
      <div id="dashboard-header-container" className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {meta.title}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {meta.subtitle}
          </p>
        </div>

        <div id="dashboard-actions-container" className="flex items-center gap-2.5 self-start md:self-auto shrink-0">
          <Button
            variant="outline"
            size="sm"
            {...compassHover.triggerProps}
            onClick={() => {
              play('pop');
              setTourStep(0);
              setIsTourOpen(true);
            }}
            className="gap-1.5 text-xs rounded-xl border-border/60 hover:bg-muted/50 text-muted-foreground hover:text-foreground h-8.5"
          >
            <CompassIcon ref={compassHover.ref} className="h-3.5 w-3.5" />
            <span>Recorrido</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              play('click');
              pillToast.info('Periodo Contable', 'Visualizando datos consolidados de los últimos 30 días.');
            }}
            className="gap-1.5 text-xs rounded-xl h-8.5"
          >
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Últimos 30 días</span>
          </Button>
          <Button
            variant="default"
            size="sm"
            {...downloadHover.triggerProps}
            onClick={handleDownloadReport}
            className="gap-1.5 text-xs rounded-xl shadow-sm h-8.5"
          >
            <DownloadIcon ref={downloadHover.ref} className="h-3.5 w-3.5" />
            <span>Exportar Informe</span>
          </Button>
        </div>
      </div>

      {/* Corporate Apple Segmented Pill Switcher */}
      <div id="dashboard-tabs-container" className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
        {DASHBOARD_TABS.map((tab) => {
          const isActive = activeDashboard === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                play('click');
                setActiveDashboard(tab.id);
              }}
              className={cn(
                'px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all duration-200 border cursor-pointer',
                isActive
                  ? 'bg-foreground text-background border-foreground shadow-sm font-semibold'
                  : 'bg-card/70 hover:bg-card text-muted-foreground hover:text-foreground border-border/50'
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Active Dashboard Specialized View */}
      <div id="dashboard-content-container">
        {activeDashboard === 'ejecutivo' && <DashboardExecutiveView />}
        {activeDashboard === 'analytics' && <DashboardAnalyticsView />}
      </div>

      {/* Interactive Step-by-Step Apple Product Tour */}
      <DashboardTour
        isOpen={isTourOpen}
        currentStep={tourStep}
        onStepChange={setTourStep}
        onClose={() => setIsTourOpen(false)}
      />
    </div>
  );
};
export default DashboardPage;
