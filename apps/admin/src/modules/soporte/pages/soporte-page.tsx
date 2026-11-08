import React, { useState } from 'react';
import { initialTickets } from '../data/soporte-data';
import { Ticket, TicketStatus, TicketPriority } from '../types/soporte.types';
import { useSoporteTickets, useCreateTicket } from '../hooks/use-soporte';
import { SoporteMetricsBar } from '../components/soporte-metrics-bar';
import { SoporteDirectoryTab } from '../components/soporte-directory-tab';
import { SoporteDetailTab } from '../components/soporte-detail-tab';
import { SoporteCreateTab } from '../components/soporte-create-tab';
import { useSound } from '../../../shared/context/sound-context';
import { cn } from '../../../shared/lib/utils';

type SoporteTab = 'list' | 'detail' | 'create';

export const SoportePage: React.FC = () => {
  const { play } = useSound();
  const { data: initialLoadedTickets = initialTickets } = useSoporteTickets();
  const createTicketMutation = useCreateTicket();
  const [activeTab, setActiveTab] = useState<SoporteTab>('list');
  const [tickets, setTickets] = useState<Ticket[]>(initialLoadedTickets);
  const [selectedTicketId, setSelectedTicketId] = useState<string>(initialTickets[0].id);
  const [activeStatusFilter, setActiveStatusFilter] = useState<TicketStatus | 'all'>('all');

  const selectedTicket = tickets.find((t) => t.id === selectedTicketId) || tickets[0];

  const handleSelectTicket = (ticket: Ticket) => {
    setSelectedTicketId(ticket.id);
    setActiveTab('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdateStatus = (ticketId: string, status: TicketStatus) => {
    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticketId
          ? { ...t, status, updatedAt: 'Hace un momento' }
          : t
      )
    );
  };

  const handleUpdatePriority = (ticketId: string, priority: TicketPriority) => {
    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticketId
          ? { ...t, priority, updatedAt: 'Hace un momento' }
          : t
      )
    );
  };

  const handleAssignAgent = (
    ticketId: string,
    agentName: string,
    agentAvatar: string,
    agentRole: string
  ) => {
    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticketId
          ? { ...t, agentName, agentAvatar, agentRole, updatedAt: 'Hace un momento' }
          : t
      )
    );
  };

  const handleAddReply = (
    ticketId: string,
    content: string,
    isInternalNote: boolean
  ) => {
    const newMessage = {
      id: `msg-${Date.now()}`,
      senderName: 'Mathew Anderson',
      senderAvatar: '/images/profile/user-1.jpg',
      senderRole: 'agent' as const,
      timestamp: 'Hace un momento',
      content,
      isInternalNote,
    };

    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticketId
          ? {
              ...t,
              updatedAt: 'Hace un momento',
              messages: [...t.messages, newMessage],
            }
          : t
      )
    );
  };

  const handleCreateTicket = (newTicket: Ticket) => {
    createTicketMutation.mutate(newTicket);
    setTickets([newTicket, ...tickets]);
    setSelectedTicketId(newTicket.id);
    setActiveTab('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Header & Tab Switcher */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Soporte & Helpdesk SLA
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Gestión administrativa de incidencias, escalamiento a ingeniería y cumplimiento de acuerdos de nivel de servicio
          </p>
        </div>

        {/* Apple Segmented Bar */}
        <div className="inline-flex p-1 rounded-2xl bg-muted/60 border border-border/50 backdrop-blur-md self-start md:self-auto">
          <button
            type="button"
            onClick={() => {
              play('click');
              setActiveTab('list');
            }}
            className={cn(
              'px-4 py-2 rounded-xl text-xs font-medium transition-all duration-200',
              activeTab === 'list'
                ? 'bg-background text-foreground shadow-sm font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Cola de Tickets
          </button>

          <button
            type="button"
            onClick={() => {
              play('click');
              setActiveTab('detail');
            }}
            className={cn(
              'px-4 py-2 rounded-xl text-xs font-medium transition-all duration-200',
              activeTab === 'detail'
                ? 'bg-background text-foreground shadow-sm font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Gestión & SLA
          </button>

          <button
            type="button"
            onClick={() => {
              play('click');
              setActiveTab('create');
            }}
            className={cn(
              'px-4 py-2 rounded-xl text-xs font-medium transition-all duration-200',
              activeTab === 'create'
                ? 'bg-background text-foreground shadow-sm font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Registrar Incidencia
          </button>
        </div>
      </div>

      {/* Metrics Bar */}
      <SoporteMetricsBar
        tickets={tickets}
        activeStatusFilter={activeStatusFilter}
        onSelectStatusFilter={(filter) => {
          setActiveStatusFilter(filter);
          if (activeTab !== 'list') {
            setActiveTab('list');
          }
        }}
      />

      {/* Main Tab Views */}
      {activeTab === 'list' && (
        <SoporteDirectoryTab
          tickets={tickets}
          activeStatusFilter={activeStatusFilter}
          onSelectStatusFilter={setActiveStatusFilter}
          onSelectTicket={handleSelectTicket}
          onNavigateToCreate={() => {
            setActiveTab('create');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onUpdateTicketStatus={handleUpdateStatus}
        />
      )}

      {activeTab === 'detail' && selectedTicket && (
        <SoporteDetailTab
          ticket={selectedTicket}
          onBack={() => setActiveTab('list')}
          onUpdateStatus={handleUpdateStatus}
          onUpdatePriority={handleUpdatePriority}
          onAssignAgent={handleAssignAgent}
          onAddReply={handleAddReply}
        />
      )}

      {activeTab === 'create' && (
        <SoporteCreateTab
          onCreateTicket={handleCreateTicket}
          onCancel={() => setActiveTab('list')}
        />
      )}
    </div>
  );
};
export default SoportePage;
