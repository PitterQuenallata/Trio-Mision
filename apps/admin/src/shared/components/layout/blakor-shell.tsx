import React, { useState } from 'react';
import { Toaster } from 'sileo';
import { SonnerToaster } from '../ui/sonner';
import { PillToaster } from '../ui/pill-toast';
import { useLayout } from '../../context/layout-context';
import { useTheme } from '../../context/theme-context';
import { TopNavbar } from './top-navbar';
import { BottomDock } from './bottom-dock';
import { LeftSidebar } from './left-sidebar';
import { MiniSidebar } from './mini-sidebar';
import { FloatingDrawer } from './floating-drawer';
import { ActionFab } from './action-fab';
import { LayoutCustomizer } from './layout-customizer';
import { TopNavLinks } from './top-nav-bar-horizontal';
import { CommandSearchModal } from './command-search-modal';
import { KeyboardShortcutsModal } from './keyboard-shortcuts-modal';
import { cn } from '../../lib/utils';

interface BlakorShellProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  children: React.ReactNode;
}

export const BlakorShell: React.FC<BlakorShellProps> = ({
  currentPath,
  onNavigate,
  children,
}) => {
  const { preset, containerWidth, setIsDrawerOpen, setIsCustomizerOpen } = useLayout();
  const { resolvedTheme } = useTheme();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  // Handle keyboard shortcuts Cmd+K (Spotlight) & Cmd+/ (Shortcuts & Quick Guide)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === '/' || e.key === '?')) {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary relative overflow-x-hidden">
      {/* Subtle ambient lighting inspired by Mallku v1 */}
      <div className="pointer-events-none absolute top-0 inset-x-0 h-96 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(249,115,22,0.06),transparent_70%)] dark:bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(249,115,22,0.12),transparent_70%)] z-0" />

      {/* Liquid Glass Dynamic Ambient Mesh - Provides vibrant color highlights to refract through the glass */}
      <div className="glass-ambient-mesh pointer-events-none fixed inset-0 overflow-hidden z-0 opacity-0 transition-opacity duration-500">
        <div className="absolute top-10 left-1/4 w-[500px] h-[500px] bg-gradient-to-br from-orange-500/12 via-rose-500/8 to-transparent rounded-full filter blur-[100px]" />
        <div className="absolute top-1/2 right-10 w-[450px] h-[450px] bg-gradient-to-bl from-blue-500/10 via-indigo-500/8 to-transparent rounded-full filter blur-[100px]" />
        <div className="absolute bottom-10 left-10 w-[550px] h-[550px] bg-gradient-to-tr from-purple-500/10 via-teal-500/6 to-transparent rounded-full filter blur-[110px]" />
      </div>

      {/* Top Navbar Header */}
      <TopNavbar
        currentPath={currentPath}
        onSearchClick={() => setIsSearchOpen(true)}
        onShortcutsClick={() => setIsShortcutsOpen(true)}
        onNavigate={onNavigate}
      />

      {/* Preset 2: Top Nav Horizontal bar */}
      {preset === 'top-navbar' && (
        <TopNavLinks currentPath={currentPath} onNavigate={onNavigate} />
      )}

      {/* Main Shell Body */}
      <div className="flex flex-1">
        {/* Preset 3: Left Sidebar */}
        {preset === 'left-sidebar' && (
          <LeftSidebar currentPath={currentPath} onNavigate={onNavigate} />
        )}

        {/* Preset 4: Mini Sidebar */}
        {preset === 'left-mini' && (
          <MiniSidebar currentPath={currentPath} onNavigate={onNavigate} />
        )}

        {/* Main Content Area */}
        <main
          className={cn(
            'flex-1 transition-all duration-200 overflow-x-hidden',
            preset === 'bottom-dock' && 'pb-24', // Extra room so dock doesn't obscure content
            containerWidth === 'boxed' && 'max-w-[1440px] mx-auto w-full'
          )}
        >
          <div className="p-4 sm:p-6 lg:p-8 max-w-full">
            {children}
          </div>
        </main>
      </div>

      {/* Preset 1: Bottom Dock */}
      {preset === 'bottom-dock' && (
        <BottomDock currentPath={currentPath} onNavigate={onNavigate} />
      )}

      {/* Preset 5: Floating Drawer Modal */}
      <FloatingDrawer currentPath={currentPath} onNavigate={onNavigate} />

      {/* Preset 6: Floating Action Button (FAB) - Only visible when preset is action-fab */}
      {preset === 'action-fab' && (
        <ActionFab
          onQuickAction={(actionId) => {
            if (actionId === 'open-sidebar') setIsDrawerOpen(true);
            if (actionId === 'profile') onNavigate('/usuarios?tab=profile');
            if (actionId === 'security') onNavigate('/configuracion?tab=seguridad');
            if (actionId === 'config') onNavigate('/configuracion');
            if (actionId === 'new-user') onNavigate('/usuarios');
            if (actionId === 'new-payment') onNavigate('/pagos');
            if (actionId === 'new-blog') onNavigate('/blog');
            if (actionId === 'new-ticket') onNavigate('/soporte');
            if (actionId === 'new-license') onNavigate('/licencias');
            if (actionId === 'new-report') onNavigate('/reportes');
          }}
        />
      )}

      {/* Theme & Layout Customizer side sheet */}
      <LayoutCustomizer />

      {/* Quick Search Cmd+K Modal */}
      <CommandSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={(path) => {
          setIsSearchOpen(false);
          onNavigate(path);
        }}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
      />

      {/* Keyboard Shortcuts & Template Quick Guide Cmd+/ */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
        onNavigate={(path) => {
          setIsShortcutsOpen(false);
          onNavigate(path);
        }}
        onOpenCustomizer={() => setIsCustomizerOpen(true)}
      />
      {/* Sileo Toast Notifications Root (Dynamic Island - Top Center) */}
      <Toaster
        position="top-center"
        theme={resolvedTheme}
        options={{
          duration: 3500,
        }}
      />

      {/* Sonner Traditional Enterprise Toaster (Bottom Right) */}
      <SonnerToaster position="bottom-right" />

      {/* Apple Minimalist Inverted Pill Toaster (Top Right) */}
      <PillToaster position="top-right" />
    </div>
  );
};
