import React from 'react';
import { Link } from '@tanstack/react-router';
import { Card } from '../../../shared/components/ui/card';
import { useAuth } from '../../../shared/auth/auth-context';
import { useDashboardKpis } from '../hooks/use-dashboard-kpis';

export const DashboardPage: React.FC = () => {
  const { identidad } = useAuth();
  const kpis = useDashboardKpis();
  const esManager = Boolean(identidad?.artist_memberships.some((m) => m.role === 'manager'));
  const esStaff = Boolean(identidad?.staff_roles.length);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <header className="border-b border-border/40 pb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Panel de control</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {identidad?.display_name ? `Hola, ${identidad.display_name}. ` : ''}
          Lo que requiere atención, con datos en vivo de la API.
        </p>
      </header>

      {kpis.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <Card key={kpi.id} className="rounded-2xl border-border/50 bg-card/70 p-5 backdrop-blur-xl">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{kpi.title}</span>
              <p className="mt-3 text-3xl font-bold tabular-nums text-foreground">
                {kpi.loading ? '…' : kpi.error ? '—' : kpi.value}
              </p>
              {kpi.error && <p className="mt-1 text-xs text-red-400">No se pudo cargar.</p>}
            </Card>
          ))}
        </div>
      )}

      {esManager && (
        <Link to="/mi-grupo" className="block">
          <Card className="rounded-2xl border-border/50 bg-card/70 p-5 transition-all hover:border-primary/40">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mi grupo</span>
            <p className="mt-2 text-sm text-foreground">Ver los artistas que administras.</p>
          </Card>
        </Link>
      )}

      {!esStaff && !esManager && (
        <p className="text-sm text-muted-foreground">Tu cuenta no tiene indicadores en el panel.</p>
      )}
    </div>
  );
};

export default DashboardPage;
