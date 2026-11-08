import React, { useState } from 'react';
import {
  ArrowLeft,
  Check,
  AlertCircle,
  Clock,
  Shield,
  UserCheck,
  Building2,
  Mail,
  User,
  Sparkles,
  Zap,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../shared/components/ui/card';
import { Button } from '../../../shared/components/ui/button';
import { Input } from '../../../shared/components/ui/input';
import { Badge } from '../../../shared/components/ui/badge';
import { Ticket, TicketPriority, TicketCategory } from '../types/soporte.types';
import { useSound } from '../../../shared/context/sound-context';
import { pillToast } from '../../../shared/components/ui/pill-toast';
import { cn } from '../../../shared/lib/utils';

interface SoporteCreateTabProps {
  onCreateTicket: (ticket: Ticket) => void;
  onCancel: () => void;
}

const AGENTS = [
  {
    name: 'Mathew Anderson',
    avatar: '/images/profile/user-1.jpg',
    role: 'Finance Operations Lead',
    tier: 'Nivel 2',
    status: 'Guardia Activa',
  },
  {
    name: 'Sophia Chang',
    avatar: '/images/profile/user-6.jpg',
    role: 'Staff SRE Specialist',
    tier: 'Nivel 3',
    status: 'Disponible',
  },
  {
    name: 'Steve Miller',
    avatar: '/images/profile/user-5.jpg',
    role: 'IAM & Security Architect',
    tier: 'Nivel 3',
    status: 'Disponible',
  },
  {
    name: 'Lucas Graham',
    avatar: '/images/profile/user-7.jpg',
    role: 'API Integration Specialist',
    tier: 'Nivel 2',
    status: 'Guardia Activa',
  },
];

export const SoporteCreateTab: React.FC<SoporteCreateTabProps> = ({
  onCreateTicket,
  onCancel,
}) => {
  const { play } = useSound();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TicketCategory>('Técnico');
  const [priority, setPriority] = useState<TicketPriority>('high');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerCompany, setCustomerCompany] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [assignedAgentIndex, setAssignedAgentIndex] = useState(0);
  const [slaHours, setSlaHours] = useState<number>(6);

  const selectedAgent = AGENTS[assignedAgentIndex] || AGENTS[0];

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!title.trim()) {
      play('alert');
      pillToast.error('Asunto Requerido', 'Por favor ingresa un asunto para la incidencia.');
      return;
    }
    if (!customerName.trim() || !customerEmail.trim()) {
      play('alert');
      pillToast.error('Cliente Requerido', 'Por favor ingresa el nombre y correo del cliente.');
      return;
    }
    if (!description.trim()) {
      play('alert');
      pillToast.error('Descripción Requerida', 'Por favor describe la incidencia técnica.');
      return;
    }

    play('success');

    const agent = AGENTS[assignedAgentIndex];
    const newId = `TK-${Math.floor(1000 + Math.random() * 9000)}`;

    const newTicket: Ticket = {
      id: newId,
      title: title.trim(),
      description: description.trim(),
      status: 'open',
      priority,
      category,
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim(),
      customerCompany: customerCompany.trim() || 'Empresa Independiente',
      customerAvatar: '/images/profile/user-3.jpg',
      agentName: agent.name,
      agentAvatar: agent.avatar,
      agentRole: agent.role,
      createdAt: 'Hace un momento',
      updatedAt: 'Hace un momento',
      slaDueHours: slaHours,
      slaStatus: 'on_track',
      messages: [
        {
          id: `msg-${Date.now()}`,
          senderName: customerName.trim(),
          senderAvatar: '/images/profile/user-3.jpg',
          senderRole: 'customer',
          timestamp: 'Hace un momento',
          content: description.trim(),
        },
      ],
    };

    onCreateTicket(newTicket);
    pillToast.success('Ticket Registrado', `Incidencia ${newId} añadida a la cola de atención.`);
  };

  const getPriorityBadgeClass = (p: TicketPriority) => {
    switch (p) {
      case 'urgent':
        return 'border-rose-500/30 text-rose-500 bg-rose-500/5';
      case 'high':
        return 'border-amber-500/30 text-amber-500 bg-amber-500/5';
      case 'medium':
        return 'border-blue-500/30 text-blue-500 bg-blue-500/5';
      default:
        return 'border-muted text-muted-foreground bg-muted/20';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-card border border-border/50 shadow-xs">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            play('click');
            onCancel();
          }}
          className="gap-2 text-xs text-muted-foreground hover:text-foreground self-start"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver a la Cola de Tickets</span>
        </Button>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              play('click');
              onCancel();
            }}
            className="h-8 px-3 rounded-xl text-xs font-medium"
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={() => handleSubmit()}
            className="h-8 px-4 rounded-xl text-xs font-medium gap-1.5 shadow-sm bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Registrar Incidencia</span>
          </Button>
        </div>
      </div>

      {/* 12-Column Responsive Layout */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Core Ticket & Requester Info */}
        <div className="lg:col-span-8 space-y-6">
          {/* Incident Details Card */}
          <Card className="rounded-2xl border-border/50 bg-card/70 backdrop-blur-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">
                    Datos de la Incidencia Técnica
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Registra los parámetros operativos, severidad y pasos de reproducción
                  </CardDescription>
                </div>
                <Badge variant="outline" className={cn('text-xs font-mono', getPriorityBadgeClass(priority))}>
                  Prioridad {priority.toUpperCase()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Asunto / Título de la Incidencia *
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej: Fallo en replicación de webhooks hacia endpoint HTTPS con error 502"
                  className="rounded-xl text-xs h-9 bg-background/60"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Categoría de Afectación
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as TicketCategory)}
                    className="w-full h-9 px-3 text-xs rounded-xl bg-background/60 border border-border/60 text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="Técnico">Técnico & APIs</option>
                    <option value="Facturación">Facturación & Pagos</option>
                    <option value="Licencias">Licencias & Cuotas</option>
                    <option value="Seguridad">Seguridad & RBAC</option>
                    <option value="Infraestructura">Infraestructura & Nodos</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Nivel de Severidad (Prioridad)
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => {
                      const val = e.target.value as TicketPriority;
                      setPriority(val);
                      if (val === 'urgent') setSlaHours(2);
                      else if (val === 'high') setSlaHours(4);
                      else if (val === 'medium') setSlaHours(6);
                      else setSlaHours(24);
                    }}
                    className="w-full h-9 px-3 text-xs rounded-xl bg-background/60 border border-border/60 text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="urgent">Urgente (P1 - Crítico)</option>
                    <option value="high">Alta (P2 - Alto)</option>
                    <option value="medium">Media (P3 - Normal)</option>
                    <option value="low">Baja (P4 - Bajo)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Objetivo de SLA (Horas)
                  </label>
                  <select
                    value={slaHours}
                    onChange={(e) => setSlaHours(Number(e.target.value))}
                    className="w-full h-9 px-3 text-xs rounded-xl bg-background/60 border border-border/60 text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer font-mono"
                  >
                    <option value={2}>2 Horas (Tier Crítico P1)</option>
                    <option value={4}>4 Horas (Tier Alto P2)</option>
                    <option value={6}>6 Horas (Tier Normal P3)</option>
                    <option value={12}>12 Horas</option>
                    <option value={24}>24 Horas (Tier Bajo P4)</option>
                    <option value={48}>48 Horas</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Descripción Detallada del Incidente *
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detalla los pasos de reproducción, endpoint involucrado, trazas de error JSON o solicitudes del cliente..."
                  rows={6}
                  className="w-full p-3 rounded-xl bg-background/60 border border-border/60 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none leading-relaxed"
                />
                <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-primary shrink-0" />
                  <span>Incluye logs y códigos de respuesta HTTP para agilizar el diagnóstico.</span>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Customer Information Card */}
          <Card className="rounded-2xl border-border/50 bg-card/70 backdrop-blur-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">
                Datos del Cliente & Organización Solicitante
              </CardTitle>
              <CardDescription className="text-xs">
                Información de contacto para seguimiento y notificaciones de resolución
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-foreground">
                    Nombre del Solicitante *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Ej: Gabriela Santos"
                      className="pl-9 rounded-xl text-xs h-9 bg-background/60"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-foreground">
                    Correo Electrónico *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="gabriela@empresa.com"
                      className="pl-9 rounded-xl text-xs h-9 bg-background/60 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-foreground">
                    Empresa / Organización
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={customerCompany}
                      onChange={(e) => setCustomerCompany(e.target.value)}
                      placeholder="Ej: Fintech Global Ltd"
                      className="pl-9 rounded-xl text-xs h-9 bg-background/60"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-foreground">
                    Teléfono Directo (Opcional)
                  </label>
                  <Input
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+1 (555) 234-5678"
                    className="rounded-xl text-xs h-9 bg-background/60 font-mono tabular-nums"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Assigned Agent & SLA Intelligence */}
        <div className="lg:col-span-4 space-y-6">
          {/* Assigned Agent Card */}
          <Card className="rounded-2xl border-border/50 bg-card/70 backdrop-blur-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">
                Especialista Asignado
              </CardTitle>
              <CardDescription className="text-xs">
                Ingeniero responsable de la investigación inicial
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Seleccionar Agente de Soporte
                </label>
                <select
                  value={assignedAgentIndex}
                  onChange={(e) => setAssignedAgentIndex(Number(e.target.value))}
                  className="w-full h-9 px-3 text-xs rounded-xl bg-background/60 border border-border/60 text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  {AGENTS.map((agent, idx) => (
                    <option key={agent.name} value={idx}>
                      {agent.name} • {agent.role.split(' ')[0]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Agent Rich Preview Card */}
              <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/50 flex items-center gap-3">
                <img
                  src={selectedAgent.avatar}
                  alt={selectedAgent.name}
                  className="w-11 h-11 rounded-2xl object-cover border border-border/50 shadow-xs"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-semibold text-foreground truncate">
                      {selectedAgent.name}
                    </h4>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {selectedAgent.role}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-mono">
                      {selectedAgent.tier}
                    </Badge>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                      {selectedAgent.status}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SLA Intelligence Card */}
          <Card className="rounded-2xl border-border/50 bg-card/70 backdrop-blur-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-primary" />
                <span>Política de SLA & Respuesta</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Tiempos de resolución según prioridad acordada
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 font-mono text-xs">
              <div className="p-3 rounded-xl bg-muted/40 border border-border/40 space-y-2">
                <div className="flex justify-between items-center text-muted-foreground">
                  <span className="text-[11px]">Compromiso SLA:</span>
                  <span className="font-bold text-foreground tabular-nums">{slaHours} horas</span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span className="text-[11px]">Respuesta Inicial:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    &lt; 30 minutos
                  </span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span className="text-[11px]">Escalamiento L3:</span>
                  <span className="font-semibold text-foreground">
                    {priority === 'urgent' ? 'Inmediato' : 'Si excede 50%'}
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/20 text-[11px] text-muted-foreground leading-relaxed flex items-start gap-2 font-sans">
                <Shield className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>
                  Al registrarse, el cliente recibe una clave de seguimiento y el equipo de guardia es alertado por Webhook.
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Quick Preview Badge Card */}
          <Card className="rounded-2xl border-border/50 bg-card/70 backdrop-blur-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Ficha Resumen Preliminar
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-border/30">
                <span className="text-muted-foreground">Estado:</span>
                <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                  En Cola (Nuevo)
                </Badge>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/30">
                <span className="text-muted-foreground">Solicitante:</span>
                <span className="font-semibold text-foreground truncate max-w-[150px]">
                  {customerName || 'No especificado'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">Canal de Ingreso:</span>
                <span className="font-mono text-muted-foreground">Portal Mesa de Ayuda</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
};
