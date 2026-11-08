import React from 'react';
import { useIconHover } from '@animateicons/react';
import { UserIcon, ShieldCheckIcon, SettingsIcon } from '@animateicons/react/lucide';
import { navItems, navigationCategories } from '../../lib/navigation';
import { useSound } from '../../context/sound-context';
import { useLayout } from '../../context/layout-context';
import { useTheme } from '../../context/theme-context';
import { HookSidebar } from '../ui/hook-sidebar';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';

interface LeftSidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({ currentPath, onNavigate }) => {
  const { play } = useSound();
  const { glassMode } = useLayout();
  const { resolvedTheme } = useTheme();

  const profileHover = useIconHover();
  const securityHover = useIconHover();
  const settingsHover = useIconHover();

  return (
    <aside
      className={cn(
        'w-64 flex flex-col shrink-0 h-[calc(100vh-3.5rem)] sticky top-14 select-none overflow-hidden transition-all duration-300 ease-out',
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
          <div className="absolute inset-x-0 bottom-0 h-96 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
        </div>
      )}

      {/* Main Navigation Items (Layered above ambient light) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 relative z-10 custom-scrollbar">
        {navigationCategories.map((cat) => {
          const items = navItems.filter((i) => i.category === cat.key);
          if (items.length === 0) return null;

          const hookItems = items.map((i) => ({
            label: i.title,
            href: i.path,
            badge: i.badge,
          }));

          return (
            <div key={cat.key} className="space-y-1">
              <HookSidebar
                label={cat.title}
                items={hookItems}
                currentPath={currentPath}
                color="var(--primary)"
                dashed={true}
                onChange={(idx) => {
                  play('tab');
                  const item = items[idx];
                  if (item) {
                    onNavigate(item.path);
                  }
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Bottom User Profile & Security Quick Actions */}
      <div className="p-3 border-t border-border/40 relative z-10">
        <div className="p-2.5 rounded-2xl border border-border/60 bg-muted/30 hover:border-border/80 transition-all">
          <div
            onClick={() => {
              play('tab');
              onNavigate('/usuarios?tab=profile');
            }}
            className="flex items-center gap-2.5 cursor-pointer group mb-2.5"
            title="Ver mi perfil"
          >
            <div className="relative">
              <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-xs font-semibold group-hover:scale-105 transition-transform">
                JD
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-1 ring-card" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                  John Daniels
                </span>
                <Badge variant="outline" className="text-[9px] py-0 px-1 font-mono uppercase tracking-wider">
                  Owner
                </Badge>
              </div>
              <p className="text-[10px] text-muted-foreground truncate font-mono">
                admin@blakor.dev
              </p>
            </div>
          </div>

          {/* Quick Action Navigation Buttons */}
          <div className="grid grid-cols-3 gap-1 pt-2 border-t border-border/40">
            <button
              {...profileHover.triggerProps}
              type="button"
              onClick={() => {
                play('tab');
                onNavigate('/usuarios?tab=profile');
              }}
              title="Ajustes de Perfil"
              className={cn(
                'flex flex-col items-center justify-center py-2 px-1 rounded-xl text-[10px] font-medium transition-all cursor-pointer group',
                currentPath.startsWith('/usuarios')
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
              )}
            >
              <div className="transition-transform duration-200 group-hover:scale-120 group-active:scale-90">
                <UserIcon ref={profileHover.ref} size={17} className="mb-0.5 transition-colors group-hover:text-primary" />
              </div>
              <span>Perfil</span>
            </button>

            <button
              {...securityHover.triggerProps}
              type="button"
              onClick={() => {
                play('tab');
                onNavigate('/configuracion?tab=seguridad');
              }}
              title="Seguridad & 2FA"
              className={cn(
                'flex flex-col items-center justify-center py-2 px-1 rounded-xl text-[10px] font-medium transition-all cursor-pointer group',
                currentPath.includes('tab=seguridad')
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
              )}
            >
              <div className="transition-transform duration-200 group-hover:scale-120 group-active:scale-90">
                <ShieldCheckIcon ref={securityHover.ref} size={17} className="mb-0.5 transition-colors group-hover:text-primary" />
              </div>
              <span>Seguridad</span>
            </button>

            <button
              {...settingsHover.triggerProps}
              type="button"
              onClick={() => {
                play('tab');
                onNavigate('/configuracion');
              }}
              title="Configuración General"
              className={cn(
                'flex flex-col items-center justify-center py-2 px-1 rounded-xl text-[10px] font-medium transition-all cursor-pointer group',
                currentPath.startsWith('/configuracion') && !currentPath.includes('tab=seguridad')
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
              )}
            >
              <div className="transition-transform duration-200 group-hover:scale-120 group-active:scale-90">
                <SettingsIcon ref={settingsHover.ref} size={17} className="mb-0.5 transition-colors group-hover:text-primary" />
              </div>
              <span>Ajustes</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
