import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from '../../../shared/components/ui/card';
import { KpiMetric } from '../types/dashboard.types';
import { cn } from '../../../shared/lib/utils';

interface DashboardKpiGridProps {
  metrics: KpiMetric[];
}

export const DashboardKpiGrid: React.FC<DashboardKpiGridProps> = ({ metrics }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((kpi, idx) => (
        <Card
          key={idx}
          className="relative overflow-hidden p-5 transition-all hover:border-primary/40 rounded-2xl border-border/50 bg-card/70 backdrop-blur-xl group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              {kpi.title}
            </span>
            <span
              className={cn(
                'inline-flex items-center gap-0.5 font-semibold text-xs font-mono tabular-nums',
                kpi.trend === 'up'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-500'
              )}
            >
              {kpi.trend === 'up' ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {kpi.change}
            </span>
          </div>

          <div className="mt-3">
            <div className="text-3xl sm:text-4xl font-bold tracking-tight font-mono tabular-nums text-foreground">
              {kpi.value}
            </div>
          </div>

          <div className="mt-2 text-xs text-muted-foreground">
            {kpi.subtitle}
          </div>
        </Card>
      ))}
    </div>
  );
};
