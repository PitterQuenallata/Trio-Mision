import React, { useState } from 'react';
import { Activity, History } from 'lucide-react';
import { useIconHover } from '@animateicons/react';
import { RefreshCwIcon } from '@animateicons/react/lucide';
import { Button } from '../../../shared/components/ui/button';
import { AuditoriaTable } from '../components/auditoria-table';
import { AuditoriaLogDetail } from '../components/auditoria-log-detail';
import { initialAuditLogs } from '../data/auditoria-data';
import { AuditLog } from '../types/auditoria.types';
import { useAuditoriaLogs } from '../hooks/use-auditoria';
import { useSound } from '../../../shared/context/sound-context';
import { pillToast } from '../../../shared/components/ui/pill-toast';
import { InteractiveLogsTable } from '../../../components/ui/interactive-logs-table-shadcnui';
import { cn } from '../../../shared/lib/utils';

export const AuditoriaPage: React.FC = () => {
  const { play } = useSound();
  const { data: logs = initialAuditLogs, refetch } = useAuditoriaLogs();
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(initialAuditLogs[0]);
  const [activeTab, setActiveTab] = useState<'interactive' | 'forensic'>('interactive');
  const refreshHover = useIconHover();

  const handleRefresh = () => {
    play('pop');
    refetch();
    pillToast.success('Telemetría Sincronizada', 'Registro de auditoría y eventos del clúster actualizados.');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Auditoría & Logs
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Observabilidad de microservicios en vivo y pista forense administrativa inmutable
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            {...refreshHover.triggerProps}
            onClick={handleRefresh}
            className="gap-1.5 text-xs rounded-xl"
          >
            <RefreshCwIcon ref={refreshHover.ref} className="h-3.5 w-3.5" />
            <span>Actualizar Telemetría</span>
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-md p-4 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/90">
              Logs en Buffer
            </span>
            <span className="text-[11px] font-mono text-muted-foreground">Memoria</span>
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums font-mono">
            8
          </div>
          <p className="text-[11px] text-muted-foreground">Telemetría en memoria</p>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-md p-4 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/90">
              Servicios Activos
            </span>
            <span className="text-[11px] font-mono text-emerald-500 font-medium">6/6 OK</span>
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums font-mono">
            6
          </div>
          <p className="text-[11px] text-muted-foreground">Gateways y réplicas</p>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-md p-4 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/90">
              Latencia P95
            </span>
            <span className="text-[11px] font-mono text-muted-foreground">Estable</span>
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums font-mono">
            245ms
          </div>
          <p className="text-[11px] text-muted-foreground">Tiempo medio de respuesta</p>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-md p-4 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/90">
              Incidentes
            </span>
            <span className="text-[11px] font-mono text-amber-500 font-medium">Bajo aviso</span>
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums font-mono">
            2
          </div>
          <p className="text-[11px] text-muted-foreground">1 timeout, 1 gateway 502</p>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex items-center justify-between border-b border-border/40 pb-2">
        <div className="inline-flex rounded-xl bg-neutral-100 dark:bg-neutral-800/80 p-1 border border-border/40">
          <button
            type="button"
            onClick={() => setActiveTab('interactive')}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all select-none',
              activeTab === 'interactive'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Activity className="h-3.5 w-3.5" />
            <span>Consola de Logs (Interactive Logs)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('forensic')}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all select-none',
              activeTab === 'forensic'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <History className="h-3.5 w-3.5" />
            <span>Pista Forense Administrativa</span>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'interactive' ? (
        <div className="space-y-4">
          <InteractiveLogsTable className="shadow-sm border-border/60" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <AuditoriaTable
              logs={logs}
              selectedLog={selectedLog}
              onSelectLog={setSelectedLog}
            />
          </div>

          <div className="lg:col-span-1">
            <AuditoriaLogDetail log={selectedLog} />
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditoriaPage;
