import React, { useState } from 'react';
import {
  ArrowLeft,
  Send,
  Lock,
  UserCheck,
  AlertTriangle,
  Clock,
  Shield,
  FileText,
  CheckCircle,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../shared/components/ui/card';
import { Button } from '../../../shared/components/ui/button';
import { Badge } from '../../../shared/components/ui/badge';
import { Ticket, TicketStatus, TicketPriority } from '../types/soporte.types';
import { useSound } from '../../../shared/context/sound-context';
import { pillToast } from '../../../shared/components/ui/pill-toast';
import { cn } from '../../../shared/lib/utils';

interface SoporteDetailTabProps {
  ticket: Ticket;
  onBack: () => void;
  onUpdateStatus: (ticketId: string, status: TicketStatus) => void;
  onUpdatePriority: (ticketId: string, priority: TicketPriority) => void;
  onAssignAgent: (
    ticketId: string,
    agentName: string,
    agentAvatar: string,
    agentRole: string
  ) => void;
  onAddReply: (
    ticketId: string,
    content: string,
    isInternalNote: boolean
  ) => void;
}

const AGENTS = [
  {
    name: 'Mathew Anderson',
    avatar: '/images/profile/user-1.jpg',
    role: 'Finance Operations Lead',
  },
  {
    name: 'Sophia Chang',
    avatar: '/images/profile/user-6.jpg',
    role: 'Staff SRE Specialist',
  },
  {
    name: 'Steve Miller',
    avatar: '/images/profile/user-5.jpg',
    role: 'IAM & Security Architect',
  },
  {
    name: 'Lucas Graham',
    avatar: '/images/profile/user-7.jpg',
    role: 'API Integration Specialist',
  },
];

export const SoporteDetailTab: React.FC<SoporteDetailTabProps> = ({
  ticket,
  onBack,
  onUpdateStatus,
  onUpdatePriority,
  onAssignAgent,
  onAddReply,
}) => {
  const { play } = useSound();
  const [replyText, setReplyText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    play('success');
    onAddReply(ticket.id, replyText.trim(), isInternalNote);
    setReplyText('');
    pillToast.success(
      isInternalNote ? 'Nota Interna' : 'Respuesta Enviada',
      isInternalNote
        ? 'Nota privada guardada en el expediente.'
        : 'Respuesta oficial despachada al cliente.'
    );
  };

  const handleQuickResolve = () => {
    play('success');
    onUpdateStatus(ticket.id, 'closed');
    pillToast.success('Ticket Resuelto', 'Incidencia marcada como resuelta y archivada.');
  };

  const handleEscalate = () => {
    play('pop');
    pillToast.info('Escalamiento L3', 'Incidencia escalada al equipo de Ingeniería L3.');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-16">
      {/* Top Bar Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            play('click');
            onBack();
          }}
          className="gap-2 text-xs text-muted-foreground hover:text-foreground self-start"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver a la Cola de Tickets</span>
        </Button>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleEscalate}
            className="h-8 px-3 rounded-xl text-xs font-medium text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
          >
            Escalar a L3
          </Button>

          {ticket.status !== 'closed' ? (
            <Button
              size="sm"
              onClick={handleQuickResolve}
              className="h-8 px-3.5 rounded-xl text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Resolver y Cerrar</span>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                play('click');
                onUpdateStatus(ticket.id, 'in_progress');
                pillToast.info('Ticket Reabierto', 'Incidencia reabierta en estado En Curso.');
              }}
              className="h-8 px-3 rounded-xl text-xs font-medium"
            >
              Reabrir Ticket
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Conversation and Ticket Core */}
        <div className="lg:col-span-8 space-y-6">
          {/* Ticket Header & Description */}
          <Card className="rounded-2xl border-border/50 bg-card/70 backdrop-blur-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className="text-xs font-mono font-bold text-primary tabular-nums">
                  {ticket.id}
                </span>
                <span className="text-xs text-muted-foreground">•</span>
                <Badge variant="secondary" className="text-xs px-2 py-0.5">
                  {ticket.category}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs font-mono',
                    ticket.priority === 'urgent' && 'border-rose-500/30 text-rose-500',
                    ticket.priority === 'high' && 'border-amber-500/30 text-amber-500',
                    ticket.priority === 'medium' && 'border-blue-500/30 text-blue-500',
                    ticket.priority === 'low' && 'border-muted text-muted-foreground'
                  )}
                >
                  Prioridad {ticket.priority.toUpperCase()}
                </Badge>
              </div>
              <CardTitle className="text-base sm:text-lg font-bold tracking-tight text-foreground leading-snug">
                {ticket.title}
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Registrado por {ticket.customerName} ({ticket.customerCompany}) • {ticket.createdAt}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 rounded-xl bg-background/50 border border-border/40 text-xs text-foreground/90 leading-relaxed">
                {ticket.description}
              </div>
            </CardContent>
          </Card>

          {/* Conversation Stream */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
              Historial de Comunicación ({ticket.messages.length})
            </h3>

            <div className="space-y-4">
              {ticket.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    'p-4 sm:p-5 rounded-2xl border transition-all text-xs space-y-3',
                    msg.isInternalNote
                      ? 'bg-amber-500/5 border-amber-500/30 text-amber-950 dark:text-amber-100'
                      : msg.senderRole === 'customer'
                      ? 'bg-card/60 border-border/50 text-foreground'
                      : 'bg-primary/5 border-primary/20 text-foreground'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={msg.senderAvatar}
                        alt={msg.senderName}
                        className="w-7 h-7 rounded-full object-cover border border-border/50"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">
                            {msg.senderName}
                          </span>
                          {msg.isInternalNote ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                              <Lock className="w-2.5 h-2.5" />
                              Nota Interna
                            </span>
                          ) : msg.senderRole === 'agent' ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/20 text-primary border border-primary/30">
                              Agente Blakor
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                              Cliente
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
                      {msg.timestamp}
                    </span>
                  </div>

                  <p className="leading-relaxed whitespace-pre-line pl-9">
                    {msg.content}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Reply Box */}
          <Card className="rounded-2xl border-border/50 bg-card/70 backdrop-blur-xl">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold">
                Responder o Añadir Nota
              </CardTitle>
              <div className="flex items-center gap-1.5 p-0.5 rounded-lg bg-background/80 border border-border/50">
                <button
                  type="button"
                  onClick={() => {
                    play('click');
                    setIsInternalNote(false);
                  }}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-[11px] font-medium transition-all',
                    !isInternalNote
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Respuesta Pública
                </button>
                <button
                  type="button"
                  onClick={() => {
                    play('click');
                    setIsInternalNote(true);
                  }}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1',
                    isInternalNote
                      ? 'bg-amber-500 text-amber-950 font-semibold shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Lock className="w-3 h-3" />
                  <span>Nota Interna</span>
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSendReply} className="space-y-3">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={
                    isInternalNote
                      ? 'Escribe un apunte privado solo visible para el equipo técnico...'
                      : 'Escribe la respuesta oficial que se enviará al cliente...'
                  }
                  rows={4}
                  className={cn(
                    'w-full p-3 rounded-xl border text-xs focus:outline-none focus:ring-1 resize-none leading-relaxed',
                    isInternalNote
                      ? 'bg-amber-500/5 border-amber-500/30 text-amber-950 dark:text-amber-100 placeholder:text-amber-700/50 focus:ring-amber-500'
                      : 'bg-background/60 border-border/60 text-foreground placeholder:text-muted-foreground focus:ring-primary'
                  )}
                />

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    {isInternalNote
                      ? 'Esta nota NO será notificada por correo al cliente'
                      : 'Se emitirá una notificación por correo al cliente'}
                  </span>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!replyText.trim()}
                    className={cn(
                      'rounded-xl h-8 px-4 text-xs font-medium gap-1.5 shadow-sm',
                      isInternalNote && 'bg-amber-500 hover:bg-amber-600 text-amber-950 font-semibold'
                    )}
                  >
                    <Send className="w-3 h-3" />
                    <span>{isInternalNote ? 'Guardar Nota' : 'Enviar al Cliente'}</span>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar: Meta & Configuration */}
        <div className="lg:col-span-4 space-y-6">
          {/* SLA & Status Controller */}
          <Card className="rounded-2xl border-border/50 bg-card/70 backdrop-blur-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">
                Estado Operativo & SLA
              </CardTitle>
              <CardDescription className="text-xs">
                Parámetros de resolución del caso
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Estado del Ticket
                </label>
                <select
                  value={ticket.status}
                  onChange={(e) => {
                    play('click');
                    onUpdateStatus(ticket.id, e.target.value as TicketStatus);
                    pillToast.info('Estado Actualizado', `Estado modificado a ${e.target.value}.`);
                  }}
                  className="w-full h-8 px-2.5 text-xs rounded-xl bg-background/60 border border-border/60 text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  <option value="open">Abierto (En Cola)</option>
                  <option value="in_progress">En Curso (Investigando)</option>
                  <option value="pending">Pendiente de Cliente</option>
                  <option value="closed">Resuelto / Cerrado</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Prioridad de Escalamiento
                </label>
                <select
                  value={ticket.priority}
                  onChange={(e) => {
                    play('click');
                    onUpdatePriority(ticket.id, e.target.value as TicketPriority);
                    pillToast.info('Prioridad Actualizada', `Prioridad modificada a ${e.target.value}.`);
                  }}
                  className="w-full h-8 px-2.5 text-xs rounded-xl bg-background/60 border border-border/60 text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  <option value="urgent">Urgente (P1 - Crítico)</option>
                  <option value="high">Alta (P2 - Alto)</option>
                  <option value="medium">Media (P3 - Normal)</option>
                  <option value="low">Baja (P4 - Bajo)</option>
                </select>
              </div>

              <div className="p-3 rounded-xl bg-muted/40 border border-border/40 space-y-1.5 font-mono text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Plazo SLA:</span>
                  <span className="font-semibold text-foreground tabular-nums">{ticket.slaDueHours} horas</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Condición SLA:</span>
                  <span
                    className={cn(
                      'font-semibold',
                      ticket.slaStatus === 'warning'
                        ? 'text-amber-500'
                        : ticket.slaStatus === 'breached'
                        ? 'text-rose-500'
                        : 'text-emerald-500'
                    )}
                  >
                    {ticket.slaStatus === 'warning'
                      ? 'Por Vencer'
                      : ticket.slaStatus === 'breached'
                      ? 'Expirado'
                      : 'Cumpliendo'}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Última Actividad:</span>
                  <span className="text-foreground">{ticket.updatedAt}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Assigned Agent Card */}
          <Card className="rounded-2xl border-border/50 bg-card/70 backdrop-blur-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">
                Especialista Asignado
              </CardTitle>
              <CardDescription className="text-xs">
                Responsable de la investigación
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-background/50 border border-border/40">
                <img
                  src={ticket.agentAvatar}
                  alt={ticket.agentName}
                  className="w-9 h-9 rounded-full object-cover border border-border/50"
                />
                <div>
                  <h4 className="text-xs font-semibold text-foreground">
                    {ticket.agentName}
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    {ticket.agentRole}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Reasignar a otro miembro
                </label>
                <select
                  value={ticket.agentName}
                  onChange={(e) => {
                    play('pop');
                    const selected = AGENTS.find((a) => a.name === e.target.value);
                    if (selected) {
                      onAssignAgent(ticket.id, selected.name, selected.avatar, selected.role);
                      pillToast.success('Agente Reasignado', `Caso asignado a ${selected.name}.`);
                    }
                  }}
                  className="w-full h-8 px-2.5 text-xs rounded-xl bg-background/60 border border-border/60 text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  {AGENTS.map((agent) => (
                    <option key={agent.name} value={agent.name}>
                      {agent.name} ({agent.role.split(' ')[0]})
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Customer Details */}
          <Card className="rounded-2xl border-border/50 bg-card/70 backdrop-blur-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">
                Ficha del Cliente
              </CardTitle>
              <CardDescription className="text-xs">
                Datos de la organización
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <img
                  src={ticket.customerAvatar}
                  alt={ticket.customerName}
                  className="w-8 h-8 rounded-full object-cover border border-border/50"
                />
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    {ticket.customerName}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {ticket.customerCompany}
                  </p>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-background/40 border border-border/40 text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-mono text-foreground truncate max-w-[170px]">
                    {ticket.customerEmail}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plan:</span>
                  <span className="font-medium text-primary">Enterprise Pro</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">SLA Target:</span>
                  <span className="font-medium text-emerald-500">Tier 1 (&lt;4h)</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
