import React from 'react';
import { Toaster as Sonner, toast } from 'sonner';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, Loader2 } from 'lucide-react';
import { useTheme } from '../../context/theme-context';
import { sound } from '../../lib/sound';

export interface SonnerToasterProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
  richColors?: boolean;
  expand?: boolean;
}

export const SonnerToaster: React.FC<SonnerToasterProps> = ({
  position = 'bottom-right',
  richColors = false,
  expand = true,
}) => {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      position={position}
      richColors={richColors}
      expand={expand}
      closeButton
      className="toaster font-sans"
      icons={{
        success: <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />,
        info: <Info className="h-4 w-4 text-blue-500 shrink-0" />,
        warning: <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />,
        error: <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />,
        loading: <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            'group toast rounded-2xl border border-border bg-card text-card-foreground shadow-lg px-4 py-3 text-xs flex items-center gap-3 font-sans',
          title: 'font-semibold text-foreground text-xs',
          description: 'text-muted-foreground text-[11px] leading-relaxed',
          actionButton:
            'bg-primary text-primary-foreground font-medium text-xs px-3 py-1.5 rounded-xl hover:opacity-90 transition-opacity cursor-pointer',
          cancelButton:
            'bg-secondary text-secondary-foreground font-medium text-xs px-3 py-1.5 rounded-xl hover:bg-secondary/80 transition-colors cursor-pointer',
          closeButton:
            'border-border bg-card text-muted-foreground hover:text-foreground rounded-full',
        },
      }}
    />
  );
};

/**
 * Helper to dispatch traditional sonner toasts with cuelume audio feedback
 */
export const sonnerNotify = {
  success: (title: string, options?: { description?: string; action?: { label: string; onClick: () => void } }) => {
    sound.play('success');
    return toast.success(title, options);
  },
  error: (title: string, options?: { description?: string; action?: { label: string; onClick: () => void } }) => {
    sound.play('alert');
    return toast.error(title, options);
  },
  warning: (title: string, options?: { description?: string; action?: { label: string; onClick: () => void } }) => {
    sound.play('alert');
    return toast.warning(title, options);
  },
  info: (title: string, options?: { description?: string; action?: { label: string; onClick: () => void } }) => {
    sound.play('pop');
    return toast.info(title, options);
  },
  promise: <T,>(
    promise: Promise<T>,
    data: {
      loading: string;
      success: (val: T) => string;
      error: (err: unknown) => string;
    }
  ) => {
    sound.play('click');
    return toast.promise(promise, {
      loading: data.loading,
      success: (val) => {
        sound.play('success');
        return data.success(val);
      },
      error: (err) => {
        sound.play('alert');
        return data.error(err);
      },
    });
  },
};

export { toast };
