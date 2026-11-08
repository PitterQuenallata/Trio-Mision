import React from 'react';
import { PanelLeft } from 'lucide-react';
import { useIconHover } from '@animateicons/react';
import { UserIcon, ShieldCheckIcon, SettingsIcon } from '@animateicons/react/lucide';
import { navItems } from '../../lib/navigation';
import { useSound } from '../../context/sound-context';
import { useLayout } from '../../context/layout-context';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';

interface TopNavLinksProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const TopNavLinks: React.FC<TopNavLinksProps> = ({ currentPath, onNavigate }) => {
  const { play } = useSound();
  const { setIsDrawerOpen } = useLayout();
  const basePath = currentPath.split('?')[0];

  const hProfileHover = useIconHover();
  const hSecurityHover = useIconHover();
  const hSettingsHover = useIconHover();

  return (
    <div className="w-full border-b border-border/40 bg-card/60 backdrop-blur-md px-4 sm:px-6">
      <div className="flex items-center gap-1.5 overflow-x-auto py-2 no-scrollbar">
        {/* Sidebar Drawer Toggle Button */}
        <button
          type="button"
          onClick={() => {
            play('click');
            setIsDrawerOpen(true);
          }}
          title="Abrir Sidebar Lateral Completo"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all shrink-0 cursor-pointer active:scale-95"
        >
          <PanelLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Sidebar</span>
        </button>

        <div className="h-4 w-px bg-border/60 mx-1 shrink-0" />

        {/* Navigation Items */}
        {navItems.map((item) => {
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
              }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all duration-150 cursor-pointer shrink-0',
                isActive
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{item.title}</span>
              {item.badge && (
                <Badge
                  variant={isActive ? 'outline' : 'secondary'}
                  className={cn(
                    'text-[9px] py-0 px-1 font-mono',
                    isActive ? 'border-white/40 text-white' : 'bg-muted'
                  )}
                >
                  {item.badge}
                </Badge>
              )}
            </button>
          );
        })}

        <div className="h-4 w-px bg-border/60 mx-1 shrink-0" />

        {/* Quick Profile & Security Pills */}
        <button
          {...hProfileHover.triggerProps}
          type="button"
          onClick={() => {
            play('tab');
            onNavigate('/usuarios?tab=profile');
          }}
          title="Ajustes de Perfil"
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all shrink-0 cursor-pointer group',
            basePath === '/usuarios' && currentPath.includes('tab=profile')
              ? 'bg-primary text-primary-foreground font-semibold'
              : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
          )}
        >
          <div className="transition-transform duration-200 group-hover:scale-120 group-active:scale-90 flex items-center justify-center">
            <UserIcon ref={hProfileHover.ref} size={16} />
          </div>
          <span className="hidden md:inline">Mi Perfil</span>
        </button>

        <button
          {...hSecurityHover.triggerProps}
          type="button"
          onClick={() => {
            play('tab');
            onNavigate('/configuracion?tab=seguridad');
          }}
          title="Seguridad & 2FA"
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all shrink-0 cursor-pointer group',
            currentPath.includes('tab=seguridad')
              ? 'bg-primary text-primary-foreground font-semibold'
              : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
          )}
        >
          <div className="transition-transform duration-200 group-hover:scale-120 group-active:scale-90 flex items-center justify-center">
            <ShieldCheckIcon ref={hSecurityHover.ref} size={16} />
          </div>
          <span className="hidden md:inline">Seguridad & 2FA</span>
        </button>

        <button
          {...hSettingsHover.triggerProps}
          type="button"
          onClick={() => {
            play('tab');
            onNavigate('/configuracion');
          }}
          title="Configuración App"
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all shrink-0 cursor-pointer group',
            basePath === '/configuracion' && !currentPath.includes('tab=seguridad')
              ? 'bg-primary text-primary-foreground font-semibold'
              : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
          )}
        >
          <div className="transition-transform duration-200 group-hover:scale-120 group-active:scale-90 flex items-center justify-center">
            <SettingsIcon ref={hSettingsHover.ref} size={16} />
          </div>
          <span className="hidden md:inline">Configuración</span>
        </button>
      </div>
    </div>
  );
};
