import React from 'react';
import {
  Volume2,
  VolumeX,
  Sliders,
  Layers,
  Command,
  LogOut,
  HelpCircle,
  BookOpen,
} from 'lucide-react';
import { MorphIcon } from 'morphicons/react';
import { Sun, Moon, Menu, X } from 'lucide';
import { useIconHover } from '@animateicons/react';
import {
  UserIcon,
  ShieldCheckIcon,
  SettingsIcon,
  BellRingIcon,
  SearchIcon,
} from '@animateicons/react/lucide';
import { useTheme } from '../../context/theme-context';
import { useSound } from '../../context/sound-context';
import { useLayout } from '../../context/layout-context';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { pillToast } from '../ui/pill-toast';
import { cn } from '../../lib/utils';

interface TopNavbarProps {
  currentPath?: string;
  onSearchClick?: () => void;
  onShortcutsClick?: () => void;
  onNavigate?: (path: string) => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({ currentPath, onSearchClick, onShortcutsClick, onNavigate }) => {
  const { resolvedTheme, toggleTheme } = useTheme();
  const { soundEnabled, toggleSound, play } = useSound();
  const { preset, setIsCustomizerOpen, isDrawerOpen, setIsDrawerOpen, glassMode, toggleGlassMode } = useLayout();
  const [isProfileOpen, setIsProfileOpen] = React.useState(false);
  const bellHover = useIconHover();

  const handleNavigate = (path: string) => {
    play('click');
    setIsProfileOpen(false);
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.location.hash = path;
    }
  };

  const handleThemeToggle = (e: React.MouseEvent) => {
    play('switch');
    toggleTheme(e);
  };

  const handleSoundToggle = () => {
    toggleSound();
  };

  return (
    <header className="sticky top-0 z-40 w-full liquid-glass border-b border-border/40 transition-colors">
      <div className="flex h-14 items-center justify-between px-4 sm:px-6">
        {/* Left: Brand & Mobile/Drawer Trigger */}
        <div className="flex items-center gap-2.5">
          {/* Menu / Drawer button for non-expanded presets or mobile */}
          {preset !== 'left-sidebar' ? (
            <button
              type="button"
              onClick={() => {
                play('click');
                setIsDrawerOpen(!isDrawerOpen);
              }}
              title={isDrawerOpen ? 'Cerrar menú' : 'Abrir menú lateral completo'}
              className="h-8 w-8 rounded-xl flex items-center justify-center text-foreground hover:bg-muted/70 transition-colors group cursor-pointer"
            >
              <MorphIcon icon={isDrawerOpen ? X : Menu} size={18} className="transition-transform duration-200 group-hover:scale-110 group-active:scale-95" spring="snappy" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                play('click');
                setIsDrawerOpen(!isDrawerOpen);
              }}
              title={isDrawerOpen ? 'Cerrar menú' : 'Abrir menú'}
              className="lg:hidden h-8 w-8 rounded-xl flex items-center justify-center text-foreground hover:bg-muted/70 transition-colors group cursor-pointer"
            >
              <MorphIcon icon={isDrawerOpen ? X : Menu} size={18} className="transition-transform duration-200 group-hover:scale-110 group-active:scale-95" spring="snappy" />
            </button>
          )}

          <a
            href="#/dashboard"
            onClick={(e) => {
              if (onNavigate) {
                e.preventDefault();
                play('click');
                onNavigate('/dashboard');
              }
            }}
            className="flex items-center gap-2.5 group cursor-pointer"
          >
            <div className="h-8 w-8 rounded-xl bg-primary flex items-center justify-center text-white transition-transform active:scale-95 group-hover:scale-105 shadow-xs">
              <Layers className="h-4 w-4" strokeWidth={2.2} />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-sm tracking-tight flex items-center gap-1.5 leading-none">
                Blakor <span className="text-primary font-bold">Pro</span>
              </span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono mt-0.5">
                Admin Shell
              </span>
            </div>
          </a>
        </div>

        {/* Center: Search Trigger (Cmd + K) */}
        <div className="hidden md:flex flex-1 max-w-md mx-6">
          <button
            type="button"
            onClick={() => {
              play('click');
              onSearchClick?.();
            }}
            className="w-full flex items-center justify-between h-9 px-3.5 rounded-xl border border-border/80 bg-background/50 text-muted-foreground hover:bg-muted/50 hover:text-foreground text-xs transition-colors group cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <SearchIcon size={16} className="text-muted-foreground group-hover:text-foreground transition-transform duration-200 group-hover:scale-110" />
              <span>Buscar vistas, clientes, pagos...</span>
            </div>
            <kbd className="hidden lg:inline-flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono font-medium text-muted-foreground">
              <Command className="h-3 w-3" /> K
            </kbd>
          </button>
        </div>

        {/* Right: Controls & Profile */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* Sound interaction toggle (cuelume) */}
          <button
            type="button"
            onClick={handleSoundToggle}
            title={soundEnabled ? 'Silenciar sonidos de interfaz' : 'Activar sonidos de interacción'}
            className={cn(
              'h-8 w-8 rounded-xl flex items-center justify-center hover:bg-muted/70 transition-colors group cursor-pointer',
              soundEnabled ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            {soundEnabled ? (
              <Volume2 className="h-[18px] w-[18px] transition-transform duration-200 group-hover:scale-110 group-active:scale-95" />
            ) : (
              <VolumeX className="h-[18px] w-[18px] transition-transform duration-200 group-hover:scale-110 group-active:scale-95" />
            )}
          </button>

          {/* Theme circular transition toggle with MorphIcon */}
          <button
            type="button"
            onClick={handleThemeToggle}
            title={`Cambiar a modo ${resolvedTheme === 'dark' ? 'claro' : 'oscuro'}`}
            className="h-8 w-8 rounded-xl flex items-center justify-center text-foreground hover:bg-muted/70 transition-colors group cursor-pointer"
          >
            <MorphIcon
              icon={resolvedTheme === 'dark' ? Sun : Moon}
              size={18}
              className="transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110 group-active:scale-95"
              spring="smooth"
            />
          </button>

          {/* Notifications button with BellRingIcon and full-button hover trigger */}
          <button
            {...bellHover.triggerProps}
            type="button"
            title="Notificaciones"
            className="h-8 w-8 rounded-xl flex items-center justify-center text-foreground hover:bg-muted/70 transition-colors group cursor-pointer relative"
          >
            <BellRingIcon
              ref={bellHover.ref}
              size={18}
              className="text-foreground transition-colors group-hover:text-primary transition-transform duration-200 group-hover:scale-110 group-active:scale-95"
            />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background pointer-events-none" />
          </button>

          {/* Keyboard shortcuts & Kit Quick Guide (Cmd + /) */}
          <button
            type="button"
            onClick={() => onShortcutsClick?.()}
            title="Centro de Atajos & Guía del Kit (⌘/)"
            className="h-8 w-8 rounded-xl flex items-center justify-center text-foreground hover:bg-muted/70 transition-colors group cursor-pointer"
          >
            <HelpCircle className="h-[18px] w-[18px] transition-transform duration-200 group-hover:scale-110 group-active:scale-95" />
          </button>

          {/* Layout customizer toggle */}
          <button
            type="button"
            onClick={() => setIsCustomizerOpen(true)}
            title="Personalizar diseño y presets"
            className="h-8 w-8 rounded-xl flex items-center justify-center text-foreground hover:bg-muted/70 transition-colors group cursor-pointer"
          >
            <Sliders className="h-[18px] w-[18px] transition-transform duration-300 group-hover:rotate-90 group-hover:scale-110 group-active:scale-95" />
          </button>

          <div className="h-4 w-px bg-border/60 mx-1 hidden sm:block" />

          {/* User profile dropdown trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                play('pop');
                setIsProfileOpen(!isProfileOpen);
              }}
              className="flex items-center gap-2 pl-1 pr-1.5 py-0.5 rounded-xl hover:bg-muted/60 transition-colors cursor-pointer group"
            >
              <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-xs font-semibold group-hover:scale-105 transition-transform">
                JD
              </div>
              <div className="hidden xl:flex flex-col text-left">
                <span className="text-xs font-medium leading-none">J. Daniels</span>
                <span className="text-[10px] text-muted-foreground mt-0.5">Admin Pro</span>
              </div>
            </button>

            {isProfileOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsProfileOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-border/80 bg-card p-2 text-card-foreground shadow-xl z-50 animate-in fade-in zoom-in-95">
                  <div className="px-2.5 py-2 border-b border-border/60 mb-1">
                    <p className="text-xs font-semibold leading-none">John Daniels</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">admin@blakor.dev</p>
                    <div className="mt-1.5 flex gap-1">
                      <Badge variant="default" className="text-[10px] py-0 px-1.5">Owner</Badge>
                      <Badge variant="secondary" className="text-[10px] py-0 px-1.5">RBAC Super</Badge>
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <button
                      type="button"
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs hover:bg-muted/80 text-foreground transition-colors cursor-pointer group"
                      onClick={() => handleNavigate('/usuarios?tab=profile')}
                    >
                      <UserIcon size={16} className="text-muted-foreground group-hover:text-primary group-hover:scale-115 transition-all duration-200" />
                      <span>Mi Perfil</span>
                    </button>
                    <button
                      type="button"
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs hover:bg-muted/80 text-foreground transition-colors cursor-pointer group"
                      onClick={() => handleNavigate('/usuarios?tab=account')}
                    >
                      <Sliders className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:scale-115 transition-all duration-200" />
                      <span>Ajustes de Perfil</span>
                    </button>
                    <button
                      type="button"
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs hover:bg-muted/80 text-foreground transition-colors cursor-pointer group"
                      onClick={() => handleNavigate('/configuracion?tab=seguridad')}
                    >
                      <ShieldCheckIcon size={16} className="text-muted-foreground group-hover:text-primary group-hover:scale-115 transition-all duration-200" />
                      <span>Seguridad & 2FA</span>
                    </button>
                    <button
                      type="button"
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs hover:bg-muted/80 text-foreground transition-colors cursor-pointer group"
                      onClick={() => handleNavigate('/documentacion')}
                    >
                      <BookOpen className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:scale-115 transition-all duration-200" />
                      <span>Documentación & Manual</span>
                    </button>
                    <button
                      type="button"
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs hover:bg-muted/80 text-foreground transition-colors cursor-pointer group"
                      onClick={() => handleNavigate('/configuracion')}
                    >
                      <SettingsIcon size={16} className="text-muted-foreground group-hover:text-primary group-hover:scale-115 transition-all duration-200" />
                      <span>Configuración del Sistema</span>
                    </button>
                    <div className="h-px bg-border/60 my-1" />
                    <button
                      type="button"
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                      onClick={() => {
                        play('alert');
                        setIsProfileOpen(false);
                        pillToast.info('Sesión Finalizada', 'Has cerrado la sesión administrativa con éxito.');
                      }}
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Cerrar Sesión</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
