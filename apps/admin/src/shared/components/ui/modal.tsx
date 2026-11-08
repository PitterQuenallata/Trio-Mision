import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from './button';
import { useSound } from '../../context/sound-context';
import { cn } from '../../lib/utils';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCloseButton?: boolean;
  className?: string;
}

const sizes = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  showCloseButton = true,
  className,
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Dimming Backdrop */}
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

          {/* Modal Container: Solid High-Contrast Apple Elevated Surface */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', damping: 25, stiffness: 320 }}
            className={cn(
              'relative w-full rounded-3xl overflow-hidden',
              'bg-card text-card-foreground border border-border',
              'shadow-[0_20px_48px_-12px_rgba(0,0,0,0.14)] dark:shadow-[0_24px_56px_-12px_rgba(0,0,0,0.7)]',
              sizes[size],
              className
            )}
          >
            {/* Header */}
            {(title || showCloseButton) && (
              <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
                <div>
                  {title && (
                    <h3 className="font-heading text-lg font-bold tracking-tight text-foreground">
                      {title}
                    </h3>
                  )}
                  {description && (
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {description}
                    </p>
                  )}
                </div>
                {showCloseButton && (
                  <Button
                    variant="ghost"
                    size="iconSm"
                    soundType="click"
                    onClick={() => {
                      play('click');
                      onClose();
                    }}
                    className="rounded-full h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}

            {/* Body */}
            <div className="p-6">{children}</div>

            {/* Footer */}
            {footer && (
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/30">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
