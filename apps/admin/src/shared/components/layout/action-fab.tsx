import React from 'react';
import { Plus, Layers, UserPlus, Music } from 'lucide-react';
import { useSound } from '../../context/sound-context';
import { useLayout } from '../../context/layout-context';
import { cn } from '../../lib/utils';

interface ActionFabProps {
  onQuickAction?: (actionId: string) => void;
}

export const ActionFab: React.FC<ActionFabProps> = ({ onQuickAction }) => {
  const { play } = useSound();
  const { preset, isFabOpen, setIsFabOpen } = useLayout();

  if (preset !== 'action-fab') return null;

  const actions = [
    { id: 'open-sidebar', label: 'Abrir Sidebar Completo', icon: Layers, primary: true },
    { id: 'new-user', label: 'Cuentas staff', icon: UserPlus },
    { id: 'mi-grupo', label: 'Mi grupo', icon: Music },
  ];

  const handleToggle = () => {
    play('pop');
    setIsFabOpen(!isFabOpen);
  };

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end">
      {/* Expanded Quick Actions */}
      {isFabOpen && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => {
              play('click');
              setIsFabOpen(false);
            }}
          />
          <div className="relative mb-3 flex flex-col items-end gap-1.5 z-40 animate-in fade-in slide-in-from-bottom-4 duration-200">
            {actions.map((act) => {
              const Icon = act.icon;
              return (
                <button
                  key={act.id}
                  type="button"
                  onClick={() => {
                    play('click');
                    setIsFabOpen(false);
                    onQuickAction?.(act.id);
                  }}
                  className={cn(
                    'flex items-center gap-2.5 px-3.5 py-2 rounded-2xl border text-card-foreground shadow-lg transition-all active:scale-95 text-xs font-medium cursor-pointer group',
                    act.primary
                      ? 'border-primary/50 bg-primary text-primary-foreground shadow-primary/20'
                      : 'border-border/80 bg-card/95 backdrop-blur-xl hover:bg-muted/80'
                  )}
                >
                  <span className={cn(act.primary ? 'font-semibold' : 'text-foreground')}>
                    {act.label}
                  </span>
                  <div
                    className={cn(
                      'h-7 w-7 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110',
                      act.primary
                        ? 'bg-black/20 text-white'
                        : 'bg-primary/10 text-primary'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Main Trigger Button */}
      <button
        type="button"
        onClick={handleToggle}
        title="Acciones rápidas & navegación"
        className={cn(
          'relative z-40 h-12 w-12 rounded-2xl bg-primary text-primary-foreground shadow-lg flex items-center justify-center transition-all duration-200 hover:opacity-95 active:scale-95 cursor-pointer',
          isFabOpen && 'bg-zinc-800 text-white rotate-45'
        )}
      >
        <Plus className="h-6 w-6 stroke-[2.5px] transition-transform duration-300" />
      </button>
    </div>
  );
};
