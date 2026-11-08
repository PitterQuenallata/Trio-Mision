import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Check,
  ArrowLeft,
  FileText,
  Calculator,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../shared/components/ui/card';
import { Button } from '../../../shared/components/ui/button';
import { Input } from '../../../shared/components/ui/input';
import { Invoice, InvoiceItem, ClientEntity } from '../types/pagos.types';
import { initialClients } from '../data/pagos-data';
import { useSound } from '../../../shared/context/sound-context';
import { pillToast } from '../../../shared/components/ui/pill-toast';
import { cn } from '../../../shared/lib/utils';

interface PagosCreateTabProps {
  onCreateInvoice: (invoice: Invoice) => void;
  onCancel: () => void;
}

export const PagosCreateTab: React.FC<PagosCreateTabProps> = ({
  onCreateInvoice,
  onCancel,
}) => {
  const { play } = useSound();

  // Invoice Meta
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-2026-${Math.floor(100 + Math.random() * 900)}`);
  const [issueDate, setIssueDate] = useState('28 Oct 2026');
  const [dueDate, setDueDate] = useState('11 Nov 2026');
  const [selectedClientId, setSelectedClientId] = useState<string>(initialClients[0].id);

  // Custom client fallback fields
  const selectedClient = initialClients.find((c) => c.id === selectedClientId) || initialClients[0];

  // Dynamic Item Lines
  const [items, setItems] = useState<InvoiceItem[]>([
    {
      id: 'it-1',
      description: 'Suscripción Licencia Enterprise - 50 Asientos',
      quantity: 1,
      unitPrice: 1990.0,
      taxRate: 16,
      total: 1990.0,
    },
    {
      id: 'it-2',
      description: 'Consultoría de Arquitectura de Sistemas y Optimización de Latencia',
      quantity: 5,
      unitPrice: 150.0,
      taxRate: 16,
      total: 750.0,
    },
  ]);

  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [notes, setNotes] = useState(
    'Pago a 15 días netos. Transferencias bancarias directas deben incluir el número de factura como referencia contable.'
  );

  // Calculations
  const subtotal = items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0);
  const taxRateAvg = 16;
  const taxAmount = (subtotal - discountAmount) * (taxRateAvg / 100);
  const total = Math.max(0, subtotal - discountAmount + taxAmount);

  // Add Row
  const handleAddItem = () => {
    play('pop');
    const newItem: InvoiceItem = {
      id: `it-${Date.now()}`,
      description: 'Nuevo Servicio / Producto Técnico',
      quantity: 1,
      unitPrice: 100.0,
      taxRate: 16,
      total: 100.0,
    };
    setItems([...items, newItem]);
  };

  // Remove Row
  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) {
      play('alert');
      pillToast.error('Mínimo Requerido', 'La factura debe contener al menos una línea de cobro.');
      return;
    }
    play('click');
    setItems(items.filter((it) => it.id !== id));
  };

  // Update Row
  const handleUpdateItem = <K extends keyof InvoiceItem>(id: string, field: K, value: InvoiceItem[K]) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id === id) {
          const updated = { ...it, [field]: value };
          if (field === 'quantity' || field === 'unitPrice') {
            updated.total = Number(updated.quantity) * Number(updated.unitPrice);
          }
          return updated;
        }
        return it;
      })
    );
  };

  // Form Submit
  const handleSubmit = (status: 'Paid' | 'Pending' | 'Draft') => {
    if (!invoiceNumber.trim()) {
      play('alert');
      pillToast.error('Número de Factura Obligatorio', 'Introduce un código correlativo válido.');
      return;
    }

    const newInvoice: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber,
      client: selectedClient,
      issueDate,
      dueDate,
      status,
      items,
      subtotal,
      taxAmount,
      discountAmount,
      total,
      notes,
      paymentMethod: status === 'Paid' ? 'Stripe Corporate Card' : 'Transferencia Bancaria Pendiente',
    };

    play('success');
    onCreateInvoice(newInvoice);
    pillToast.success(
      status === 'Draft' ? 'Borrador Guardado' : 'Factura Generada con Éxito',
      `Comprobante ${invoiceNumber} creado para ${selectedClient.company}.`
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Cancel Button */}
      <div className="flex items-center justify-between pb-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          soundType="click"
          onClick={() => {
            play('click');
            onCancel();
          }}
          className="text-xs gap-1.5 -ml-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Cancelar y Volver al Listado
        </Button>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            soundType="click"
            onClick={() => handleSubmit('Draft')}
            className="text-xs"
          >
            Guardar Borrador
          </Button>

          <Button
            type="button"
            variant="default"
            size="sm"
            soundType="success"
            onClick={() => handleSubmit('Pending')}
            className="text-xs gap-1.5"
          >
            <Check className="h-3.5 w-3.5" />
            Emitir Factura Oficial
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): Metadata & Itemized Table */}
        <div className="lg:col-span-8 space-y-6">
          {/* General Metadata Card */}
          <Card className="border-border">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-semibold">Parámetros de Emisión Fiscal</CardTitle>
              <CardDescription className="text-xs">
                Numeración correlativa, fechas de liquidación y destinatario
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="font-medium text-foreground block mb-1.5">Número de Factura *</label>
                  <Input
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="text-xs font-mono font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="font-medium text-foreground block mb-1.5">Fecha de Emisión</label>
                  <Input
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="font-medium text-foreground block mb-1.5">Fecha de Vencimiento</label>
                  <Input
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="text-xs font-mono"
                  />
                </div>
              </div>

              {/* Client Selector */}
              <div className="pt-2">
                <label className="font-medium text-foreground block mb-1.5">Seleccionar Cliente / Razón Social *</label>
                <select
                  value={selectedClientId}
                  onChange={(e) => {
                    play('click');
                    setSelectedClientId(e.target.value);
                  }}
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-medium text-foreground cursor-pointer focus:outline-hidden"
                >
                  {initialClients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company} ({c.name} - {c.taxId})
                    </option>
                  ))}
                </select>
              </div>

              {/* Client Details Preview Pill */}
              <div className="p-3.5 rounded-xl bg-secondary/30 border border-border space-y-1 text-[11px] text-muted-foreground">
                <div className="flex justify-between text-foreground font-medium">
                  <span>{selectedClient.name} • {selectedClient.email}</span>
                  <span className="font-mono">{selectedClient.taxId}</span>
                </div>
                <div>{selectedClient.address}</div>
                <div className="font-mono">{selectedClient.phone}</div>
              </div>
            </CardContent>
          </Card>

          {/* Line Items Dynamic Table Card */}
          <Card className="border-border">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">Conceptos & Desglose de Servicios</CardTitle>
                  <CardDescription className="text-xs">
                    Agrega los ítems que conformarán el total a facturar
                  </CardDescription>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  soundType="pop"
                  onClick={handleAddItem}
                  className="text-xs gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Añadir Línea
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-secondary/40 border-b border-border text-muted-foreground font-mono text-[11px]">
                    <tr>
                      <th className="py-2.5 px-4 font-medium">Descripción del Concepto</th>
                      <th className="py-2.5 px-3 font-medium text-right w-24">Cantidad</th>
                      <th className="py-2.5 px-3 font-medium text-right w-32">Precio Unit. ($)</th>
                      <th className="py-2.5 px-4 font-medium text-right w-32">Total ($)</th>
                      <th className="py-2.5 px-3 font-medium text-center w-14"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {items.map((it) => (
                      <tr key={it.id}>
                        <td className="py-2.5 px-4">
                          <Input
                            value={it.description}
                            onChange={(e) => handleUpdateItem(it.id, 'description', e.target.value)}
                            placeholder="Nombre del servicio o producto..."
                            className="text-xs h-8"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <Input
                            type="number"
                            min="1"
                            value={it.quantity}
                            onChange={(e) =>
                              handleUpdateItem(it.id, 'quantity', Math.max(1, Number(e.target.value)))
                            }
                            className="text-xs font-mono text-right h-8"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={it.unitPrice}
                            onChange={(e) =>
                              handleUpdateItem(it.id, 'unitPrice', Math.max(0, Number(e.target.value)))
                            }
                            className="text-xs font-mono text-right h-8"
                          />
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-foreground tabular-nums">
                          ${it.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(it.id)}
                            className="p-1 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 cursor-pointer transition-colors"
                            title="Eliminar fila"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Payment Terms & Notes Card */}
          <Card className="border-border">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-semibold">Términos Comerciales & Instrucciones Bancarias</CardTitle>
            </CardHeader>
            <CardContent className="p-5 text-xs">
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-3 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-hidden leading-relaxed resize-none font-mono"
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Column (4 cols): Financial Calculations Summary */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="border-border sticky top-24">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-semibold">Cálculo de Liquidación</CardTitle>
              <CardDescription className="text-xs">Moneda oficial USD (Dólares Americanos)</CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-xs">
              <div className="space-y-2.5">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal Bruto</span>
                  <span className="font-mono text-foreground font-semibold tabular-nums">
                    ${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Descuento ($)</span>
                  <Input
                    type="number"
                    min="0"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(Math.max(0, Number(e.target.value)))}
                    className="w-24 text-xs font-mono text-right h-7"
                  />
                </div>

                <div className="flex justify-between text-muted-foreground">
                  <span>Impuesto IVA / VAT (16%)</span>
                  <span className="font-mono text-foreground tabular-nums">
                    +${taxAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="pt-3 border-t border-border/50 flex justify-between text-sm font-bold text-foreground">
                  <span>Total a Pagar</span>
                  <span className="font-mono text-lg text-primary tabular-nums">
                    ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-border/50 space-y-2.5">
                <Button
                  type="button"
                  variant="default"
                  soundType="success"
                  onClick={() => handleSubmit('Pending')}
                  className="w-full text-xs h-10 gap-2 justify-center"
                >
                  <Check className="h-4 w-4" />
                  Emitir y Notificar Cliente
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  soundType="click"
                  onClick={() => handleSubmit('Draft')}
                  className="w-full text-xs h-9 justify-center"
                >
                  Guardar como Borrador
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
