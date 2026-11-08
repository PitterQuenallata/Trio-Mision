import React from 'react';
import { Download, Sparkles, Clock, CheckCircle2, FileText, ArrowRight } from 'lucide-react';
import { Card } from '../../../shared/components/ui/card';
import { Button } from '../../../shared/components/ui/button';
import { Badge } from '../../../shared/components/ui/badge';
import { ReportItem } from '../types/reportes.types';
import { useSound } from '../../../shared/context/sound-context';
import { pillToast } from '../../../shared/components/ui/pill-toast';
import { cn } from '../../../shared/lib/utils';

interface ReportesGridProps {
  reports: ReportItem[];
  onTriggerGenerate?: (report: ReportItem) => void;
}

export const ReportesGrid: React.FC<ReportesGridProps> = ({
  reports,
  onTriggerGenerate,
}) => {
  const { play } = useSound();

  const handleDownload = (report: ReportItem) => {
    if (report.status === 'En Proceso') {
      play('alert');
      pillToast.info('En Generación', 'El documento se está compilando en segundo plano.');
      return;
    }
    play('pop');
    pillToast.success('Descarga Iniciada', `Descargando informe "${report.title}" (${report.size}).`);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {reports.map((rep) => {
        const isCompleted = rep.status === 'Completado';
        const isProcessing = rep.status === 'En Proceso';

        return (
          <Card
            key={rep.id}
            className="p-5 flex flex-col justify-between rounded-2xl border-border/60 bg-card/70 backdrop-blur-xl hover:border-primary/40 hover:shadow-md transition-all duration-200 relative overflow-hidden"
          >
            <div>
              {/* Category & Status Row */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="font-mono text-[10px] px-2 py-0.2 uppercase">
                    {rep.category}
                  </Badge>
                  <Badge variant="secondary" className="font-mono text-[10px] px-2 py-0.2 font-bold">
                    {rep.format}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold',
                      isCompleted
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : isProcessing
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {isCompleted && <CheckCircle2 className="h-2.5 w-2.5" />}
                    {isProcessing && <Clock className="h-2.5 w-2.5 animate-spin" />}
                    {rep.status}
                  </span>
                  <span className="text-muted-foreground tabular-nums">{rep.size}</span>
                </div>
              </div>

              {/* Title & Description */}
              <h3 className="font-semibold text-base mt-3 text-foreground leading-snug">
                {rep.title}
              </h3>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                {rep.desc}
              </p>
            </div>

            {/* Bottom Meta & Actions */}
            <div className="mt-5 pt-3.5 border-t border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5 font-mono text-[11px] text-muted-foreground">
                <div>
                  Frecuencia: <span className="font-semibold text-foreground">{rep.frequency}</span>
                </div>
                <div>
                  Última corrida: <span className="text-foreground">{rep.lastGenerated}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant={isCompleted ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleDownload(rep)}
                  className="gap-1.5 text-xs rounded-xl cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>{isCompleted ? 'Descargar' : 'Revisar Estado'}</span>
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};
