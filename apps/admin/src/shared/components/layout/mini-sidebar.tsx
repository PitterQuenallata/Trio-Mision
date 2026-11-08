import React from 'react';
import { PanelLeft } from 'lucide-react';
import { useIconHover } from '@animateicons/react';
import { UserIcon, ShieldCheckIcon, SettingsIcon } from '@animateicons/react/lucide';
import { navItems, navigationCategories } from '../../lib/navigation';
import { useSound } from '../../context/sound-context';
import { useLayout } from '../../context/layout-context';
import { useTheme } from '../../context/theme-context';
import { cn } from '../../lib/utils';

interface MiniSidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const MiniSidebar: React.FC<MiniSidebarProps> = ({ currentPath, onNavigate }) => {
  const { play } = useSound();
  const { setIsDrawerOpen, glassMode } = useLayout();
  const { resolvedTheme } = useTheme();
  const basePath = currentPath.split('?')[0];

  const miniProfileHover = useIconHover();
  const miniSecurityHover = useIconHover();
  const miniSettingsHover = useIconHover();

  return (
    <aside
      className={cn(
        'w-16 flex flex-col items-center py-3 shrink-0 h-[calc(100vh-3.5rem)] sticky top-14 select-none overflow-hidden transition-all duration-300 ease-out',
        glassMode
          ? 'bg-card/75 dark:bg-card/65 backdrop-blur-xl border-r border-border/60 dark:border-white/10'
          : 'bg-card/90 dark:bg-card/85 backdrop-blur-md border-r border-border/80'
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

      {/* Top Drawer Expand Button */}
      <div className="group flex justify-center pb-2.5 border-b border-border/40 w-full relative z-10">
        <button
          type="button"
          onClick={() => {
            play('click');
            setIsDrawerOpen(true);
          }}
          title="Expandir Sidebar Completo"
          className="h-10 w-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center hover:bg-primary/20 transition-all cursor-pointer active:scale-95"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
        <div className="absolute left-14 top-2 hidden group-hover:flex items-center z-50 pointer-events-none">
          <div className="rounded-xl border border-border/80 bg-card px-2.5 py-1 text-xs font-semibold text-card-foreground shadow-lg whitespace-nowrap">
            Expandir Sidebar Completo
          </div>
        </div>
      </div>

      {/* Main Categorized Items */}
      <div className="flex-1 w-full space-y-3 py-2 overflow-y-auto no-scrollbar relative z-10">
        {navigationCategories.map((cat, catIdx) => {
          const items = navItems.filter((i) => i.category === cat.key);
          if (items.length === 0) return null;

          return (
            <div key={cat.key} className="space-y-1.5 flex flex-col items-center">
              {catIdx > 0 && <div className="w-6 h-px bg-border/40 my-1" />}
              {items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  basePath === item.path ||
                  (item.path === '/dashboard' && basePath === '/');

                return (
                  <div key={item.id} className="relative group flex justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        play('tab');
                        onNavigate(item.path);
                      }}
                      className={cn(
                        'h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-150 cursor-pointer',
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                      )}
                    >
                      <Icon className={cn('h-4 w-4', isActive ? 'stroke-[2.2px]' : 'stroke-[1.75px]')} />
                    </button>

                    {/* Tooltip on right */}
                    <div className="absolute left-14 top-1 hidden group-hover:flex items-center z-50 pointer-events-none">
                      <div className="rounded-xl border border-border/80 bg-card px-2.5 py-1 text-xs font-medium text-card-foreground shadow-lg whitespace-nowrap flex items-center gap-1.5">
                        <span>{item.title}</span>
                        {item.badge && (
                          <span className="font-mono text-[9px] px-1 py-0.2 rounded-full bg-primary/10 text-primary font-bold">
                            {item.badge}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Mini Sidebar Bottom Profile & Security Dock */}
      <div className="w-full flex flex-col items-center pt-2 border-t border-border/40 space-y-1.5 relative z-10">
        {/* Mi Perfil Button */}
        <div className="relative group flex justify-center">
          <button
            {...miniProfileHover.triggerProps}
            type="button"
            onClick={() => {
              play('tab');
              onNavigate('/usuarios?tab=profile');
            }}
            title="Mi Perfil"
            className={cn(
              'h-9 w-9 rounded-xl flex items-center justify-center transition-all cursor-pointer group',
              basePath === '/usuarios' && currentPath.includes('tab=profile')
                ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                : 'bg-primary/10 text-primary border border-primary/20 hover:scale-105'
            )}
          >
            <div className="transition-transform duration-200 group-hover:scale-120 group-active:scale-90">
              <UserIcon ref={miniProfileHover.ref} size={19} />
            </div>
          </button>
          <div className="absolute left-14 top-1 hidden group-hover:flex items-center z-50 pointer-events-none">
            <div className="rounded-xl border border-border/80 bg-card px-2.5 py-1 text-xs font-medium text-card-foreground shadow-lg whitespace-nowrap">
              Mi Perfil (John Daniels)
            </div>
          </div>
        </div>

        {/* Seguridad & 2FA Button */}
        <div className="relative group flex justify-center">
          <button
            {...miniSecurityHover.triggerProps}
            type="button"
            onClick={() => {
              play('tab');
              onNavigate('/configuracion?tab=seguridad');
            }}
            title="Seguridad & 2FA"
            className={cn(
              'h-9 w-9 rounded-xl flex items-center justify-center transition-all cursor-pointer group',
              currentPath.includes('tab=seguridad')
                ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
            )}
          >
            <div className="transition-transform duration-200 group-hover:scale-120 group-active:scale-90">
              <ShieldCheckIcon ref={miniSecurityHover.ref} size={19} className="transition-colors group-hover:text-primary" />
            </div>
          </button>
          <div className="absolute left-14 top-1 hidden group-hover:flex items-center z-50 pointer-events-none">
            <div className="rounded-xl border border-border/80 bg-card px-2.5 py-1 text-xs font-medium text-card-foreground shadow-lg whitespace-nowrap">
              Seguridad & 2FA
            </div>
          </div>
        </div>

        {/* Configuración App Button */}
        <div className="relative group flex justify-center">
          <button
            {...miniSettingsHover.triggerProps}
            type="button"
            onClick={() => {
              play('tab');
              onNavigate('/configuracion');
            }}
            title="Configuración App"
            className={cn(
              'h-9 w-9 rounded-xl flex items-center justify-center transition-all cursor-pointer group',
              basePath === '/configuracion' && !currentPath.includes('tab=seguridad')
                ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
            )}
          >
            <div className="transition-transform duration-200 group-hover:scale-120 group-active:scale-90">
              <SettingsIcon ref={miniSettingsHover.ref} size={19} className="transition-colors group-hover:text-primary" />
            </div>
          </button>
          <div className="absolute left-14 top-1 hidden group-hover:flex items-center z-50 pointer-events-none">
            <div className="rounded-xl border border-border/80 bg-card px-2.5 py-1 text-xs font-medium text-card-foreground shadow-lg whitespace-nowrap">
              Configuración & Ajustes
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
