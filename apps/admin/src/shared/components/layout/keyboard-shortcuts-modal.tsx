import React, { useState, useEffect } from 'react';
import {
  Keyboard,
  BookOpen,
  X,
  Search,
  Command,
  Sliders,
  Moon,
  Sun,
  Sparkles,
  Volume2,
  TableProperties,
  Truck,
  Activity,
  Layers,
  Check,
  ArrowRight,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useSound } from '../../context/sound-context';
import { cn } from '../../lib/utils';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (path: string) => void;
  onOpenCustomizer?: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
  category: string;
}

const SHORTCUTS: ShortcutItem[] = [
  // Navegación & Búsqueda
  { keys: ['⌘', 'K'], description: 'Abrir Command Palette / Spotlight', category: 'Navegación' },
  { keys: ['⌘', '/'], description: 'Ver Centro de Atajos & Guía del Kit', category: 'Navegación' },
  { keys: ['⌘', ','], description: 'Abrir Personalizador de Tema & Tipografías', category: 'Navegación' },
  { keys: ['⌘', 'B'], description: 'Alternar menú lateral o drawer flotante', category: 'Navegación' },
  { keys: ['Esc'], description: 'Cerrar modales o limpiar selección', category: 'Navegación' },

  // Apariencia & Entorno
  { keys: ['⌘', '⇧', 'D'], description: 'Activar Modo Oscuro (Apple Dark)', category: 'Apariencia' },
  { keys: ['⌘', '⇧', 'L'], description: 'Activar Modo Claro (Apple Light)', category: 'Apariencia' },
  { keys: ['⌘', 'G'], description: 'Alternar Modo Liquid Glass (Refracción Óptica)', category: 'Apariencia' },
  { keys: ['⌘', 'M'], description: 'Alternar sonido háptico de interfaz', category: 'Apariencia' },

  // Tablas & Datos
  { keys: ['⌘', 'E'], description: 'Exportar registros visibles o seleccionados a CSV', category: 'Tablas & Datos' },
  { keys: ['⌘', 'F'], description: 'Enfocar buscador rápido en tablas o logs', category: 'Tablas & Datos' },
  { keys: ['↑', '↓'], description: 'Navegar verticalmente entre filas o comandos', category: 'Tablas & Datos' },
  { keys: ['↵'], description: 'Confirmar selección o ver detalle', category: 'Tablas & Datos' },
];

const GUIDE_PILLARS = [
  {
    id: 'navigation',
    title: '1. Sistema de Navegación Flexible',
    summary: '6 disposiciones intercambiables al vuelo sin recargar la página.',
    bullets: [
      'macOS Bottom Dock con efecto parabólico de resortes.',
      'Sidebar persistente clásico, Mini Sidebar o Top Navbar horizontal.',
      'Command Palette accesible con ⌘K desde cualquier vista.',
    ],
    path: '/dashboard?tour=true',
    actionText: 'Iniciar Recorrido en Dashboard',
  },
  {
    id: 'typography',
    title: '2. 5 Tipografías Ajustables en Tiempo Real',
    summary: 'Arquitectura tipográfica con persistencia instantánea en localStorage.',
    bullets: [
      'SF Pro: Sistema nativo de Apple para máxima nitidez.',
      'Inter Display, Geist Sans, Plus Jakarta Sans y JetBrains Mono.',
      'Cero parpadeo (FOUT) al recargar gracias a inyección previa en el DOM.',
    ],
    actionText: 'Personalizar Tipografía',
    isCustomizer: true,
  },
  {
    id: 'tables',
    title: '3. Tablas de Datos de Alta Densidad (TanStack v8)',
    summary: 'Herramientas de nivel empresarial para analistas y operadores.',
    bullets: [
      'Selector de densidad de fila: Compacta (32px), Normal (44px) y Amplia (56px).',
      'Visibilidad dinámica de columnas con selector emergente.',
      'Barra flotante de acciones por lote al seleccionar múltiples filas.',
    ],
    path: '/tables',
    actionText: 'Explorar Tablas',
  },
  {
    id: 'automations',
    title: '4. Motor de Automatizaciones para Negocios',
    summary: 'Disparadores y acciones en background que ahorran horas de trabajo manual.',
    bullets: [
      'eCommerce: Generación de guías y despacho automático.',
      'Finanzas: Cobranza inteligente de facturas vencidas.',
      'Seguridad: Bloqueo preventivo de accesos ante sospechas de intrusión.',
    ],
    path: '/automatizaciones',
    actionText: 'Ver Automatizaciones',
  },
];

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onOpenCustomizer,
}) => {
  const { play } = useSound();
  const [activeTab, setActiveTab] = useState<'shortcuts' | 'guide'>('shortcuts');
  const [filterQuery, setFilterQuery] = useState('');

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        play('click');
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, play, onClose]);

  if (!isOpen) return null;

  const filteredShortcuts = SHORTCUTS.filter(
    (s) =>
      s.description.toLowerCase().includes(filterQuery.toLowerCase()) ||
      s.category.toLowerCase().includes(filterQuery.toLowerCase()) ||
      s.keys.join('').toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-14 sm:pt-20 px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
        onClick={() => {
          play('click');
          onClose();
        }}
      />

      {/* Modal Surface */}
      <div className="relative w-full max-w-2xl rounded-2xl border border-white/20 dark:border-white/10 bg-card/95 dark:bg-[#1C1C1E]/95 backdrop-blur-3xl shadow-2xl overflow-hidden z-50 flex flex-col text-foreground animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
              <Keyboard className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight text-foreground">
                Centro de Productividad & Guía del Kit
              </h3>
              <p className="text-xs text-muted-foreground">
                Atajos de teclado de alta velocidad y arquitectura de la plantilla
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              play('click');
              onClose();
            }}
            className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-border/40 bg-muted/20 gap-3">
          <div className="inline-flex rounded-xl bg-muted/60 p-1 border border-border/50">
            <button
              type="button"
              onClick={() => {
                play('tab');
                setActiveTab('shortcuts');
              }}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer',
                activeTab === 'shortcuts'
                  ? 'bg-background text-foreground shadow-2xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Keyboard className="h-3.5 w-3.5" />
              <span>Atajos de Teclado</span>
            </button>
            <button
              type="button"
              onClick={() => {
                play('tab');
                setActiveTab('guide');
              }}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer',
                activeTab === 'guide'
                  ? 'bg-background text-foreground shadow-2xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Guía Rápida del Kit</span>
            </button>
          </div>

          {activeTab === 'shortcuts' && (
            <div className="relative w-48 hidden sm:block">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Filtrar atajos..."
                className="w-full h-7.5 pl-8 pr-2.5 rounded-lg border border-border/60 bg-background/50 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}
        </div>

        {/* Tab 1: Shortcuts */}
        {activeTab === 'shortcuts' && (
          <div className="max-h-[380px] overflow-y-auto p-4 sm:p-5 space-y-4">
            {['Navegación', 'Apariencia', 'Tablas & Datos'].map((category) => {
              const categoryItems = filteredShortcuts.filter((s) => s.category === category);
              if (categoryItems.length === 0) return null;

              return (
                <div key={category} className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                    {category}
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {categoryItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm hover:bg-muted/30 transition-colors"
                      >
                        <span className="text-xs text-foreground/90 font-medium truncate mr-2">
                          {item.description}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {item.keys.map((k, kIdx) => (
                            <kbd
                              key={kIdx}
                              className="px-2 py-0.5 rounded-md border border-border/80 bg-muted/80 text-[11px] font-mono font-semibold text-foreground shadow-2xs"
                            >
                              {k}
                            </kbd>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 2: Quick Guide */}
        {activeTab === 'guide' && (
          <div className="max-h-[380px] overflow-y-auto p-4 sm:p-5 space-y-3">
            {GUIDE_PILLARS.map((p) => (
              <div
                key={p.id}
                className="p-3.5 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-foreground tracking-tight">
                      {p.title}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {p.summary}
                    </p>
                  </div>
                  {p.actionText && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        play('click');
                        onClose();
                        if (p.isCustomizer) {
                          onOpenCustomizer?.();
                        } else if (p.path) {
                          onNavigate?.(p.path);
                        }
                      }}
                      className="h-7 text-xs rounded-lg gap-1 shrink-0"
                    >
                      <span>{p.actionText}</span>
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                <ul className="space-y-1 pt-1 border-t border-border/40">
                  {p.bullets.map((b, bIdx) => (
                    <li
                      key={bIdx}
                      className="flex items-start gap-2 text-[11px] text-foreground/80 leading-relaxed"
                    >
                      <Check className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 bg-muted/40 border-t border-border/40 text-xs text-muted-foreground flex items-center justify-between gap-3">
          <Button
            variant="default"
            size="sm"
            onClick={() => {
              play('click');
              onClose();
            }}
            className="h-7 text-xs rounded-lg shrink-0"
          >
            Entendido
          </Button>
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcutsModal;
