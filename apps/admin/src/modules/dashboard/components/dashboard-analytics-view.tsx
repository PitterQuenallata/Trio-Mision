import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../shared/components/ui/card';
import { Badge } from '../../../shared/components/ui/badge';
import { DashboardKpiGrid } from './dashboard-kpi-grid';
import { analyticsKpisData, trafficSourcesData, geoTrafficData } from '../data/dashboard-data';
import { cn } from '../../../shared/lib/utils';

export const DashboardAnalyticsView: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 4 KPIs Apple Grid */}
      <DashboardKpiGrid metrics={analyticsKpisData} />

      {/* Traffic Sources & Geo Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Acquisition Channels (6 cols) */}
        <div className="lg:col-span-6">
          <Card className="rounded-2xl border-border/50 bg-card/70 backdrop-blur-xl h-full flex flex-col justify-between">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-base font-semibold">
                Canales de Adquisición & Rendimiento
              </CardTitle>
              <CardDescription className="text-xs">
                Distribución porcentual de sesiones y tasa de rebote asociada
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-3">
                {trafficSourcesData.map((src, idx) => (
                  <div key={idx} className="space-y-1 font-mono text-xs">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-sans font-medium text-foreground">
                        {src.channel}
                      </span>
                      <div className="flex items-center gap-2 tabular-nums">
                        <span className="text-muted-foreground">{src.visits.toLocaleString()} visitas</span>
                        <span className="font-bold text-foreground">{src.percentage}%</span>
                      </div>
                    </div>
                    <div className="w-full bg-muted/60 h-2 rounded-full overflow-hidden flex">
                      <div className={cn('h-full rounded-full', src.color)} style={{ width: `${src.percentage}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-background/50 border border-border/40 text-xs flex justify-between items-center font-mono tabular-nums">
                <span className="text-muted-foreground">Tasa Global de Conversión de Sesiones:</span>
                <span className="font-semibold text-emerald-500">4.82%</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Geographic Distribution (6 cols) */}
        <div className="lg:col-span-6">
          <Card className="rounded-2xl border-border/50 bg-card/70 backdrop-blur-xl h-full flex flex-col justify-between">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-base font-semibold">
                Desglose Geográfico de Audiencia
              </CardTitle>
              <CardDescription className="text-xs">
                Concentración de usuarios activos por región territorial
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/30">
                {geoTrafficData.map((geo, idx) => (
                  <div key={idx} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div>
                      <h4 className="text-xs font-semibold text-foreground">
                        {geo.region}
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        {geo.country}
                      </p>
                    </div>

                    <div className="text-right font-mono tabular-nums">
                      <span className="text-xs font-bold text-foreground block">
                        {geo.usersCount.toLocaleString()} usuarios
                      </span>
                      <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 border-border/50">
                        {geo.percentage}% del total
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
