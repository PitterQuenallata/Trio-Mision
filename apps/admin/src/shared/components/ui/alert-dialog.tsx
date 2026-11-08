import React, { useEffect } from 'react';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from './button';
import { useSound } from '../../context/sound-context';
import { cn } from '../../lib/utils';

export interface AlertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  variant?: 'danger' | 'warning' | 'info';
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  isLoading?: boolean;
}

export const AlertDialog: React.FC<AlertDialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  variant = 'danger',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm,
  isLoading = false,
}) => {
  const { play } = useSound();

  useEffect(() => {
    if (isOpen) {
      if (variant === 'danger' || variant === 'warning') {
        play('alert');
      } else {
        play('click');
      }
    }
  }, [isOpen, variant, play]);

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

  const getIcon = () => {
    switch (variant) {
      case 'danger':
        return <AlertTriangle className="h-6 w-6 text-red-500" strokeWidth={2} />;
      case 'warning':
        return <AlertCircle className="h-6 w-6 text-amber-500" strokeWidth={2} />;
      case 'info':
        return <Info className="h-6 w-6 text-blue-500" strokeWidth={2} />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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

          {/* Alert Box: Solid Elevated Surface */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 4 }}
            transition={{ type: 'spring', damping: 26, stiffness: 350 }}
            className={cn(
              'relative w-full max-w-sm rounded-[28px] p-6 text-center overflow-hidden',
              'bg-card text-card-foreground border border-border shadow-2xl'
            )}
          >
            {/* Icon container */}
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60 border border-border">
              {getIcon()}
            </div>

            {/* Title & Description */}
            <h3 className="font-heading text-lg font-bold tracking-tight text-foreground">
              {title}
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>

            {/* Actions */}
            <div className="mt-6 flex flex-col sm:flex-row-reverse gap-2">
              <Button
                variant={variant === 'danger' ? 'destructive' : 'default'}
                className="w-full justify-center font-medium"
                soundType="alert"
                onClick={() => {
                  onConfirm();
                }}
                disabled={isLoading}
              >
                {isLoading ? 'Procesando...' : confirmText}
              </Button>
              <Button
                variant="outline"
                className="w-full justify-center"
                soundType="click"
                onClick={() => {
                  play('click');
                  onClose();
                }}
                disabled={isLoading}
              >
                {cancelText}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
