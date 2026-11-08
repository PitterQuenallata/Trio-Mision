import React from 'react';
import { X, Layers } from 'lucide-react';
import { useIconHover } from '@animateicons/react';
import { UserIcon, ShieldCheckIcon, SettingsIcon } from '@animateicons/react/lucide';
import { navItems, navigationCategories } from '../../lib/navigation';
import { useSound } from '../../context/sound-context';
import { useLayout } from '../../context/layout-context';
import { useTheme } from '../../context/theme-context';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';

interface FloatingDrawerProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const FloatingDrawer: React.FC<FloatingDrawerProps> = ({ currentPath, onNavigate }) => {
  const { play } = useSound();
  const { isDrawerOpen, setIsDrawerOpen, glassMode } = useLayout();
  const { resolvedTheme } = useTheme();
  const basePath = currentPath.split('?')[0];

  const drawerProfileHover = useIconHover();
  const drawerSecurityHover = useIconHover();
  const drawerSettingsHover = useIconHover();

  if (!isDrawerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-start">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in transition-opacity"
        onClick={() => {
          play('click');
          setIsDrawerOpen(false);
        }}
      />

      {/* Floating Card Drawer */}
      <div
        className={cn(
          'relative m-3 sm:m-4 w-72 max-w-[calc(100vw-2rem)] h-[calc(100vh-1.5rem)] sm:h-[calc(100vh-2rem)] rounded-3xl p-5 shadow-2xl flex flex-col z-50 animate-in slide-in-from-left duration-250 overflow-hidden transition-all',
          glassMode
            ? 'bg-card/90 dark:bg-card/80 backdrop-blur-2xl border border-border/70 dark:border-white/10 shadow-2xl'
            : 'bg-card/95 backdrop-blur-xl border border-border/80'
        )}
      >
        {/* Bottom-to-Top Dark Grounding Gradient: SOLO en modo oscuro (en modo claro se omite totalmente) */}
        {glassMode && resolvedTheme === 'dark' && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 overflow-hidden transition-opacity duration-500 ease-out select-none"
          >
            {/* Darkening wash from bottom: más oscuro en la base y se desvanece suavemente hacia arriba */}
            <div className="absolute inset-x-0 bottom-0 h-80 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
          </div>
        )}

        <div className="flex items-center justify-between pb-4 border-b border-border/60 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
              <Layers className="h-4 w-4" />
            </div>
            <span className="font-semibold text-sm">Blakor Menú</span>
          </div>
          <Button
            variant="ghost"
            size="iconSm"
            onClick={() => {
              play('click');
              setIsDrawerOpen(false);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto py-2 space-y-4 no-scrollbar relative z-10">
          {navigationCategories.map((cat) => {
            const items = navItems.filter((i) => i.category === cat.key);
            if (items.length === 0) return null;

            return (
              <div key={cat.key} className="space-y-1">
                <div className="px-3 py-1 text-[10px] font-semibold tracking-wider uppercase text-muted-foreground/80 font-mono">
                  {cat.title}
                </div>
                {items.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    basePath === item.path ||
                    (item.path === '/dashboard' && basePath === '/');

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        play('tab');
                        onNavigate(item.path);
                        setIsDrawerOpen(false);
                      }}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer',
                        isActive
                          ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                          : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={cn('h-4 w-4', isActive ? 'stroke-[2.2px]' : 'stroke-[1.75px]')} />
                        <span>{item.title}</span>
                      </div>
                      {item.badge && (
                        <Badge
                          variant={isActive ? 'outline' : 'secondary'}
                          className={cn('text-[9px] py-0 px-1 font-mono', isActive && 'border-white/40 text-white')}
                        >
                          {item.badge}
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Drawer Footer with Profile & Security Quick Links */}
        <div className="pt-3 border-t border-border/40 space-y-2 relative z-10">
          <div
            onClick={() => {
              play('tab');
              onNavigate('/usuarios?tab=profile');
              setIsDrawerOpen(false);
            }}
            className="p-2 rounded-2xl bg-muted/40 border border-border/60 flex items-center justify-between cursor-pointer hover:bg-muted/60 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-xs font-semibold shrink-0">
                JD
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold leading-none truncate">John Daniels</span>
                <span className="text-[10px] text-muted-foreground truncate font-mono mt-0.5">admin@blakor.dev</span>
              </div>
            </div>
            <Badge variant="outline" className="text-[9px] py-0 px-1 font-mono">Owner</Badge>
          </div>

          <div className="grid grid-cols-3 gap-1">
            <button
              {...drawerProfileHover.triggerProps}
              type="button"
              onClick={() => {
                play('tab');
                onNavigate('/usuarios?tab=profile');
                setIsDrawerOpen(false);
              }}
              className="flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-[11px] font-medium bg-muted/50 hover:bg-muted text-foreground transition-all cursor-pointer group"
            >
              <div className="transition-transform duration-200 group-hover:scale-120 group-active:scale-90 flex items-center justify-center">
                <UserIcon ref={drawerProfileHover.ref} size={16} className="text-primary" />
              </div>
              <span>Perfil</span>
            </button>

            <button
              {...drawerSecurityHover.triggerProps}
              type="button"
              onClick={() => {
                play('tab');
                onNavigate('/configuracion?tab=seguridad');
                setIsDrawerOpen(false);
              }}
              className="flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-[11px] font-medium bg-muted/50 hover:bg-muted text-foreground transition-all cursor-pointer group"
            >
              <div className="transition-transform duration-200 group-hover:scale-120 group-active:scale-90 flex items-center justify-center">
                <ShieldCheckIcon ref={drawerSecurityHover.ref} size={16} className="text-primary" />
              </div>
              <span>Seguridad</span>
            </button>

            <button
              {...drawerSettingsHover.triggerProps}
              type="button"
              onClick={() => {
                play('tab');
                onNavigate('/configuracion');
                setIsDrawerOpen(false);
              }}
              className="flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-[11px] font-medium bg-muted/50 hover:bg-muted text-foreground transition-all cursor-pointer group"
            >
              <div className="transition-transform duration-200 group-hover:scale-120 group-active:scale-90 flex items-center justify-center">
                <SettingsIcon ref={drawerSettingsHover.ref} size={16} className="text-primary" />
              </div>
              <span>Ajustes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
