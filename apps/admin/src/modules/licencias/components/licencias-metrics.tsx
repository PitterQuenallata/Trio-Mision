import React from 'react';
import { Card } from '../../../shared/components/ui/card';
import { LicenseMetric } from '../types/licencias.types';
import { cn } from '../../../shared/lib/utils';

interface LicenciasMetricsProps {
  metrics: LicenseMetric[];
}

export const LicenciasMetrics: React.FC<LicenciasMetricsProps> = ({ metrics }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {metrics.map((metric, idx) => (
        <Card
          key={idx}
          className="p-5 rounded-2xl border-border/50 bg-card/70 backdrop-blur-xl hover:border-primary/40 transition-all"
        >
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {metric.title}
          </span>
          <div className="text-3xl font-bold mt-2 font-mono tabular-nums text-foreground">
            {metric.value}
          </div>
          <p
            className={cn(
              'text-xs font-medium mt-1 font-mono tabular-nums',
              metric.trendColor || 'text-muted-foreground'
            )}
          >
            {metric.subtitle}
          </p>
        </Card>
      ))}
    </div>
  );
};
