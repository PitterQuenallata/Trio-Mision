import React from 'react';
import {
  X,
  Sliders,
  Sun,
  Moon,
  Laptop,
  Volume2,
  VolumeX,
  Smartphone,
  PanelLeftClose,
  PanelLeft,
  Navigation,
  PlusCircle,
  Maximize2,
  Minimize2,
  Sparkles,
  Type,
  Check,
} from 'lucide-react';
import {
  useLayout,
  NavigationPreset,
  AccentColor,
  ContainerWidth,
  TYPOGRAPHY_OPTIONS,
} from '../../context/layout-context';
import { useTheme } from '../../context/theme-context';
import { useSound } from '../../context/sound-context';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { cn } from '../../lib/utils';

export const LayoutCustomizer: React.FC = () => {
  const {
    preset,
    setPreset,
    accent,
    setAccent,
    containerWidth,
    setContainerWidth,
    glassMode,
    toggleGlassMode,
    typography,
    setTypography,
    isCustomizerOpen,
    setIsCustomizerOpen,
  } = useLayout();

  const { theme, setTheme, toggleTheme, resolvedTheme } = useTheme();
  const { soundEnabled, toggleSound, volume, setVolume, play } = useSound();

  if (!isCustomizerOpen) return null;

  const presets: { id: NavigationPreset; label: string; desc: string; icon: React.ComponentType<{ className?: string }> }[] = [
    {
      id: 'bottom-dock',
      label: '1. macOS Dock (Magnificación)',
      desc: 'Dock flotante de cristal con efecto de proximidad tipo Mac y accesos directos',
      icon: Smartphone,
    },
    {
      id: 'top-navbar',
      label: '2. Top Navbar Horizontal',
      desc: 'Barra horizontal de cabecera con acceso al sidebar lateral',
      icon: Navigation,
    },
    {
      id: 'left-sidebar',
      label: '3. Sidebar Clásico',
      desc: 'Barra lateral persistente con categorías, perfil y seguridad',
      icon: PanelLeft,
    },
    {
      id: 'left-mini',
      label: '4. Mini Sidebar',
      desc: 'Franja compacta con iconos agrupados, tooltips y perfil',
      icon: PanelLeftClose,
    },
    {
      id: 'floating-drawer',
      label: '5. Floating Drawer Modal',
      desc: 'Menú modal flotante categorizado con tarjeta de usuario',
      icon: Sliders,
    },
    {
      id: 'action-fab',
      label: '6. Action FAB Flotante',
      desc: 'Speed dial flotante para abrir sidebar y operaciones rápidas',
      icon: PlusCircle,
    },
  ];

  const accents: { id: AccentColor; label: string; bg: string }[] = [
    { id: 'orange', label: 'Naranja Blakor', bg: 'bg-[#F97316]' },
    { id: 'emerald', label: 'Esmeralda', bg: 'bg-[#10B981]' },
    { id: 'violet', label: 'Violeta', bg: 'bg-[#8B5CF6]' },
    { id: 'blue', label: 'Azul Real', bg: 'bg-[#3B82F6]' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in"
        onClick={() => {
          play('click');
          setIsCustomizerOpen(false);
        }}
      />

      {/* Drawer Container */}
      <div className="relative w-full max-w-sm border-l border-border/80 bg-card/95 backdrop-blur-2xl p-6 shadow-lg flex flex-col z-50 animate-in slide-in-from-right duration-250">
        <div className="flex items-center justify-between pb-4 border-b border-border/60">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Blakor Shell Customizer</h3>
          </div>
          <Button
            variant="ghost"
            size="iconSm"
            onClick={() => {
              play('click');
              setIsCustomizerOpen(false);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto py-5 space-y-6">
          {/* Navigation Presets */}
          <div className="space-y-3">
            <span className="text-xs font-semibold text-foreground tracking-wide">
              Modo de Navegación (6 Presets)
            </span>
            <div className="grid grid-cols-1 gap-2">
              {presets.map((p) => {
                const Icon = p.icon;
                const isSelected = preset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      play('tab');
                      setPreset(p.id);
                    }}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-2xl border text-left transition-all cursor-pointer',
                      isSelected
                        ? 'border-primary bg-primary/10 shadow-sm'
                        : 'border-border/60 hover:border-border hover:bg-muted/40'
                    )}
                  >
                    <div
                      className={cn(
                        'h-8 w-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className={cn('text-xs font-semibold', isSelected && 'text-primary')}>
                        {p.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground leading-snug">
                        {p.desc}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Theme Switcher */}
          <div className="space-y-3">
            <span className="text-xs font-semibold text-foreground tracking-wide">
              Apariencia (View Transitions API)
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={(e) => {
                  play('switch');
                  if (resolvedTheme !== 'dark') toggleTheme(e);
                  setTheme('dark');
                }}
                className={cn(
                  'flex flex-col items-center gap-1.5 p-3 rounded-2xl border text-xs font-medium transition-all',
                  theme === 'dark'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border/60 text-muted-foreground hover:bg-muted/40'
                )}
              >
                <Moon className="h-4 w-4" />
                <span>Oscuro</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  play('switch');
                  if (resolvedTheme !== 'light') toggleTheme(e);
                  setTheme('light');
                }}
                className={cn(
                  'flex flex-col items-center gap-1.5 p-3 rounded-2xl border text-xs font-medium transition-all',
                  theme === 'light'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border/60 text-muted-foreground hover:bg-muted/40'
                )}
              >
                <Sun className="h-4 w-4" />
                <span>Claro</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  play('switch');
                  setTheme('system');
                }}
                className={cn(
                  'flex flex-col items-center gap-1.5 p-3 rounded-2xl border text-xs font-medium transition-all',
                  theme === 'system'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border/60 text-muted-foreground hover:bg-muted/40'
                )}
              >
                <Laptop className="h-4 w-4" />
                <span>Sistema</span>
              </button>
            </div>
          </div>

          {/* Liquid Glass Mode */}
          <div className={cn(
            'p-4 rounded-2xl border transition-all',
            glassMode
              ? 'bg-primary/5 border-primary/30 shadow-xs'
              : 'bg-muted/30 border-border/50'
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={cn(
                  'h-8 w-8 rounded-xl flex items-center justify-center transition-colors',
                  glassMode ? 'bg-primary text-white shadow-xs' : 'bg-muted text-muted-foreground'
                )}>
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold text-foreground">Modo Liquid Glass</p>
                    {glassMode && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                        Activo
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Refracción óptica y bisel de luz en navbar y dock
                  </p>
                </div>
              </div>
              <Switch
                checked={glassMode}
                onCheckedChange={() => {
                  play('toggle');
                  toggleGlassMode();
                }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground/80 mt-2.5 pt-2 border-t border-border/40 leading-relaxed">
              Sustituye las sombras planas por desenfoque dinámico (24px blur), saturación vibrante y bordes de cristal con transparencia alfa.
            </p>
          </div>

          {/* Audio Feedback (cuelume) */}
          <div className="space-y-3 p-4 rounded-2xl bg-muted/30 border border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {soundEnabled ? (
                  <Volume2 className="h-4 w-4 text-primary" />
                ) : (
                  <VolumeX className="h-4 w-4 text-muted-foreground" />
                )}
                <div>
                  <p className="text-xs font-semibold">Sonido de Interacción</p>
                  <p className="text-[11px] text-muted-foreground">Feedback táctil tipo Apple</p>
                </div>
              </div>
              <Switch checked={soundEnabled} onCheckedChange={toggleSound} />
            </div>

            {soundEnabled && (
              <div className="pt-2 space-y-1">
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Volumen</span>
                  <span className="font-mono tabular-nums">{Math.round(volume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="0.8"
                  step="0.05"
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-full accent-primary h-1.5 bg-muted rounded-lg cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Accent Color */}
          <div className="space-y-3">
            <span className="text-xs font-semibold text-foreground tracking-wide">
              Color de Acento Blakor
            </span>
            <div className="grid grid-cols-4 gap-2">
              {accents.map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => {
                    play('pop');
                    setAccent(acc.id);
                  }}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-2 rounded-2xl border transition-all',
                    accent === acc.id
                      ? 'border-primary ring-2 ring-primary/20 bg-muted/40'
                      : 'border-border/60 hover:bg-muted/30'
                  )}
                >
                  <div className={cn('h-5 w-5 rounded-full shadow-sm', acc.bg)} />
                  <span className="text-[10px] text-muted-foreground">{acc.label.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Typography Engine (5 Stacks) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Type className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold text-foreground tracking-wide">
                  Tipografía del Sistema (5 Familias)
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                Apple HIG
              </span>
            </div>

            <div className="space-y-2">
              {TYPOGRAPHY_OPTIONS.map((font) => {
                const isSelected = typography === font.id;

                return (
                  <button
                    key={font.id}
                    type="button"
                    onClick={() => {
                      play('pop');
                      setTypography(font.id);
                    }}
                    className={cn(
                      'w-full text-left p-3 rounded-2xl border transition-all flex items-start gap-3 cursor-pointer group',
                      isSelected
                        ? 'border-primary ring-2 ring-primary/20 bg-primary/5 shadow-xs'
                        : 'border-border/60 hover:bg-muted/40 hover:border-border'
                    )}
                  >
                    <div
                      className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border transition-colors',
                        isSelected
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : 'border-border/60 bg-muted/50 text-muted-foreground group-hover:text-foreground'
                      )}
                      style={{ fontFamily: font.sans }}
                    >
                      {font.preview}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={cn(
                            'text-xs font-semibold tracking-tight truncate',
                            isSelected ? 'text-primary' : 'text-foreground'
                          )}
                          style={{ fontFamily: font.sans }}
                        >
                          {font.label}
                        </span>
                        {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                      </div>

                      <p className="text-[10px] font-mono text-muted-foreground mt-0.5 uppercase tracking-wider">
                        {font.category}
                      </p>
                      <p className="text-[11px] text-muted-foreground/90 mt-1 leading-snug">
                        {font.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Container Width */}
          <div className="space-y-3">
            <span className="text-xs font-semibold text-foreground tracking-wide">
              Ancho de Contenedor
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  play('tab');
                  setContainerWidth('fluid');
                }}
                className={cn(
                  'flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition-all',
                  containerWidth === 'fluid'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border/60 text-muted-foreground hover:bg-muted/40'
                )}
              >
                <Maximize2 className="h-3.5 w-3.5" />
                Fluido (100%)
              </button>
              <button
                type="button"
                onClick={() => {
                  play('tab');
                  setContainerWidth('boxed');
                }}
                className={cn(
                  'flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition-all',
                  containerWidth === 'boxed'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border/60 text-muted-foreground hover:bg-muted/40'
                )}
              >
                <Minimize2 className="h-3.5 w-3.5" />
                Caja (1440px)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
