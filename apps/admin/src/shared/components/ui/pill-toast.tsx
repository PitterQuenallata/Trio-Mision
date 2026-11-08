import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  X,
} from 'lucide-react';
import { sound } from '../../lib/sound';
import { cn } from '../../lib/utils';
import { notify } from '../../lib/notify';

export type PillToastType = 'success' | 'error' | 'warning' | 'info';

export interface PillToastOptions {
  id?: string;
  type?: PillToastType;
  title: string;
  description?: string;
  duration?: number;
}

type PillListener = (toast: PillToastOptions) => void;
type DismissListener = (id?: string) => void;

/**
 * Standalone Pill Toast Manager:
 * Manages the high-contrast inverted pill showcase with auto-dismissal timers.
 */
export class StandalonePillToastManager {
  private listeners: PillListener[] = [];
  private dismissListeners: DismissListener[] = [];

  subscribe(listener: PillListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  subscribeDismiss(listener: DismissListener) {
    this.dismissListeners.push(listener);
    return () => {
      this.dismissListeners = this.dismissListeners.filter((l) => l !== listener);
    };
  }

  show(options: PillToastOptions) {
    const duration = options.duration ?? 3500;
    const toastItem: PillToastOptions = {
      id: options.id || `pill-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: options.type || 'success',
      title: options.title,
      description: options.description,
      duration,
    };

    // Audio cue
    if (toastItem.type === 'success') sound.play('success');
    else if (toastItem.type === 'error' || toastItem.type === 'warning') sound.play('alert');
    else sound.play('pop');

    this.listeners.forEach((listener) => listener(toastItem));
    return toastItem.id;
  }

  dismiss(id?: string) {
    this.dismissListeners.forEach((listener) => listener(id));
  }

  clear() {
    this.dismiss();
  }

  success(title: string, description?: string, duration?: number) {
    return this.show({ type: 'success', title, description, duration });
  }

  error(title: string, description?: string, duration?: number) {
    return this.show({ type: 'error', title, description, duration });
  }

  warning(title: string, description?: string, duration?: number) {
    return this.show({ type: 'warning', title, description, duration });
  }

  info(title: string, description?: string, duration?: number) {
    return this.show({ type: 'info', title, description, duration });
  }
}

export const standalonePillToast = new StandalonePillToastManager();

/**
 * System-Wide Notification Engine:
 * Defaults all notification dispatches throughout Blakor Admin to Sileo (Dynamic Island style)
 * with physics-based morphing and guaranteed auto-dismissal.
 */
export const pillToast = {
  success: (title: string, description?: string, duration?: number) => {
    return notify.success(title, description, duration);
  },

  error: (title: string, description?: string, duration?: number) => {
    return notify.error(title, description, duration);
  },

  warning: (title: string, description?: string, duration?: number) => {
    return notify.warning(title, description, duration);
  },

  info: (title: string, description?: string, duration?: number) => {
    return notify.info(title, description, duration);
  },

  dismiss: (id?: string) => {
    return notify.dismiss(id);
  },

  clear: () => {
    return notify.clear();
  },

  show: (options: PillToastOptions) => {
    const type = options.type || 'info';
    return notify[type]({
      title: options.title,
      description: options.description,
      duration: options.duration ?? 3500,
      id: options.id,
    });
  },

  /** Direct access to the explicit inverted pill toast manager */
  pill: standalonePillToast,
};

export interface PillToasterProps {
  position?: 'top-right' | 'top-center' | 'top-left';
  className?: string;
}

export const PillToaster: React.FC<PillToasterProps> = ({
  position = 'top-right',
  className,
}) => {
  const [toasts, setToasts] = useState<PillToastOptions[]>([]);

  useEffect(() => {
    const unsubscribeShow = standalonePillToast.subscribe((newToast) => {
      setToasts((prev) => [...prev.slice(-3), newToast]); // Keep up to 4 active

      const dur = newToast.duration ?? 3500;
      if (dur > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
        }, dur);
      }
    });

    const unsubscribeDismiss = standalonePillToast.subscribeDismiss((id) => {
      if (id) {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      } else {
        setToasts([]);
      }
    });

    return () => {
      unsubscribeShow();
      unsubscribeDismiss();
    };
  }, []);

  const positionClasses = {
    'top-right': 'top-20 right-6 items-end',
    'top-center': 'top-20 left-1/2 -translate-x-1/2 items-center',
    'top-left': 'top-20 left-6 items-start',
  };

  const getIcon = (type: PillToastType = 'success') => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />;
      case 'info':
      default:
        return <Info className="h-4 w-4 text-blue-400 shrink-0" />;
    }
  };

  return (
    <div
      className={cn(
        'fixed z-50 flex flex-col gap-2.5 pointer-events-none',
        positionClasses[position],
        className
      )}
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, y: -16, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            onClick={() => standalonePillToast.dismiss(toast.id)}
            className={cn(
              'pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl select-none',
              'bg-foreground text-background shadow-2xl backdrop-blur-xl border border-foreground/10',
              'cursor-pointer hover:opacity-95 active:scale-98 transition-all duration-150'
            )}
          >
            {getIcon(toast.type)}

            <div className="flex flex-col text-left">
              <span className="text-xs font-semibold leading-tight">{toast.title}</span>
              {toast.description && (
                <span className="text-[11px] opacity-80 mt-0.5 leading-snug">
                  {toast.description}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                sound.play('click');
                standalonePillToast.dismiss(toast.id);
              }}
              className="ml-1 opacity-60 hover:opacity-100 rounded-full p-0.5 transition-opacity"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
