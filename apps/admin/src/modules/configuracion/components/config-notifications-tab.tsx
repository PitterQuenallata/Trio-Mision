import React, { useState } from 'react';
import { Plus, Bell, Send } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../shared/components/ui/card';
import { Button } from '../../../shared/components/ui/button';
import { Switch } from '../../../shared/components/ui/switch';
import { Badge } from '../../../shared/components/ui/badge';
import { NotificationChannel } from '../types/configuracion.types';
import { useSound } from '../../../shared/context/sound-context';
import { pillToast } from '../../../shared/components/ui/pill-toast';
import { cn } from '../../../shared/lib/utils';

interface ConfigNotificationsTabProps {
  initialChannels: NotificationChannel[];
  onSaveChannels: (channels: NotificationChannel[]) => void;
}

export const ConfigNotificationsTab: React.FC<ConfigNotificationsTabProps> = ({
  initialChannels,
  onSaveChannels,
}) => {
  const { play } = useSound();
  const [channels, setChannels] = useState<NotificationChannel[]>(initialChannels);

  const handleToggleChannel = (id: string, enabled: boolean) => {
    play('click');
    const updated = channels.map((c) => (c.id === id ? { ...c, enabled } : c));
    setChannels(updated);
    onSaveChannels(updated);
    pillToast.info('Canal de Alertas', `Canal ${enabled ? 'habilitado' : 'deshabilitado'} exitosamente.`);
  };

  const handleSendTestNotification = () => {
    play('pop');
    pillToast.success('Prueba Transmitida', 'Notificación de prueba enviada a los canales activos.');
  };

  const handleAddChannel = () => {
    play('click');
    pillToast.info('Nuevo Canal', 'Abriendo asistente de integración para webhook de alerta.');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <h2 className="text-base font-bold tracking-tight text-foreground">
            Canales de Alerta & Notificaciones Operativas
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Enrutamiento de incidentes críticos, brechas de SLA y eventos de facturación
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSendTestNotification}
            className="rounded-xl h-8 text-xs gap-1.5"
          >
            <Send className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Probar Canales</span>
          </Button>
          <Button
            size="sm"
            onClick={handleAddChannel}
            className="rounded-xl h-8 px-3 text-xs gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Añadir Canal</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {channels.map((ch) => (
          <Card
            key={ch.id}
            className={cn(
              'p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4',
              ch.enabled
                ? 'border-border/50 bg-card/70 backdrop-blur-xl'
                : 'border-border/30 bg-card/40 opacity-70'
            )}
          >
            <div>
              <div className="flex items-center justify-between">
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] font-mono px-2 py-0',
                    ch.type === 'slack' && 'border-indigo-500/30 text-indigo-500 bg-indigo-500/5',
                    ch.type === 'pagerduty' && 'border-rose-500/30 text-rose-500 bg-rose-500/5',
                    ch.type === 'email' && 'border-blue-500/30 text-blue-500 bg-blue-500/5',
                    ch.type === 'webhook' && 'border-amber-500/30 text-amber-500 bg-amber-500/5'
                  )}
                >
                  {ch.type.toUpperCase()}
                </Badge>
                <Switch
                  checked={ch.enabled}
                  onCheckedChange={(val) => handleToggleChannel(ch.id, val)}
                />
              </div>

              <h3 className="font-semibold text-sm mt-3 text-foreground">
                {ch.name}
              </h3>
              <p className="text-xs font-mono text-muted-foreground mt-1">
                Destino: {ch.target}
              </p>
            </div>

            <div className="pt-3 border-t border-border/30">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider block mb-1.5">
                Eventos Suscritos:
              </span>
              <div className="flex flex-wrap gap-1">
                {ch.events.map((ev, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-muted/60 text-muted-foreground border border-border/40"
                  >
                    {ev}
                  </span>
                ))}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
