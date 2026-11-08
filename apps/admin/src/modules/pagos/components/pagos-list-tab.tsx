import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Eye,
  Send,
  Trash2,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowUpDown,
  Download,
} from 'lucide-react';
import { useIconHover } from '@animateicons/react';
import { DownloadIcon } from '@animateicons/react/lucide';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../shared/components/ui/card';
import { Button } from '../../../shared/components/ui/button';
import { Badge } from '../../../shared/components/ui/badge';
import { Input } from '../../../shared/components/ui/input';
import { Invoice, InvoiceStatus } from '../types/pagos.types';
import { useSound } from '../../../shared/context/sound-context';
import { pillToast } from '../../../shared/components/ui/pill-toast';
import { cn } from '../../../shared/lib/utils';

interface PagosListTabProps {
  invoices: Invoice[];
  onSelectInvoice: (invoice: Invoice) => void;
  onNavigateToCreate: () => void;
  onDeleteInvoice: (id: string) => void;
}

export const PagosListTab: React.FC<PagosListTabProps> = ({
  invoices,
  onSelectInvoice,
  onNavigateToCreate,
  onDeleteInvoice,
}) => {
  const { play } = useSound();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>('date-desc');
  const downloadHover = useIconHover();

  // Metrics
  const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.total, 0);
  const totalCollected = invoices
    .filter((inv) => inv.status === 'Paid')
    .reduce((sum, inv) => sum + inv.total, 0);
  const totalPending = invoices
    .filter((inv) => inv.status === 'Pending')
    .reduce((sum, inv) => sum + inv.total, 0);
  const totalOverdue = invoices
    .filter((inv) => inv.status === 'Overdue')
    .reduce((sum, inv) => sum + inv.total, 0);

  // Filtered & Sorted Invoices
  const filteredInvoices = useMemo(() => {
    return invoices
      .filter((inv) => {
        const matchSearch =
          inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
          inv.client.name.toLowerCase().includes(search.toLowerCase()) ||
          inv.client.company.toLowerCase().includes(search.toLowerCase()) ||
          inv.client.email.toLowerCase().includes(search.toLowerCase());

        const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
        return matchSearch && matchStatus;
      })
      .sort((a, b) => {
        if (sortBy === 'amount-desc') return b.total - a.total;
        if (sortBy === 'amount-asc') return a.total - b.total;
        return 0; // Default order
      });
  }, [invoices, search, statusFilter, sortBy]);

  const getStatusBadge = (status: InvoiceStatus) => {
    switch (status) {
      case 'Paid':
        return (
          <Badge variant="outline" className="text-[10px] font-mono bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
            Pagada
          </Badge>
        );
      case 'Pending':
        return (
          <Badge variant="outline" className="text-[10px] font-mono bg-amber-500/10 text-amber-500 border-amber-500/20">
            Pendiente
          </Badge>
        );
      case 'Overdue':
        return (
          <Badge variant="outline" className="text-[10px] font-mono bg-red-500/10 text-red-500 border-red-500/20">
            Vencida
          </Badge>
        );
      case 'Draft':
      default:
        return (
          <Badge variant="secondary" className="text-[10px] font-mono">
            Borrador
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards Row (Zero Icons in Headers/Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border">
          <CardContent className="p-5 space-y-1">
            <span className="text-xs text-muted-foreground block font-medium">Volumen Total Facturado</span>
            <div className="font-mono text-2xl font-bold text-foreground tabular-nums">
              ${totalInvoiced.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[11px] text-muted-foreground font-mono">
              {invoices.length} comprobantes emitidos
            </span>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-5 space-y-1">
            <span className="text-xs text-muted-foreground block font-medium">Cobrado & Liquidado</span>
            <div className="font-mono text-2xl font-bold text-emerald-500 tabular-nums">
              ${totalCollected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[11px] text-emerald-500/80 font-mono">
              {totalInvoiced > 0 ? ((totalCollected / totalInvoiced) * 100).toFixed(1) : 0}% efectividad
            </span>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-5 space-y-1">
            <span className="text-xs text-muted-foreground block font-medium">Pendiente de Cobro</span>
            <div className="font-mono text-2xl font-bold text-amber-500 tabular-nums">
              ${totalPending.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[11px] text-amber-500/80 font-mono">En plazo legal de crédito</span>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-5 space-y-1">
            <span className="text-xs text-muted-foreground block font-medium">Vencido o en Disputa</span>
            <div className="font-mono text-2xl font-bold text-red-500 tabular-nums">
              ${totalOverdue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[11px] text-red-500/80 font-mono">Requiere recordatorio formal</span>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="border-border">
        <CardHeader className="pb-4 border-b border-border/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-bold">Directorio de Facturación & Cobros</CardTitle>
              <CardDescription className="text-xs">
                Registro oficial de facturas emitidas, conciliación bancaria y control de vencimientos
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                soundType="click"
                {...downloadHover.triggerProps}
                onClick={() => {
                  play('click');
                  pillToast.info('Libro de Ventas Exportado', 'El extracto de facturación se descargó en CSV.');
                }}
                className="text-xs gap-1.5"
              >
                <DownloadIcon ref={downloadHover.ref} className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Exportar CSV</span>
              </Button>

              <Button
                variant="default"
                size="sm"
                soundType="pop"
                onClick={() => {
                  play('pop');
                  onNavigateToCreate();
                }}
                className="text-xs gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Nueva Factura
              </Button>
            </div>
          </div>

          {/* Search, Filter & Sorter Toolbar */}
          <div className="pt-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por # de factura, empresa, cliente o correo..."
                className="pl-9 text-xs h-9 bg-background"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => {
                  play('click');
                  setStatusFilter(e.target.value);
                }}
                className="h-9 px-3 rounded-xl border border-border bg-background text-xs font-medium text-foreground cursor-pointer focus:outline-hidden"
              >
                <option value="all">Todos los Estados</option>
                <option value="Paid">Pagadas</option>
                <option value="Pending">Pendientes</option>
                <option value="Overdue">Vencidas</option>
                <option value="Draft">Borradores</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => {
                  play('click');
                  setSortBy(e.target.value as any);
                }}
                className="h-9 px-3 rounded-xl border border-border bg-background text-xs font-medium text-foreground cursor-pointer focus:outline-hidden"
              >
                <option value="date-desc">Más Recientes</option>
                <option value="amount-desc">Mayor Importe</option>
                <option value="amount-asc">Menor Importe</option>
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-secondary/40 border-b border-border text-muted-foreground font-mono text-[11px]">
                <tr>
                  <th className="py-3 px-4 font-medium">Factura</th>
                  <th className="py-3 px-4 font-medium">Cliente / Razón Social</th>
                  <th className="py-3 px-3 font-medium">Fecha Emisión</th>
                  <th className="py-3 px-3 font-medium">Vencimiento</th>
                  <th className="py-3 px-4 font-medium text-right">Importe Total</th>
                  <th className="py-3 px-3 font-medium text-center">Estado</th>
                  <th className="py-3 px-4 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      No se encontraron facturas con los criterios seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className="hover:bg-muted/30 transition-colors group cursor-pointer"
                      onClick={() => onSelectInvoice(inv)}
                    >
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-foreground block group-hover:text-primary transition-colors">
                          {inv.invoiceNumber}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {inv.items.length} {inv.items.length === 1 ? 'ítem' : 'ítems'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary font-bold flex items-center justify-center text-[10px] shrink-0 font-mono">
                            {inv.client.name
                              .split(' ')
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join('')}
                          </div>
                          <div>
                            <span className="font-semibold text-foreground block line-clamp-1">
                              {inv.client.company}
                            </span>
                            <span className="text-[11px] text-muted-foreground block truncate max-w-[180px]">
                              {inv.client.name} • {inv.client.taxId}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-muted-foreground font-mono tabular-nums">
                        {inv.issueDate}
                      </td>

                      <td className="py-3 px-3 font-mono tabular-nums">
                        <span
                          className={cn(
                            inv.status === 'Overdue' ? 'text-red-500 font-semibold' : 'text-muted-foreground'
                          )}
                        >
                          {inv.dueDate}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-foreground text-sm tabular-nums">
                        ${inv.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        <span className="text-[10px] font-normal text-muted-foreground ml-1">USD</span>
                      </td>

                      <td className="py-3 px-3 text-center">
                        {getStatusBadge(inv.status)}
                      </td>

                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="iconSm"
                            soundType="click"
                            onClick={() => {
                              play('click');
                              onSelectInvoice(inv);
                            }}
                            title="Ver Ficha Oficial"
                          >
                            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="iconSm"
                            soundType="click"
                            onClick={() => {
                              play('click');
                              pillToast.success('Comprobante Descargado', `Archivo ${inv.invoiceNumber}.pdf descargado.`);
                            }}
                            title="Descargar PDF"
                          >
                            <Download className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                          {inv.status === 'Pending' || inv.status === 'Overdue' ? (
                            <Button
                              variant="ghost"
                              size="iconSm"
                              soundType="pop"
                              onClick={() => {
                                play('pop');
                                pillToast.info(
                                  'Recordatorio Enviado',
                                  `Se notificó a ${inv.client.email} sobre la factura pendiente.`
                                );
                              }}
                              title="Enviar Recordatorio por Email"
                            >
                              <Send className="h-3.5 w-3.5 text-primary" />
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="iconSm"
                            soundType="alert"
                            onClick={() => {
                              play('alert');
                              onDeleteInvoice(inv.id);
                              pillToast.info('Factura Eliminada', `Se retiró el comprobante ${inv.invoiceNumber}.`);
                            }}
                            title="Eliminar registro"
                            className="hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
