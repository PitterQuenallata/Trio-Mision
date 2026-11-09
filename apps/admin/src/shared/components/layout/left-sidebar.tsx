import React from 'react';

import { navigationCategories } from '../../lib/navigation';
import { useVisibleNavItems } from '../../auth/use-visible-nav';
import { useSound } from '../../context/sound-context';
import { useLayout } from '../../context/layout-context';
import { useTheme } from '../../context/theme-context';
import { HookSidebar } from '../ui/hook-sidebar';
import { UserIdentityCard } from './user-identity';

import { cn } from '../../lib/utils';

interface LeftSidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({ currentPath, onNavigate }) => {
  const visibleNavItems = useVisibleNavItems();
  const { play } = useSound();
  const { glassMode } = useLayout();
  const { resolvedTheme } = useTheme();

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
          const items = visibleNavItems.filter((i) => i.category === cat.key);
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

      {/* Identidad del usuario y cierre de sesión */}
      <div className="p-3 border-t border-border/40 relative z-10">
        <UserIdentityCard />
      </div>
    </aside>
  );
};
