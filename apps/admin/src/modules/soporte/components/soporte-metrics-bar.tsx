import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../shared/components/ui/card';
import { Ticket, TicketStatus } from '../types/soporte.types';
import { useSound } from '../../../shared/context/sound-context';
import { cn } from '../../../shared/lib/utils';

interface SoporteMetricsBarProps {
  tickets: Ticket[];
  activeStatusFilter: TicketStatus | 'all';
  onSelectStatusFilter: (status: TicketStatus | 'all') => void;
}

export const SoporteMetricsBar: React.FC<SoporteMetricsBarProps> = ({
  tickets,
  activeStatusFilter,
  onSelectStatusFilter,
}) => {
  const { play } = useSound();

  const totalCount = tickets.length;
  const openCount = tickets.filter((t) => t.status === 'open').length;
  const inProgressCount = tickets.filter((t) => t.status === 'in_progress').length;
  const pendingCount = tickets.filter((t) => t.status === 'pending').length;
  const closedCount = tickets.filter((t) => t.status === 'closed').length;

  const slaCompliance = totalCount > 0
    ? Math.round(((totalCount - tickets.filter(t => t.slaStatus === 'breached').length) / totalCount) * 100)
    : 100;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Tickets */}
      <Card
        onClick={() => {
          play('click');
          onSelectStatusFilter('all');
        }}
        className={cn(
          'rounded-2xl border bg-card/70 backdrop-blur-xl cursor-pointer transition-all duration-200 hover:border-primary/40',
          activeStatusFilter === 'all'
            ? 'border-primary ring-1 ring-primary/30 shadow-sm'
            : 'border-border/50'
        )}
      >
        <CardHeader className="pb-1 pt-4 px-5">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Total Tickets
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-foreground">
              {totalCount}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              En plataforma
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Cola general de soporte técnico
          </p>
        </CardContent>
      </Card>

      {/* Abiertos & En Curso */}
      <Card
        onClick={() => {
          play('click');
          onSelectStatusFilter('open');
        }}
        className={cn(
          'rounded-2xl border bg-card/70 backdrop-blur-xl cursor-pointer transition-all duration-200 hover:border-primary/40',
          activeStatusFilter === 'open' || activeStatusFilter === 'in_progress'
            ? 'border-rose-500/60 ring-1 ring-rose-500/30 shadow-sm'
            : 'border-border/50'
        )}
      >
        <CardHeader className="pb-1 pt-4 px-5">
          <CardTitle className="text-xs font-semibold text-rose-500 uppercase tracking-wider">
            Abiertos & En Curso
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-foreground">
              {openCount + inProgressCount}
            </span>
            <span className="text-xs text-rose-500 font-mono font-medium">
              {openCount} nuevos
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Atención prioritaria activa
          </p>
        </CardContent>
      </Card>

      {/* En Espera de Cliente */}
      <Card
        onClick={() => {
          play('click');
          onSelectStatusFilter('pending');
        }}
        className={cn(
          'rounded-2xl border bg-card/70 backdrop-blur-xl cursor-pointer transition-all duration-200 hover:border-primary/40',
          activeStatusFilter === 'pending'
            ? 'border-amber-500/60 ring-1 ring-amber-500/30 shadow-sm'
            : 'border-border/50'
        )}
      >
        <CardHeader className="pb-1 pt-4 px-5">
          <CardTitle className="text-xs font-semibold text-amber-500 uppercase tracking-wider">
            Pendiente de Cliente
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-foreground">
              {pendingCount}
            </span>
            <span className="text-xs text-amber-500 font-mono font-medium">
              Esperando datos
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Respuestas de usuario pendientes
          </p>
        </CardContent>
      </Card>

      {/* Resueltos & SLA */}
      <Card
        onClick={() => {
          play('click');
          onSelectStatusFilter('closed');
        }}
        className={cn(
          'rounded-2xl border bg-card/70 backdrop-blur-xl cursor-pointer transition-all duration-200 hover:border-primary/40',
          activeStatusFilter === 'closed'
            ? 'border-emerald-500/60 ring-1 ring-emerald-500/30 shadow-sm'
            : 'border-border/50'
        )}
      >
        <CardHeader className="pb-1 pt-4 px-5">
          <CardTitle className="text-xs font-semibold text-emerald-500 uppercase tracking-wider">
            Resueltos / Cerrados
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-foreground">
              {closedCount}
            </span>
            <span className="text-xs text-emerald-500 font-mono font-medium">
              {slaCompliance}% SLA
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Cumplimiento normativo estricto
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
