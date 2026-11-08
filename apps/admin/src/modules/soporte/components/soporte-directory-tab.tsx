import React, { useState, useMemo } from 'react';
import { Search, Plus, Filter, Clock, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../shared/components/ui/card';
import { Button } from '../../../shared/components/ui/button';
import { Badge } from '../../../shared/components/ui/badge';
import { Input } from '../../../shared/components/ui/input';
import { Ticket, TicketStatus, TicketPriority, TicketCategory } from '../types/soporte.types';
import { useSound } from '../../../shared/context/sound-context';
import { pillToast } from '../../../shared/components/ui/pill-toast';
import { cn } from '../../../shared/lib/utils';

interface SoporteDirectoryTabProps {
  tickets: Ticket[];
  activeStatusFilter: TicketStatus | 'all';
  onSelectStatusFilter: (status: TicketStatus | 'all') => void;
  onSelectTicket: (ticket: Ticket) => void;
  onNavigateToCreate: () => void;
  onUpdateTicketStatus: (ticketId: string, status: TicketStatus) => void;
}

const CATEGORIES: ('all' | TicketCategory)[] = [
  'all',
  'Facturación',
  'Técnico',
  'Licencias',
  'Seguridad',
  'Infraestructura',
];

const PRIORITIES: ('all' | TicketPriority)[] = [
  'all',
  'urgent',
  'high',
  'medium',
  'low',
];

export const SoporteDirectoryTab: React.FC<SoporteDirectoryTabProps> = ({
  tickets,
  activeStatusFilter,
  onSelectStatusFilter,
  onSelectTicket,
  onNavigateToCreate,
  onUpdateTicketStatus,
}) => {
  const { play } = useSound();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | TicketCategory>('all');
  const [selectedPriority, setSelectedPriority] = useState<'all' | TicketPriority>('all');

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      const matchStatus =
        activeStatusFilter === 'all'
          ? true
          : activeStatusFilter === 'open'
          ? t.status === 'open' || t.status === 'in_progress'
          : t.status === activeStatusFilter;

      const matchCategory =
        selectedCategory === 'all' || t.category === selectedCategory;

      const matchPriority =
        selectedPriority === 'all' || t.priority === selectedPriority;

      const query = searchQuery.toLowerCase().trim();
      const matchSearch =
        !query ||
        t.id.toLowerCase().includes(query) ||
        t.title.toLowerCase().includes(query) ||
        t.customerName.toLowerCase().includes(query) ||
        t.customerCompany.toLowerCase().includes(query) ||
        t.agentName.toLowerCase().includes(query);

      return matchStatus && matchCategory && matchPriority && matchSearch;
    });
  }, [tickets, activeStatusFilter, selectedCategory, selectedPriority, searchQuery]);

  const getPriorityBadge = (priority: TicketPriority) => {
    switch (priority) {
      case 'urgent':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20">
            Urgente P1
          </span>
        );
      case 'high':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
            Alta P2
          </span>
        );
      case 'medium':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20">
            Media P3
          </span>
        );
      case 'low':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-muted/60 text-muted-foreground border border-border/40">
            Baja P4
          </span>
        );
    }
  };

  const getStatusBadge = (status: TicketStatus) => {
    switch (status) {
      case 'open':
        return (
          <Badge variant="outline" className="text-[11px] border-rose-500/30 text-rose-500 bg-rose-500/5">
            Abierto
          </Badge>
        );
      case 'in_progress':
        return (
          <Badge variant="outline" className="text-[11px] border-blue-500/30 text-blue-500 bg-blue-500/5">
            En Curso
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="outline" className="text-[11px] border-amber-500/30 text-amber-500 bg-amber-500/5">
            Esperando Cliente
          </Badge>
        );
      case 'closed':
        return (
          <Badge variant="outline" className="text-[11px] border-emerald-500/30 text-emerald-500 bg-emerald-500/5">
            Resuelto
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Search & Filters Header */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Sub-Filters */}
          <div className="inline-flex p-1 rounded-xl bg-card/70 border border-border/50">
            {(
              [
                { label: 'Todos', value: 'all' },
                { label: 'Abiertos', value: 'open' },
                { label: 'En Espera', value: 'pending' },
                { label: 'Cerrados', value: 'closed' },
              ] as const
            ).map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => {
                  play('click');
                  onSelectStatusFilter(f.value);
                }}
                className={cn(
                  'px-3 py-1 rounded-lg text-xs font-medium transition-all',
                  activeStatusFilter === f.value
                    ? 'bg-foreground text-background shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => {
              play('click');
              setSelectedCategory(e.target.value as any);
            }}
            className="h-8 px-2.5 text-xs rounded-xl bg-card/60 border border-border/60 text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          >
            <option value="all">Todas las Categorías</option>
            <option value="Facturación">Facturación</option>
            <option value="Técnico">Técnico</option>
            <option value="Licencias">Licencias</option>
            <option value="Seguridad">Seguridad</option>
            <option value="Infraestructura">Infraestructura</option>
          </select>

          {/* Priority Filter */}
          <select
            value={selectedPriority}
            onChange={(e) => {
              play('click');
              setSelectedPriority(e.target.value as any);
            }}
            className="h-8 px-2.5 text-xs rounded-xl bg-card/60 border border-border/60 text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          >
            <option value="all">Todas las Prioridades</option>
            <option value="urgent">Urgente (P1)</option>
            <option value="high">Alta (P2)</option>
            <option value="medium">Media (P3)</option>
            <option value="low">Baja (P4)</option>
          </select>
        </div>

        {/* Right: Search & Create Button */}
        <div className="flex items-center gap-3">
          <div className="relative min-w-[220px] lg:min-w-[260px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por ID, cliente, o asunto..."
              className="pl-9 h-8 text-xs rounded-xl bg-card/60 border-border/60"
            />
          </div>

          <Button
            onClick={() => {
              play('pop');
              onNavigateToCreate();
            }}
            size="sm"
            className="h-8 px-3.5 rounded-xl gap-1.5 text-xs font-medium shadow-sm whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Registrar Incidencia</span>
          </Button>
        </div>
      </div>

      {/* Tickets List View */}
      <Card className="rounded-2xl border-border/50 bg-card/70 backdrop-blur-xl overflow-hidden">
        <CardHeader className="py-4 px-6 border-b border-border/40 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold">
              Cola de Atención y SLA
            </CardTitle>
            <CardDescription className="text-xs">
              Mostrando {filteredTickets.length} tickets filtrados en el sistema
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredTickets.length === 0 ? (
            <div className="p-12 text-center text-xs text-muted-foreground space-y-2">
              <p className="font-medium text-foreground">No hay tickets que coincidan con la búsqueda</p>
              <p>Prueba restableciendo los filtros de estado o categoría.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {filteredTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  onClick={() => {
                    play('click');
                    onSelectTicket(ticket);
                  }}
                  className="p-4 sm:p-5 hover:bg-muted/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer group"
                >
                  {/* Left Column: ID, Title, Customer */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-primary tabular-nums">
                        {ticket.id}
                      </span>
                      <span className="text-muted-foreground text-xs">•</span>
                      <Badge variant="secondary" className="text-[11px] px-2 py-0 bg-muted/60 text-muted-foreground border-border/40 font-normal">
                        {ticket.category}
                      </Badge>
                      {getPriorityBadge(ticket.priority)}
                      {getStatusBadge(ticket.status)}
                    </div>

                    <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                      {ticket.title}
                    </h3>

                    {/* Customer info */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <img
                        src={ticket.customerAvatar}
                        alt={ticket.customerName}
                        className="w-4 h-4 rounded-full object-cover border border-border/50"
                      />
                      <span className="font-medium text-foreground">{ticket.customerName}</span>
                      <span>({ticket.customerCompany})</span>
                      <span>•</span>
                      <span className="font-mono tabular-nums text-[11px]">Creado {ticket.createdAt}</span>
                    </div>
                  </div>

                  {/* Right Column: Assignee & SLA & Action */}
                  <div className="flex items-center justify-between md:justify-end gap-6 pt-2 md:pt-0 border-t md:border-t-0 border-border/30">
                    {/* SLA countdown */}
                    <div className="text-right font-mono tabular-nums text-xs">
                      <div className="flex items-center gap-1 text-muted-foreground justify-end">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span>SLA: {ticket.slaDueHours}h</span>
                      </div>
                      <span
                        className={cn(
                          'text-[11px] font-medium',
                          ticket.slaStatus === 'warning'
                            ? 'text-amber-500'
                            : ticket.slaStatus === 'breached'
                            ? 'text-rose-500'
                            : 'text-emerald-500'
                        )}
                      >
                        {ticket.slaStatus === 'warning'
                          ? 'Próximo a vencer'
                          : ticket.slaStatus === 'breached'
                          ? 'Incumplido'
                          : 'En plazo'}
                      </span>
                    </div>

                    {/* Assigned Agent */}
                    <div className="flex items-center gap-2 min-w-[120px]">
                      <img
                        src={ticket.agentAvatar}
                        alt={ticket.agentName}
                        className="w-7 h-7 rounded-full object-cover border border-border/50"
                      />
                      <div className="text-left text-xs truncate">
                        <p className="font-medium text-foreground truncate">{ticket.agentName}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{ticket.agentRole.split(' ')[0]}</p>
                      </div>
                    </div>

                    {/* Action Arrow */}
                    <div className="p-1 rounded-lg text-muted-foreground group-hover:text-foreground group-hover:bg-muted/60 transition-all">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
