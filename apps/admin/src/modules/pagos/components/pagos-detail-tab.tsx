import React from 'react';
import {
  Printer,
  Download,
  Send,
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertTriangle,
  QrCode,
  Building,
  Mail,
  Phone,
  FileCheck2,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../shared/components/ui/card';
import { Button } from '../../../shared/components/ui/button';
import { Badge } from '../../../shared/components/ui/badge';
import { Invoice } from '../types/pagos.types';
import { useSound } from '../../../shared/context/sound-context';
import { pillToast } from '../../../shared/components/ui/pill-toast';
import { cn } from '../../../shared/lib/utils';

interface PagosDetailTabProps {
  invoice: Invoice;
  onBack: () => void;
  onMarkAsPaid?: (invoiceId: string) => void;
}

export const PagosDetailTab: React.FC<PagosDetailTabProps> = ({
  invoice,
  onBack,
  onMarkAsPaid,
}) => {
  const { play } = useSound();

  const handlePrint = () => {
    play('click');
    window.print();
  };

  const handleDownloadPdf = () => {
    play('click');
    pillToast.success(
      'Documento PDF Generado',
      `Factura ${invoice.invoiceNumber}.pdf descargada con firma digital.`
    );
  };

  const handleSendEmail = () => {
    play('pop');
    pillToast.info(
      'Factura Enviada',
      `Se remitió la copia digital al correo ${invoice.client.email}.`
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <Button
          variant="ghost"
          size="sm"
          soundType="click"
          onClick={() => {
            play('click');
            onBack();
          }}
          className="text-xs gap-1.5 -ml-2 self-start"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al Directorio
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          {invoice.status !== 'Paid' && onMarkAsPaid && (
            <Button
              variant="outline"
              size="sm"
              soundType="success"
              onClick={() => {
                onMarkAsPaid(invoice.id);
                pillToast.success('Estado Actualizado', 'La factura fue marcada como pagada.');
              }}
              className="text-xs gap-1.5 text-emerald-500 hover:text-emerald-600 border-emerald-500/30"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Marcar como Pagada
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            soundType="pop"
            onClick={handleSendEmail}
            className="text-xs gap-1.5"
          >
            <Send className="h-3.5 w-3.5" />
            Enviar por Email
          </Button>

          <Button
            variant="outline"
            size="sm"
            soundType="click"
            onClick={handleDownloadPdf}
            className="text-xs gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Descargar PDF
          </Button>

          <Button
            variant="default"
            size="sm"
            soundType="click"
            onClick={handlePrint}
            className="text-xs gap-1.5"
          >
            <Printer className="h-3.5 w-3.5" />
            Imprimir Factura
          </Button>
        </div>
      </div>

      {/* Printable Invoice Sheet */}
      <Card className="border-border max-w-4xl mx-auto overflow-hidden bg-card shadow-sm print:shadow-none print:border-none">
        <CardContent className="p-8 sm:p-12 space-y-8">
          {/* Header Strip: Logo & Invoice Number */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-6 border-b border-border">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-heading text-xl font-bold tracking-tight text-foreground">
                  BLAKOR ENTERPRISE SUITE
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-mono">
                Blakor Technologies Inc. • Tax ID: US-EIN-98412099
              </p>
              <p className="text-xs text-muted-foreground">
                1108 Clair Street, Woods Hole, MA 02543, USA
              </p>
            </div>

            <div className="text-left sm:text-right space-y-1">
              <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground block">
                Comprobante Oficial
              </span>
              <h2 className="font-mono text-2xl font-bold text-foreground">
                {invoice.invoiceNumber}
              </h2>
              <div className="flex sm:justify-end mt-1">
                <Badge
                  variant={
                    invoice.status === 'Paid'
                      ? 'success'
                      : invoice.status === 'Pending'
                      ? 'warning'
                      : invoice.status === 'Overdue'
                      ? 'destructive'
                      : 'secondary'
                  }
                  className="font-mono text-xs uppercase"
                >
                  {invoice.status === 'Paid'
                    ? 'Pagada'
                    : invoice.status === 'Pending'
                    ? 'Pendiente de Pago'
                    : invoice.status === 'Overdue'
                    ? 'Vencida'
                    : 'Borrador'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Bill From / Bill To Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-xs">
            {/* Bill To */}
            <div className="space-y-1.5">
              <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                Facturado A (Destinatario)
              </span>
              <h3 className="text-sm font-bold text-foreground">{invoice.client.company}</h3>
              <p className="text-muted-foreground font-medium">{invoice.client.name}</p>
              <p className="text-muted-foreground">{invoice.client.address}</p>
              <p className="font-mono text-foreground font-semibold">NIT / Tax ID: {invoice.client.taxId}</p>
              <p className="font-mono text-muted-foreground">{invoice.client.email}</p>
            </div>

            {/* Dates & Payment Details */}
            <div className="space-y-2 sm:text-right">
              <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                Detalles de Liquidación
              </span>
              <div className="space-y-1">
                <div className="flex sm:justify-end gap-2 text-muted-foreground">
                  <span>Fecha de Emisión:</span>
                  <span className="font-mono text-foreground font-semibold tabular-nums">{invoice.issueDate}</span>
                </div>
                <div className="flex sm:justify-end gap-2 text-muted-foreground">
                  <span>Fecha de Vencimiento:</span>
                  <span className="font-mono text-foreground font-semibold tabular-nums">{invoice.dueDate}</span>
                </div>
                <div className="flex sm:justify-end gap-2 text-muted-foreground">
                  <span>Método de Pago:</span>
                  <span className="text-foreground font-medium">{invoice.paymentMethod || 'Transferencia Bancaria'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Itemized Table */}
          <div className="pt-2">
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-xs text-left">
                <thead className="bg-secondary/40 border-b border-border text-muted-foreground font-mono text-[11px]">
                  <tr>
                    <th className="py-2.5 px-4 font-medium w-12 text-center">#</th>
                    <th className="py-2.5 px-4 font-medium">Concepto / Descripción del Servicio</th>
                    <th className="py-2.5 px-4 font-medium text-right w-24">Cantidad</th>
                    <th className="py-2.5 px-4 font-medium text-right w-32">Precio Unit.</th>
                    <th className="py-2.5 px-4 font-medium text-right w-32">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {invoice.items.map((it, idx) => (
                    <tr key={it.id || idx}>
                      <td className="py-3 px-4 text-center font-mono text-muted-foreground">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4 font-medium text-foreground">
                        {it.description}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-foreground">
                        {it.quantity}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-muted-foreground">
                        ${it.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold tabular-nums text-foreground">
                        ${it.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Grid: Banking Instructions (Left) + Totals Breakdown (Right) */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-8 items-start pt-4 border-t border-border">
            {/* Banking Details & QR Code (7 cols) */}
            <div className="sm:col-span-7 space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-secondary/30 border border-border space-y-2">
                <span className="font-mono text-[10px] uppercase font-bold text-foreground tracking-wider block">
                  Instrucciones de Transferencia Directa
                </span>
                <div className="space-y-1 text-[11px] text-muted-foreground font-mono">
                  <div>Banco: Silicon Valley Bank / First Republic</div>
                  <div>Titular: Blakor Technologies Inc.</div>
                  <div>Número de Cuenta: 9812-4412-8809</div>
                  <div>Código SWIFT / BIC: SVBKUS6S</div>
                </div>
              </div>

              {invoice.notes && (
                <div className="text-[11px] text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground block mb-0.5">Notas & Observaciones:</span>
                  {invoice.notes}
                </div>
              )}
            </div>

            {/* Totals Table (5 cols) */}
            <div className="sm:col-span-5 space-y-2 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal Neto:</span>
                <span className="font-mono text-foreground font-semibold tabular-nums">
                  ${invoice.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {invoice.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-500 font-medium">
                  <span>Descuento Aplicado:</span>
                  <span className="font-mono tabular-nums">
                    -${invoice.discountAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-muted-foreground">
                <span>Impuesto IVA / VAT:</span>
                <span className="font-mono text-foreground tabular-nums">
                  +${invoice.taxAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="pt-3 border-t border-border flex justify-between items-baseline text-sm font-bold text-foreground">
                <span>Total Facturado:</span>
                <span className="font-mono text-xl text-primary tabular-nums">
                  ${invoice.total.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                </span>
              </div>

              <div className="text-[10px] text-muted-foreground text-right font-mono pt-1">
                Validez legal conforme a normativa digital
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
