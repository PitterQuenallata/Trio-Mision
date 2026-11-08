import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../shared/components/ui/card';
import { RevenueChartPoint } from '../types/dashboard.types';

interface DashboardRevenueChartProps {
  points: RevenueChartPoint[];
}

export const DashboardRevenueChart: React.FC<DashboardRevenueChartProps> = ({ points }) => {
  return (
    <Card className="rounded-2xl border-border/50 bg-card/70 backdrop-blur-xl">
      <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/40">
        <div>
          <CardTitle className="text-base font-semibold">
            Crecimiento de Facturación (MRR)
          </CardTitle>
          <CardDescription className="text-xs">
            Progresión de ingresos recurrentes netos en miles de USD
          </CardDescription>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-primary" />
          <span className="text-xs font-medium text-muted-foreground">MRR Real</span>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="h-64 w-full flex flex-col justify-between pt-2">
          <div className="flex-1 flex items-end justify-between gap-2 px-2 pb-2 border-b border-border/40">
            {points.map((pt, i) => {
              const heightPercent = (pt.value / 140) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                  <div className="text-[10px] font-mono text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity tabular-nums">
                    ${pt.value}k
                  </div>
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className={
                      i === points.length - 1
                        ? 'w-full max-w-[34px] rounded-t-lg bg-primary shadow-sm'
                        : 'w-full max-w-[34px] rounded-t-lg bg-primary/25 group-hover:bg-primary/45 transition-colors'
                    }
                  />
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {pt.month}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-3 text-xs text-muted-foreground font-mono tabular-nums">
            <span>Objetivo Q4: $150,000.00</span>
            <span className="font-semibold text-emerald-500">+18.2% vs Presupuesto</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
