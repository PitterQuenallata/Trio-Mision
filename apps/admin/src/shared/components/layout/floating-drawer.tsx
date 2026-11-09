import React from 'react';
import { X, Layers } from 'lucide-react';
import { useIconHover } from '@animateicons/react';
import { UserIcon, ShieldCheckIcon, SettingsIcon } from '@animateicons/react/lucide';
import { navigationCategories } from '../../lib/navigation';
import { useVisibleNavItems } from '../../auth/use-visible-nav';
import { useSound } from '../../context/sound-context';
import { useLayout } from '../../context/layout-context';
import { useTheme } from '../../context/theme-context';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
import { UserIdentityCard } from './user-identity';

interface FloatingDrawerProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const FloatingDrawer: React.FC<FloatingDrawerProps> = ({ currentPath, onNavigate }) => {
  const visibleNavItems = useVisibleNavItems();
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
            <span className="font-semibold text-sm">Menú</span>
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
            const items = visibleNavItems.filter((i) => i.category === cat.key);
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

        {/* Identidad del usuario y cierre de sesión */}
        <div className="pt-3 border-t border-border/40 relative z-10">
          <UserIdentityCard />
        </div>
      </div>
    </div>
  );
};
