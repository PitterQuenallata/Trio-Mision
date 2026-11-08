import React, { useState } from 'react';
import { Modal } from '../../../shared/components/ui/modal';
import { Button } from '../../../shared/components/ui/button';
import { Input } from '../../../shared/components/ui/input';
import { ReportFormat, ReportItem } from '../types/reportes.types';
import { FileText, Download, Check, Sparkles, Calendar, Layers } from 'lucide-react';
import { useSound } from '../../../shared/context/sound-context';
import { pillToast } from '../../../shared/components/ui/pill-toast';
import { cn } from '../../../shared/lib/utils';

interface ReportesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (newReport: { title: string; category: string; format: ReportFormat; size: string }) => void;
}

export const ReportesModal: React.FC<ReportesModalProps> = ({
  isOpen,
  onClose,
  onGenerate,
}) => {
  const { play } = useSound();
  const [reportTitle, setReportTitle] = useState('Consolidado de Actividad Trimestral Q4');
  const [category, setCategory] = useState<'financiero' | 'seguridad' | 'producto' | 'operaciones'>('financiero');
  const [format, setFormat] = useState<ReportFormat>('PDF');
  const [period, setPeriod] = useState('Octubre - Diciembre 2026');
  const [includeForensics, setIncludeForensics] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTitle.trim()) {
      play('alert');
      pillToast.error('Título Obligatorio', 'Ingresa el nombre del informe a compilar.');
      return;
    }

    play('success');
    setIsSubmitting(true);
    pillToast.info('Compilando Informe', 'El clúster está generando el documento con firmas criptográficas...');

    setTimeout(() => {
      setIsSubmitting(false);
      onGenerate({
        title: reportTitle,
        category,
        format,
        size: format === 'JSON' ? '14.2 MB' : format === 'PDF' ? '3.8 MB' : '1.9 MB',
      });
      onClose();
      pillToast.success('Informe Compilado', `El archivo ${reportTitle}.${format.toLowerCase()} está listo para descarga.`);
    }, 1200);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Generador de Informes & Analítica Oficial"
      description="Compila reportes con firma digital, hashes de verificación y desglose analítico en vivo"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="font-semibold text-foreground block mb-1.5">Nombre del Informe</label>
          <Input
            value={reportTitle}
            onChange={(e) => setReportTitle(e.target.value)}
            placeholder="Ej. Auditoría de Liquidaciones Q4"
            className="text-xs"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="font-semibold text-foreground block mb-1.5">Categoría Temática</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full h-9 rounded-xl border border-border bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="financiero">Finanzas & Cobros</option>
              <option value="seguridad">Seguridad & SOC2</option>
              <option value="producto">Producto & SaaS</option>
              <option value="operaciones">Operaciones & Clúster</option>
            </select>
          </div>

          <div>
            <label className="font-semibold text-foreground block mb-1.5">Rango de Fechas / Ciclo</label>
            <Input
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="text-xs font-mono"
            />
          </div>
        </div>

        <div>
          <label className="font-semibold text-foreground block mb-1.5">Formato de Salida</label>
          <div className="grid grid-cols-4 gap-2">
            {(['PDF', 'XLSX', 'CSV', 'JSON'] as ReportFormat[]).map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => {
                  play('click');
                  setFormat(fmt);
                }}
                className={cn(
                  'py-2 px-3 rounded-xl border text-center font-mono font-bold transition-all cursor-pointer',
                  format === fmt
                    ? 'border-primary bg-primary/10 text-primary shadow-xs'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground'
                )}
              >
                {fmt}
              </button>
            ))}
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-secondary/30 border border-border flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="font-semibold text-foreground block">Firmas Criptográficas SHA-256</span>
            <p className="text-muted-foreground text-[11px]">
              Incorpora sellado de tiempo para auditorías legales ISO / SOC2
            </p>
          </div>
          <input
            type="checkbox"
            checked={includeForensics}
            onChange={(e) => setIncludeForensics(e.target.checked)}
            className="h-4 w-4 rounded accent-primary cursor-pointer"
          />
        </div>

        <div className="pt-3 border-t border-border/50 flex items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs rounded-xl cursor-pointer"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="default"
            size="sm"
            disabled={isSubmitting}
            className="text-xs rounded-xl gap-1.5 font-semibold cursor-pointer shadow-sm"
          >
            {isSubmitting ? (
              <span>Generando en clúster...</span>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                <span>Generar y Guardar</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
