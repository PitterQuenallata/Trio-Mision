import React, { useEffect } from 'react';
import { LucideIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useSound } from '../../context/sound-context';
import { cn } from '../../lib/utils';

export interface ActionSheetOption {
  id: string;
  label: string;
  icon?: LucideIcon;
  description?: string;
  isDestructive?: boolean;
  onClick: () => void;
}

export interface ActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  options: ActionSheetOption[];
  cancelText?: string;
}

export const ActionSheet: React.FC<ActionSheetProps> = ({
  isOpen,
  onClose,
  title,
  description,
  options,
  cancelText = 'Cancelar',
}) => {
  const { play } = useSound();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        play('click');
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, play]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end p-3 sm:p-6 sm:items-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/45 dark:bg-black/65 backdrop-blur-sm"
            onClick={() => {
              play('click');
              onClose();
            }}
          />

          {/* Action Sheet Container: Solid Surface */}
          <motion.div
            initial={{ y: 50, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 50, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', damping: 28, stiffness: 360 }}
            className="relative z-10 w-full max-w-sm flex flex-col gap-2.5 pb-safe"
          >
            {/* Primary Actions Card */}
            <div
              className={cn(
                'rounded-3xl overflow-hidden',
                'bg-card text-card-foreground border border-border shadow-2xl'
              )}
            >
              {/* Optional Header */}
              {(title || description) && (
                <div className="px-5 py-3.5 text-center border-b border-border bg-muted/20">
                  {title && (
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {title}
                    </h4>
                  )}
                  {description && (
                    <p className="text-[11px] text-muted-foreground/80 mt-0.5 leading-snug">
                      {description}
                    </p>
                  )}
                </div>
              )}

              {/* Action Rows */}
              <div className="divide-y divide-border">
                {options.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        if (option.isDestructive) {
                          play('alert');
                        } else {
                          play('click');
                        }
                        option.onClick();
                        onClose();
                      }}
                      className={cn(
                        'w-full px-5 py-3.5 flex items-center justify-between text-left transition-colors cursor-pointer',
                        'hover:bg-muted active:scale-[0.99]',
                        option.isDestructive
                          ? 'text-destructive font-semibold'
                          : 'text-foreground font-medium'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {Icon && (
                          <Icon
                            className={cn(
                              'h-4 w-4',
                              option.isDestructive
                                ? 'text-destructive'
                                : 'text-muted-foreground'
                            )}
                            strokeWidth={1.8}
                          />
                        )}
                        <div>
                          <div className="text-sm">{option.label}</div>
                          {option.description && (
                            <div className="text-[11px] text-muted-foreground font-normal">
                              {option.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Separate Cancel Pill */}
            <button
              type="button"
              onClick={() => {
                play('click');
                onClose();
              }}
              className={cn(
                'w-full py-3.5 rounded-2xl text-center text-sm font-semibold transition-all cursor-pointer',
                'bg-card text-card-foreground hover:bg-muted border border-border shadow-md',
                'active:scale-[0.98]'
              )}
            >
              {cancelText}
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
