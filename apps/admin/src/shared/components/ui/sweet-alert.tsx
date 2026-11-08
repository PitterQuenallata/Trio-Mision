import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  Clock,
  ShieldAlert,
  X,
} from 'lucide-react';
import { Button } from './button';
import { Input } from './input';
import { useSound } from '../../context/sound-context';
import { cn } from '../../lib/utils';

export type SweetAlertType = 'success' | 'danger' | 'warning' | 'info' | 'timer' | 'prompt';

export interface SweetAlertOptions {
  type?: SweetAlertType;
  title: string;
  text?: string;
  confirmText?: string;
  cancelText?: string;
  showCancelButton?: boolean;
  timerMs?: number;
  promptPlaceholder?: string;
  requiredMatch?: string;
  onConfirm?: (value?: string) => void;
  onCancel?: () => void;
}

export interface SweetAlertProps extends SweetAlertOptions {
  isOpen: boolean;
  onClose: () => void;
}

export const SweetAlert: React.FC<SweetAlertProps> = ({
  isOpen,
  onClose,
  type = 'info',
  title,
  text,
  confirmText = 'Aceptar',
  cancelText = 'Cancelar',
  showCancelButton = false,
  timerMs,
  promptPlaceholder = 'Ingresa el valor requerido...',
  requiredMatch,
  onConfirm,
  onCancel,
}) => {
  const { play } = useSound();
  const [inputValue, setInputValue] = useState('');
  const [progress, setProgress] = useState(100);

  // Play sound on open
  useEffect(() => {
    if (isOpen) {
      setInputValue('');
      setProgress(100);

      if (type === 'success') play('success');
      else if (type === 'danger' || type === 'warning') play('alert');
      else play('pop');
    }
  }, [isOpen, type, play]);

  // Handle countdown timer
  useEffect(() => {
    if (!isOpen || !timerMs || timerMs <= 0) return;

    const intervalMs = 25;
    const step = (intervalMs / timerMs) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev - step;
        if (next <= 0) {
          clearInterval(timer);
          onClose();
          return 0;
        }
        return next;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isOpen, timerMs, onClose]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        play('click');
        handleCancel();
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
  }, [isOpen]);

  const handleConfirm = () => {
    if (requiredMatch && inputValue.trim() !== requiredMatch.trim()) {
      play('alert');
      return;
    }
    play('click');
    onConfirm?.(inputValue);
    onClose();
  };

  const handleCancel = () => {
    play('click');
    onCancel?.();
    onClose();
  };

  const isConfirmDisabled = Boolean(
    requiredMatch && inputValue.trim() !== requiredMatch.trim()
  );

  const getIcon = () => {
    switch (type) {
      case 'success':
        return (
          <div className="h-16 w-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 stroke-[1.8]" />
          </div>
        );
      case 'danger':
        return (
          <div className="h-16 w-16 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center">
            <ShieldAlert className="h-8 w-8 stroke-[1.8]" />
          </div>
        );
      case 'warning':
        return (
          <div className="h-16 w-16 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 stroke-[1.8]" />
          </div>
        );
      case 'timer':
        return (
          <div className="h-16 w-16 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
            <Clock className="h-8 w-8 stroke-[1.8] animate-pulse" />
          </div>
        );
      case 'prompt':
        return (
          <div className="h-16 w-16 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center">
            <AlertCircle className="h-8 w-8 stroke-[1.8]" />
          </div>
        );
      case 'info':
      default:
        return (
          <div className="h-16 w-16 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center">
            <Info className="h-8 w-8 stroke-[1.8]" />
          </div>
        );
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/45 backdrop-blur-xs"
            onClick={handleCancel}
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 4 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className={cn(
              'relative w-full max-w-md rounded-3xl overflow-hidden text-center p-6 sm:p-7',
              'bg-card text-card-foreground border border-border',
              'shadow-[0_24px_56px_-12px_rgba(0,0,0,0.18)] dark:shadow-[0_28px_64px_-12px_rgba(0,0,0,0.75)]'
            )}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={handleCancel}
              className="absolute top-4 right-4 h-7 w-7 rounded-full text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Icon */}
            <div className="flex justify-center mb-4">{getIcon()}</div>

            {/* Title */}
            <h3 className="font-heading text-lg sm:text-xl font-bold tracking-tight text-foreground">
              {title}
            </h3>

            {/* Text description */}
            {text && (
              <p className="text-xs sm:text-sm text-muted-foreground mt-2 leading-relaxed">
                {text}
              </p>
            )}

            {/* Prompt input field if type === 'prompt' */}
            {type === 'prompt' && (
              <div className="mt-4 text-left space-y-2">
                {requiredMatch && (
                  <p className="text-[11px] text-muted-foreground">
                    Escribe exactamente{' '}
                    <span className="font-mono font-bold text-foreground bg-muted px-1.5 py-0.5 rounded">
                      {requiredMatch}
                    </span>{' '}
                    para confirmar:
                  </p>
                )}
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={promptPlaceholder}
                  className="text-xs"
                  autoFocus
                />
              </div>
            )}

            {/* Timer Progress Bar */}
            {type === 'timer' && timerMs && (
              <div className="mt-5 space-y-1.5">
                <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-75 ease-linear rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                  Cerrando en {Math.ceil((progress / 100) * (timerMs / 1000))}s...
                </span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-6 flex flex-col-reverse sm:flex-row items-center justify-center gap-2.5">
              {showCancelButton && (
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  className="w-full sm:w-auto text-xs px-5 justify-center"
                >
                  {cancelText}
                </Button>
              )}
              <Button
                variant={type === 'danger' ? 'destructive' : 'default'}
                onClick={handleConfirm}
                disabled={isConfirmDisabled}
                className={cn(
                  'w-full sm:w-auto text-xs px-6 justify-center',
                  type === 'danger' && 'bg-red-600 hover:bg-red-700 text-white'
                )}
              >
                {confirmText}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
