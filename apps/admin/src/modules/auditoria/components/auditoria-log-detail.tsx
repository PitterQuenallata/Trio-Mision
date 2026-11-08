import React from 'react';
import { ShieldAlert, Code2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../shared/components/ui/card';
import { Badge } from '../../../shared/components/ui/badge';
import { AuditLog } from '../types/auditoria.types';
import { cn } from '../../../shared/lib/utils';

interface AuditoriaLogDetailProps {
  log: AuditLog | null;
}

export const AuditoriaLogDetail: React.FC<AuditoriaLogDetailProps> = ({ log }) => {
  return (
    <Card className="rounded-2xl border-border/50 bg-card/70 backdrop-blur-xl">
      <CardHeader className="pb-3 border-b border-border/40">
        <CardTitle className="text-sm font-semibold">
          Metadatos del Evento
        </CardTitle>
        <CardDescription className="text-xs">
          Carga útil en formato JSON y datos de sesión
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        {log ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-primary tabular-nums">
                {log.id}
              </span>
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] font-mono px-2 py-0',
                  log.severity === 'high' && 'border-rose-500/30 text-rose-500 bg-rose-500/5',
                  log.severity === 'medium' && 'border-amber-500/30 text-amber-500 bg-amber-500/5',
                  log.severity === 'low' && 'border-emerald-500/30 text-emerald-500 bg-emerald-500/5'
                )}
              >
                {log.severity.toUpperCase()}
              </Badge>
            </div>

            <div className="p-3 rounded-xl bg-background/50 border border-border/40 text-xs space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Actor:</span>
                <span className="text-foreground truncate max-w-[180px]">{log.actor}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Acción:</span>
                <span className="text-foreground">{log.action}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">IP Origen:</span>
                <span className="text-foreground tabular-nums">{log.ip}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fecha:</span>
                <span className="text-foreground tabular-nums">{log.timestamp}</span>
              </div>
            </div>

            <div>
              <span className="text-xs font-semibold text-muted-foreground block mb-1">
                Payload JSON Cifrado:
              </span>
              <pre className="p-3 rounded-xl bg-background/80 border border-border/50 text-[11px] font-mono overflow-x-auto text-foreground/90 leading-relaxed">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-muted-foreground">
            Selecciona un evento de la lista para inspeccionar sus metadatos forenses.
          </div>
        )}
      </CardContent>
    </Card>
  );
};
