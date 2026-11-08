import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  X,
  ArrowRight,
  User,
  Shield,
  Sliders,
  Sun,
  Moon,
  Laptop,
  Sparkles,
  Volume2,
  VolumeX,
  Truck,
  Activity,
  Package,
  Layers,
  Check,
  Command as CommandIcon,
  CornerDownLeft,
  Keyboard,
  BookOpen,
} from 'lucide-react';
import { navItems } from '../../lib/navigation';
import { useSound } from '../../context/sound-context';
import { useTheme } from '../../context/theme-context';
import { useLayout, NavigationPreset } from '../../context/layout-context';
import { cn } from '../../lib/utils';

interface CommandSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
  onOpenShortcuts?: () => void;
}

interface CommandAction {
  id: string;
  title: string;
  subtitle?: string;
  category: 'Acciones' | 'Navegación' | 'Sistema' | 'Comercio';
  shortcut?: string;
  icon: React.ComponentType<{ className?: string }>;
  perform: () => void;
}

export const CommandSearchModal: React.FC<CommandSearchModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onOpenShortcuts,
}) => {
  const { play } = useSound();
  const { theme, setTheme } = useTheme();
  const {
    glassMode,
    toggleGlassMode,
    preset,
    setPreset,
    setIsCustomizerOpen,
  } = useLayout();
  const { soundEnabled, toggleSound } = useSound();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setActiveCategory('all');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Construct comprehensive command palette list
  const allCommands = useMemo<CommandAction[]>(() => {
    const list: CommandAction[] = [
      // System & Appearance Actions
      {
        id: 'toggle-dark',
        title: 'Cambiar a Modo Oscuro',
        subtitle: 'Activar paleta de negros profundos Apple Dark',
        category: 'Sistema',
        shortcut: '⌘⇧D',
        icon: Moon,
        perform: () => {
          setTheme('dark');
          onClose();
        },
      },
      {
        id: 'toggle-light',
        title: 'Cambiar a Modo Claro',
        subtitle: 'Activar paleta luminosa Apple Light',
        category: 'Sistema',
        shortcut: '⌘⇧L',
        icon: Sun,
        perform: () => {
          setTheme('light');
          onClose();
        },
      },
      {
        id: 'toggle-glass',
        title: glassMode ? 'Desactivar Modo Liquid Glass' : 'Activar Modo Liquid Glass',
        subtitle: 'Refracción óptica de desenfoque dinámico y bisel de luz',
        category: 'Sistema',
        icon: Sparkles,
        perform: () => {
          toggleGlassMode();
          onClose();
        },
      },
      {
        id: 'toggle-sound',
        title: soundEnabled ? 'Silenciar Efectos de Sonido' : 'Activar Efectos de Sonido Hápticos',
        subtitle: 'Feedback acústico tipo Apple al interactuar',
        category: 'Sistema',
        icon: soundEnabled ? VolumeX : Volume2,
        perform: () => {
          toggleSound();
          onClose();
        },
      },
      {
        id: 'open-customizer',
        title: 'Abrir Personalizador de Tema & Layout',
        subtitle: 'Ajustar 5 tipografías, colores de acento y anchura',
        category: 'Sistema',
        shortcut: '⌘,',
        icon: Sliders,
        perform: () => {
          setIsCustomizerOpen(true);
          onClose();
        },
      },
      {
        id: 'open-shortcuts',
        title: 'Centro de Atajos & Guía Rápida del Kit',
        subtitle: 'Ver combinaciones de teclado y buenas prácticas de la plantilla',
        category: 'Sistema',
        shortcut: '⌘/',
        icon: Keyboard,
        perform: () => {
          onClose();
          onOpenShortcuts?.();
        },
      },
      {
        id: 'open-docs',
        title: 'Documentación Oficial & Manual de Usuario',
        subtitle: 'Guías de arquitectura, 5 fuentes, Sileo y manual operativo',
        category: 'Sistema',
        icon: BookOpen,
        perform: () => {
          onClose();
          onNavigate('/documentacion');
        },
      },
      // Quick Navigation Presets
      {
        id: 'preset-dock',
        title: 'Disposición: macOS Bottom Dock',
        subtitle: 'Barra inferior flotante con magnificación de resortes',
        category: 'Sistema',
        icon: Layers,
        perform: () => {
          setPreset('bottom-dock');
          onClose();
        },
      },
      {
        id: 'preset-sidebar',
        title: 'Disposición: Sidebar Clásico Persistente',
        subtitle: 'Barra lateral izquierda completa con navegación jerárquica',
        category: 'Sistema',
        icon: Layers,
        perform: () => {
          setPreset('left-sidebar');
          onClose();
        },
      },
      // Commerce & Logistics Direct Actions
      {
        id: 'track-orders',
        title: 'Seguimiento de Envíos en Vivo (Delivery Progress)',
        subtitle: 'Trazabilidad interactiva de paquetería y estados de orden',
        category: 'Comercio',
        icon: Truck,
        perform: () => {
          onNavigate('/ecommerce');
          onClose();
        },
      },
      {
        id: 'interactive-logs',
        title: 'Consola de Observabilidad & Logs Interactivos',
        subtitle: 'Filtros animados, búsqueda en tiempo real y diagnóstico JSON',
        category: 'Acciones',
        icon: Activity,
        perform: () => {
          onNavigate('/auditoria');
          onClose();
        },
      },
      {
        id: 'user-profile',
        title: 'Mi Perfil de Administrador',
        subtitle: 'Credenciales, rol de seguridad y actividad reciente',
        category: 'Acciones',
        icon: User,
        perform: () => {
          onNavigate('/usuarios?tab=profile');
          onClose();
        },
      },
      {
        id: 'security-2fa',
        title: 'Seguridad del Sistema & 2FA',
        subtitle: 'Autenticación de dos factores, tokens y permisos IAM',
        category: 'Acciones',
        icon: Shield,
        perform: () => {
          onNavigate('/configuracion?tab=seguridad');
          onClose();
        },
      },
    ];

    // Append navigation items
    navItems.forEach((nav) => {
      list.push({
        id: `nav-${nav.id}`,
        title: nav.title,
        subtitle: `Ir a módulo ${nav.path}`,
        category: 'Navegación',
        icon: nav.icon,
        perform: () => {
          onNavigate(nav.path);
          onClose();
        },
      });
    });

    return list;
  }, [glassMode, soundEnabled, toggleGlassMode, toggleSound, setTheme, setPreset, setIsCustomizerOpen, onNavigate, onClose]);

  // Filter commands
  const filteredCommands = useMemo(() => {
    return allCommands.filter((cmd) => {
      const matchCategory =
        activeCategory === 'all' ||
        (activeCategory === 'system' && cmd.category === 'Sistema') ||
        (activeCategory === 'nav' && cmd.category === 'Navegación') ||
        (activeCategory === 'actions' && (cmd.category === 'Acciones' || cmd.category === 'Comercio'));

      const q = query.toLowerCase().trim();
      const matchQuery =
        q === '' ||
        cmd.title.toLowerCase().includes(q) ||
        (cmd.subtitle && cmd.subtitle.toLowerCase().includes(q)) ||
        cmd.category.toLowerCase().includes(q);

      return matchCategory && matchQuery;
    });
  }, [allCommands, activeCategory, query]);

  // Keep selection within bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, activeCategory]);

  // Keyboard controls: Arrow Up, Arrow Down, Enter, Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev <= 0 ? Math.max(0, filteredCommands.length - 1) : prev - 1
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          play('click');
          filteredCommands[selectedIndex].perform();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        play('click');
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, play, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
        onClick={() => {
          play('click');
          onClose();
        }}
      />

      {/* Raycast / Spotlight Style Surface */}
      <div className="relative w-full max-w-2xl rounded-2xl border border-white/20 dark:border-white/10 bg-card/95 dark:bg-[#1C1C1E]/95 backdrop-blur-3xl shadow-2xl overflow-hidden z-50 flex flex-col text-foreground animate-in zoom-in-95 duration-150">
        {/* Search Header */}
        <div className="flex items-center px-4 py-3.5 border-b border-border/50 gap-3">
          <Search className="h-5 w-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Escribe una acción, módulo o comando rápido de sistema..."
            className="w-full bg-transparent text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-medium border border-border/80 bg-muted/60 text-muted-foreground">
            ESC
          </span>
        </div>

        {/* Quick Filter Category Pills */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border/30 bg-muted/20 overflow-x-auto">
          {[
            { id: 'all', label: 'Todo' },
            { id: 'system', label: 'Sistema & Tema' },
            { id: 'actions', label: 'Acciones Rápidas' },
            { id: 'nav', label: 'Navegación' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                play('tab');
                setActiveCategory(cat.id);
              }}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-medium transition-all shrink-0 select-none cursor-pointer',
                activeCategory === cat.id
                  ? 'bg-foreground text-background font-semibold shadow-2xs'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          className="max-h-[360px] overflow-y-auto p-2 space-y-1 divide-y divide-transparent select-none"
        >
          {filteredCommands.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <CommandIcon className="h-8 w-8 text-muted-foreground/50 mx-auto" />
              <p className="text-sm font-medium text-foreground">
                No se encontraron comandos
              </p>
              <p className="text-xs text-muted-foreground">
                No hay resultados para "{query}". Prueba buscando "tema", "logs", "pedidos" o "perfil".
              </p>
            </div>
          ) : (
            filteredCommands.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;

              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => {
                    play('click');
                    item.perform();
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left transition-all cursor-pointer group',
                    isSelected
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'hover:bg-muted/50 text-foreground'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        'h-8 w-8 rounded-xl flex items-center justify-center shrink-0 transition-colors border',
                        isSelected
                          ? 'bg-primary-foreground/15 border-primary-foreground/20 text-primary-foreground'
                          : 'bg-muted/60 border-border/60 text-muted-foreground group-hover:text-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={cn('text-xs sm:text-sm font-semibold truncate', isSelected ? 'text-primary-foreground' : 'text-foreground')}>
                          {item.title}
                        </p>
                        <span
                          className={cn(
                            'text-[10px] font-mono px-1.5 py-0.2 rounded-md uppercase tracking-wider',
                            isSelected
                              ? 'bg-primary-foreground/20 text-primary-foreground'
                              : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {item.category}
                        </span>
                      </div>
                      {item.subtitle && (
                        <p
                          className={cn(
                            'text-[11px] truncate mt-0.5',
                            isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'
                          )}
                        >
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {item.shortcut && (
                      <span
                        className={cn(
                          'hidden sm:inline-block font-mono text-[10px] px-1.5 py-0.5 rounded border',
                          isSelected
                            ? 'border-primary-foreground/30 text-primary-foreground'
                            : 'border-border bg-muted/40 text-muted-foreground'
                        )}
                      >
                        {item.shortcut}
                      </span>
                    )}
                    <CornerDownLeft
                      className={cn(
                        'h-4 w-4 transition-opacity',
                        isSelected ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer Cheatsheet */}
        <div className="px-4 py-2.5 bg-muted/40 border-t border-border/40 text-[11px] text-muted-foreground flex items-center justify-between font-medium">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 font-mono">
              <span className="px-1.5 py-0.5 rounded bg-background border border-border text-[10px]">↑↓</span>
              Navegar
            </span>
            <span className="flex items-center gap-1 font-mono">
              <span className="px-1.5 py-0.5 rounded bg-background border border-border text-[10px]">↵</span>
              Seleccionar
            </span>
            <span className="flex items-center gap-1 font-mono">
              <span className="px-1.5 py-0.5 rounded bg-background border border-border text-[10px]">Esc</span>
              Cerrar
            </span>
          </div>

          <span className="text-[10px] font-mono hidden sm:inline text-muted-foreground">
            {filteredCommands.length} comandos disponibles
          </span>
        </div>
      </div>
    </div>
  );
};

export default CommandSearchModal;
