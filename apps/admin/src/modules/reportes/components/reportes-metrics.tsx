import React from 'react';
import { Card, CardContent } from '../../../shared/components/ui/card';
import { ReportMetric } from '../types/reportes.types';
import { FileText, Database, Clock, ShieldCheck } from 'lucide-react';
import { cn } from '../../../shared/lib/utils';

interface ReportesMetricsProps {
  metrics: ReportMetric[];
}

export const ReportesMetrics: React.FC<ReportesMetricsProps> = ({ metrics }) => {
  const icons = [FileText, Database, Clock, ShieldCheck];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric, idx) => {
        const Icon = icons[idx % icons.length];
        return (
          <Card
            key={idx}
            className="rounded-2xl border-border/60 bg-card/70 backdrop-blur-xl hover:border-primary/30 transition-all p-5 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                {metric.label}
              </span>
              <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Icon className="h-4 w-4" />
              </div>
            </div>

            <div className="mt-3 space-y-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-2xl font-bold font-heading text-foreground tabular-nums">
                  {metric.value}
                </span>
                <span
                  className={cn(
                    'text-xs font-mono font-medium',
                    metric.isPositive ? 'text-emerald-500' : 'text-rose-500'
                  )}
                >
                  {metric.change}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">{metric.sub}</p>
            </div>
          </Card>
        );
      })}
    </div>
  );
};
