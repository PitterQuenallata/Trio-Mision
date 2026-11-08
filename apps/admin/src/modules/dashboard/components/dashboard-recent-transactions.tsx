import React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ArrowUpRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../shared/components/ui/card';
import { Button } from '../../../shared/components/ui/button';
import { Badge } from '../../../shared/components/ui/badge';
import { RecentTransaction } from '../types/dashboard.types';
import { formatCurrency, cn } from '../../../shared/lib/utils';
import { useSound } from '../../../shared/context/sound-context';
import { pillToast } from '../../../shared/components/ui/pill-toast';

interface DashboardRecentTransactionsProps {
  transactions: RecentTransaction[];
}

export const DashboardRecentTransactions: React.FC<DashboardRecentTransactionsProps> = ({
  transactions,
}) => {
  const { play } = useSound();
  const navigate = useNavigate();

  return (
    <Card className="rounded-2xl border-border/50 bg-card/70 backdrop-blur-xl">
      <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/40">
        <div>
          <CardTitle className="text-base font-semibold">
            Últimas Transacciones
          </CardTitle>
          <CardDescription className="text-xs">
            Cobros automáticos procesados en las últimas 24 horas
          </CardDescription>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            play('click');
            navigate({ to: '/pagos' });
          }}
          className="text-xs gap-1"
        >
          Ver todo
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border/40 text-muted-foreground font-semibold">
                <th className="py-3 px-5">ID Transacción</th>
                <th className="py-3 px-5">Cliente</th>
                <th className="py-3 px-5">Plan</th>
                <th className="py-3 px-5">Monto</th>
                <th className="py-3 px-5">Estado</th>
                <th className="py-3 px-5 text-right">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-5 font-mono tabular-nums font-medium text-foreground">
                    {tx.id}
                  </td>
                  <td className="py-3 px-5 font-medium text-foreground">
                    {tx.client}
                  </td>
                  <td className="py-3 px-5 text-muted-foreground">
                    {tx.plan}
                  </td>
                  <td className="py-3 px-5 font-mono tabular-nums font-semibold text-foreground">
                    {formatCurrency(tx.amount)}
                  </td>
                  <td className="py-3 px-5">
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] font-mono px-2 py-0',
                        tx.status === 'Completado' && 'border-emerald-500/30 text-emerald-500 bg-emerald-500/5',
                        tx.status === 'Procesando' && 'border-amber-500/30 text-amber-500 bg-amber-500/5',
                        tx.status === 'Fallido' && 'border-rose-500/30 text-rose-500 bg-rose-500/5'
                      )}
                    >
                      {tx.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-5 text-right font-mono tabular-nums text-muted-foreground">
                    {tx.date}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};
