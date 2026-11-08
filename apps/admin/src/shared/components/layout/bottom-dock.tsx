import React from 'react';
import { Layers } from 'lucide-react';
import { useIconHover } from '@animateicons/react';
import { UserIcon, ShieldCheckIcon, SettingsIcon } from '@animateicons/react/lucide';
import { navItems } from '../../lib/navigation';
import { useSound } from '../../context/sound-context';
import { useLayout } from '../../context/layout-context';
import { Dock, DockItem, DockLabel, DockIcon, DockSeparator } from '../../../components/ui/dock';
import { cn } from '../../lib/utils';

interface BottomDockProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const BottomDock: React.FC<BottomDockProps> = ({ currentPath, onNavigate }) => {
  const { play } = useSound();
  const { setIsDrawerOpen } = useLayout();
  const basePath = currentPath.split('?')[0];

  const dockProfileHover = useIconHover();
  const dockSecurityHover = useIconHover();
  const dockSettingsHover = useIconHover();

  // Core essential modules for macOS dock display
  const dockModuleIds = [
    'dashboard',
    'documentacion',
    'auth-showcase',
    'ecommerce',
    'automatizaciones',
    'proyectos',
    'comunicaciones',
    'blog',
    'soporte',
    'usuarios',
  ];
  const dockItems = navItems.filter((item) => dockModuleIds.includes(item.id));

  return (
    <div className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] inset-x-0 z-40 flex justify-center pointer-events-none px-2 sm:px-4">
      <div className="pointer-events-auto max-w-full overflow-x-auto no-scrollbar">
        <Dock
          magnification={72}
          distance={135}
          panelHeight={58}
          className="items-end pb-2.5 px-3 sm:px-4 bg-[#F3F4F6]/90 dark:bg-neutral-900/90 border border-black/[0.06] dark:border-white/10 shadow-2xl backdrop-blur-2xl"
        >
          {dockItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              basePath === item.path ||
              (item.path === '/dashboard' && basePath === '/');
            const isPriority = ['dashboard', 'ecommerce', 'usuarios'].includes(item.id);

            return (
              <DockItem
                key={item.id}
                active={isActive}
                onClick={() => {
                  play('tab');
                  onNavigate(item.path);
                }}
                className={cn(
                  'aspect-square rounded-full transition-colors flex items-center justify-center',
                  !isPriority && 'hidden sm:inline-flex',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-[#E5E7EB] dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-[#D1D5DB] dark:hover:bg-neutral-700'
                )}
              >
                <DockLabel>{item.title}</DockLabel>
                <DockIcon>
                  <Icon
                    className={cn(
                      'h-full w-full transition-colors',
                      isActive ? 'stroke-[2.2px] text-primary-foreground' : 'stroke-[2px] text-neutral-700 dark:text-neutral-200'
                    )}
                  />
                </DockIcon>
              </DockItem>
            );
          })}

          <DockSeparator />

          {/* Profile Shortcut */}
          <DockItem
            {...dockProfileHover.triggerProps}
            active={basePath === '/usuarios' && currentPath.includes('tab=profile')}
            onClick={() => {
              play('tab');
              onNavigate('/usuarios?tab=profile');
            }}
            className={cn(
              'aspect-square rounded-full transition-colors flex items-center justify-center group',
              basePath === '/usuarios' && currentPath.includes('tab=profile')
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-[#E5E7EB] dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-[#D1D5DB] dark:hover:bg-neutral-700'
            )}
          >
            <DockLabel>Mi Perfil (John Daniels)</DockLabel>
            <DockIcon>
              <UserIcon
                ref={dockProfileHover.ref}
                size={22}
                className={cn(
                  'transition-transform duration-200 group-hover:scale-115',
                  basePath === '/usuarios' && currentPath.includes('tab=profile')
                    ? 'text-primary-foreground'
                    : 'text-neutral-700 dark:text-neutral-200'
                )}
              />
            </DockIcon>
          </DockItem>

          {/* Security & 2FA Shortcut */}
          <DockItem
            {...dockSecurityHover.triggerProps}
            active={currentPath.includes('tab=seguridad')}
            onClick={() => {
              play('tab');
              onNavigate('/configuracion?tab=seguridad');
            }}
            className={cn(
              'aspect-square rounded-full transition-colors hidden sm:inline-flex items-center justify-center group',
              currentPath.includes('tab=seguridad')
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-[#E5E7EB] dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-[#D1D5DB] dark:hover:bg-neutral-700'
            )}
          >
            <DockLabel>Seguridad & 2FA</DockLabel>
            <DockIcon>
              <ShieldCheckIcon
                ref={dockSecurityHover.ref}
                size={22}
                className={cn(
                  'transition-transform duration-200 group-hover:scale-115',
                  currentPath.includes('tab=seguridad')
                    ? 'text-primary-foreground'
                    : 'text-neutral-700 dark:text-neutral-200'
                )}
              />
            </DockIcon>
          </DockItem>

          {/* System Settings Shortcut */}
          <DockItem
            {...dockSettingsHover.triggerProps}
            active={basePath === '/configuracion' && !currentPath.includes('tab=seguridad')}
            onClick={() => {
              play('tab');
              onNavigate('/configuracion');
            }}
            className={cn(
              'aspect-square rounded-full transition-colors hidden sm:inline-flex items-center justify-center group',
              basePath === '/configuracion' && !currentPath.includes('tab=seguridad')
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-[#E5E7EB] dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-[#D1D5DB] dark:hover:bg-neutral-700'
            )}
          >
            <DockLabel>Configuración App</DockLabel>
            <DockIcon>
              <SettingsIcon
                ref={dockSettingsHover.ref}
                size={22}
                className={cn(
                  'transition-transform duration-200 group-hover:scale-115',
                  basePath === '/configuracion' && !currentPath.includes('tab=seguridad')
                    ? 'text-primary-foreground'
                    : 'text-neutral-700 dark:text-neutral-200'
                )}
              />
            </DockIcon>
          </DockItem>

          {/* Full Sidebar Drawer Toggle */}
          <DockItem
            className="aspect-square rounded-full bg-primary hover:bg-primary/90 text-primary-foreground transition-all flex items-center justify-center shadow-xs"
            onClick={() => {
              play('pop');
              setIsDrawerOpen(true);
            }}
          >
            <DockLabel>Abrir Sidebar Completo</DockLabel>
            <DockIcon>
              <Layers className="h-full w-full text-primary-foreground stroke-[2px]" />
            </DockIcon>
          </DockItem>
        </Dock>
      </div>
    </div>
  );
};

export default BottomDock;
