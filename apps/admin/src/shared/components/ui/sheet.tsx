import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence, PanInfo } from 'motion/react';
import { Button } from './button';
import { useSound } from '../../context/sound-context';
import { cn } from '../../lib/utils';

export interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  detent?: 'sm' | 'md' | 'lg' | 'full';
  showGrabber?: boolean;
  showCloseButton?: boolean;
  className?: string;
}

const detentHeights = {
  sm: 'max-h-[45vh]',
  md: 'max-h-[65vh]',
  lg: 'max-h-[85vh]',
  full: 'max-h-[96vh]',
};

export const Sheet: React.FC<SheetProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  detent = 'md',
  showGrabber = true,
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

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 500) {
      play('click');
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
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

          {/* iOS Bottom Sheet Container: Solid Elevated Surface */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 350 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={handleDragEnd}
            className={cn(
              'relative z-10 w-full max-w-2xl mx-auto rounded-t-[32px] overflow-hidden flex flex-col',
              'bg-card text-card-foreground border-t border-x border-border',
              'shadow-[0_-10px_35px_rgba(0,0,0,0.14)] dark:shadow-[0_-12px_45px_rgba(0,0,0,0.7)]',
              detentHeights[detent],
              className
            )}
          >
            {/* Grabber indicator */}
            {showGrabber && (
              <div className="pt-3 pb-1 flex justify-center cursor-grab active:cursor-grabbing">
                <div className="w-10 h-1.5 rounded-full bg-muted-foreground/30 hover:bg-muted-foreground/50 transition-colors" />
              </div>
            )}

            {/* Header */}
            {(title || showCloseButton) && (
              <div className="flex items-center justify-between px-6 py-3 border-b border-border">
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
            <div className="p-6 overflow-y-auto flex-1">{children}</div>

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
