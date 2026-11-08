import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../shared/components/ui/card';
import { Button } from '../../../shared/components/ui/button';
import { Badge } from '../../../shared/components/ui/badge';
import { GeneratedReportRecord } from '../types/reportes.types';
import { Download, RefreshCw, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { useSound } from '../../../shared/context/sound-context';
import { pillToast } from '../../../shared/components/ui/pill-toast';
import { cn } from '../../../shared/lib/utils';

interface ReportesHistoryTableProps {
  history: GeneratedReportRecord[];
  onRefresh?: () => void;
}

export const ReportesHistoryTable: React.FC<ReportesHistoryTableProps> = ({
  history,
  onRefresh,
}) => {
  const { play } = useSound();

  const handleDownload = (record: GeneratedReportRecord) => {
    if (record.status !== 'Completado') {
      play('alert');
      pillToast.info('Informe no disponible', `El reporte aún está con estado "${record.status}".`);
      return;
    }
    play('pop');
    pillToast.success('Descarga Iniciada', `Descargando archivo ${record.reportName}.${record.format.toLowerCase()}`);
  };

  return (
    <Card className="rounded-2xl border-border/60 bg-card/70 backdrop-blur-xl overflow-hidden">
      <CardHeader className="pb-4 border-b border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base font-semibold text-foreground">
            Registro de Ejecuciones & Descargas Recientes
          </CardTitle>
          <CardDescription className="text-xs">
            Bitácora de informes solicitados por operadores administrativos o despachados por jobs cron
          </CardDescription>
        </div>
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            className="text-xs rounded-xl gap-1.5 self-start sm:self-auto cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Actualizar Bitácora</span>
          </Button>
        )}
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-secondary/40 border-b border-border/50 text-muted-foreground font-mono text-[11px]">
              <tr>
                <th className="py-3 px-4 font-semibold">Reporte / Asunto</th>
                <th className="py-3 px-3 font-semibold">Formato</th>
                <th className="py-3 px-3 font-semibold">Solicitante</th>
                <th className="py-3 px-3 font-semibold">Fecha / Hora</th>
                <th className="py-3 px-3 font-semibold">Tamaño</th>
                <th className="py-3 px-3 font-semibold text-center">Estado</th>
                <th className="py-3 px-4 font-semibold text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {history.map((rec) => {
                const isCompleted = rec.status === 'Completado';
                const isProcessing = rec.status === 'En Proceso';

                return (
                  <tr key={rec.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-foreground">
                      <div className="font-semibold">{rec.reportName}</div>
                      <span className="text-[10px] font-mono text-muted-foreground uppercase">
                        {rec.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <Badge variant="outline" className="font-mono text-[10px] px-2 py-0.2">
                        {rec.format}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-3 text-muted-foreground font-mono text-[11px]">
                      {rec.requestedBy}
                    </td>
                    <td className="py-3.5 px-3 text-muted-foreground font-mono text-[11px]">
                      {rec.generatedAt}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-foreground tabular-nums">
                      {rec.size}
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 font-mono text-[10px] px-2.5 py-0.5 rounded-full font-semibold',
                          isCompleted
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : isProcessing
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {isCompleted && <CheckCircle2 className="h-3 w-3" />}
                        {isProcessing && <RefreshCw className="h-3 w-3 animate-spin" />}
                        {!isCompleted && !isProcessing && <Clock className="h-3 w-3" />}
                        {rec.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Button
                        variant={isCompleted ? 'default' : 'ghost'}
                        size="sm"
                        disabled={!isCompleted}
                        onClick={() => handleDownload(rec)}
                        className={cn(
                          'h-7 text-xs rounded-xl gap-1.5 font-medium cursor-pointer',
                          !isCompleted && 'opacity-40 cursor-not-allowed'
                        )}
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Descargar</span>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};
