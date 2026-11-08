import React, { useState, useMemo } from 'react';
import { Plus, Filter, Search, FileText, History, SlidersHorizontal, Sparkles, Zap } from 'lucide-react';
import { Button } from '../../../shared/components/ui/button';
import { Input } from '../../../shared/components/ui/input';
import { ReportesMetrics } from '../components/reportes-metrics';
import { ReportesGrid } from '../components/reportes-grid';
import { ReportesHistoryTable } from '../components/reportes-history-table';
import { ReportesModal } from '../components/reportes-modal';
import { initialReports, initialReportMetrics, initialReportHistory } from '../data/reportes-data';
import { ReportItem, ReportCategory, GeneratedReportRecord, ReportFormat } from '../types/reportes.types';
import { useSound } from '../../../shared/context/sound-context';
import { pillToast } from '../../../shared/components/ui/pill-toast';
import { cn } from '../../../shared/lib/utils';

export type ReportesSubTab = 'catalogo' | 'historial';

export const ReportesPage: React.FC = () => {
  const { play } = useSound();
  const [activeTab, setActiveTab] = useState<ReportesSubTab>('catalogo');
  const [reports, setReports] = useState<ReportItem[]>(initialReports);
  const [history, setHistory] = useState<GeneratedReportRecord[]>(initialReportHistory);
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filtered reports
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      const matchCat = selectedCategory === 'all' || r.category === selectedCategory;
      const matchSearch =
        r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.format.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [reports, selectedCategory, searchQuery]);

  const categories: { id: ReportCategory; label: string; count: number }[] = [
    { id: 'all', label: 'Todos los Informes', count: reports.length },
    { id: 'financiero', label: 'Financiero', count: reports.filter((r) => r.category === 'financiero').length },
    { id: 'seguridad', label: 'Seguridad & SOC2', count: reports.filter((r) => r.category === 'seguridad').length },
    { id: 'producto', label: 'Producto SaaS', count: reports.filter((r) => r.category === 'producto').length },
    { id: 'operaciones', label: 'Operaciones', count: reports.filter((r) => r.category === 'operaciones').length },
  ];

  const handleOpenModal = () => {
    play('pop');
    setIsModalOpen(true);
  };

  const handleGenerateNewReport = (newRep: {
    title: string;
    category: string;
    format: ReportFormat;
    size: string;
  }) => {
    const newRecord: GeneratedReportRecord = {
      id: `rec-${Date.now()}`,
      reportName: newRep.title,
      category: newRep.category as any,
      format: newRep.format,
      generatedAt: 'Hace un momento',
      requestedBy: 'Mathew Anderson (Admin)',
      size: newRep.size,
      status: 'Completado',
    };
    setHistory([newRecord, ...history]);
  };

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {/* Top Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5 font-mono">
          <span>Principal</span>
          <span>/</span>
          <span className="text-foreground">Centro de Reportes & Analítica</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Centro de Reportes & Analítica
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-3xl leading-relaxed">
              Generación automatizada de informes financieros, telemetría de clúster, auditoría forense SOC2 y métricas de retención SaaS listas para exportación.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                play('click');
                pillToast.info('Automatizaciones Cron', 'Los reportes programados se despachan automáticamente a buckets S3.');
              }}
              className="gap-1.5 text-xs rounded-xl cursor-pointer"
            >
              <Zap className="h-3.5 w-3.5 text-primary" />
              <span>Jobs Cron</span>
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={handleOpenModal}
              className="gap-1.5 text-xs rounded-xl shadow-sm cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Generar Nuevo Reporte</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Top Metric Strip */}
      <ReportesMetrics metrics={initialReportMetrics} />

      {/* Segmented Sub-Tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-secondary/50 border border-border overflow-x-auto">
        <button
          type="button"
          onClick={() => {
            play('tab');
            setActiveTab('catalogo');
          }}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap cursor-pointer',
            activeTab === 'catalogo'
              ? 'bg-card text-foreground shadow-xs font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <FileText className={cn('h-3.5 w-3.5', activeTab === 'catalogo' ? 'text-primary' : 'text-muted-foreground')} />
          <span>Catálogo de Informes & Plantillas</span>
          <span
            className={cn(
              'font-mono text-[10px] px-1.5 py-0.2 rounded-full tabular-nums',
              activeTab === 'catalogo' ? 'bg-primary text-white font-bold' : 'bg-muted text-muted-foreground'
            )}
          >
            {reports.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            play('tab');
            setActiveTab('historial');
          }}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap cursor-pointer',
            activeTab === 'historial'
              ? 'bg-card text-foreground shadow-xs font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <History className={cn('h-3.5 w-3.5', activeTab === 'historial' ? 'text-primary' : 'text-muted-foreground')} />
          <span>Registro de Descargas & Ejecuciones</span>
          <span
            className={cn(
              'font-mono text-[10px] px-1.5 py-0.2 rounded-full tabular-nums',
              activeTab === 'historial' ? 'bg-primary text-white font-bold' : 'bg-muted text-muted-foreground'
            )}
          >
            {history.length}
          </span>
        </button>
      </div>

      {/* TAB 1: CATALOG */}
      {activeTab === 'catalogo' && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-md p-4 space-y-3.5">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Buscar informe por nombre, formato o categoría..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 h-9.5 rounded-xl bg-background/80 border-border/60 text-xs"
                />
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>{filteredReports.length} informes disponibles</span>
              </div>
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      play('pop');
                      setSelectedCategory(cat.id);
                    }}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all select-none cursor-pointer',
                      isSelected
                        ? 'bg-foreground text-background font-semibold shadow-xs'
                        : 'bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <span>{cat.label}</span>
                    <span
                      className={cn(
                        'text-[10px] px-1.5 py-0.2 rounded-full tabular-nums font-semibold',
                        isSelected ? 'bg-background/20 text-background' : 'bg-muted-foreground/15 text-muted-foreground'
                      )}
                    >
                      {cat.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grid */}
          <ReportesGrid reports={filteredReports} />
        </div>
      )}

      {/* TAB 2: HISTORY */}
      {activeTab === 'historial' && (
        <ReportesHistoryTable
          history={history}
          onRefresh={() => {
            play('pop');
            pillToast.success('Bitácora Sincronizada', 'Últimos registros de generación y descargas actualizados.');
          }}
        />
      )}

      {/* Compilation Modal */}
      <ReportesModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onGenerate={handleGenerateNewReport}
      />
    </div>
  );
};

export default ReportesPage;
