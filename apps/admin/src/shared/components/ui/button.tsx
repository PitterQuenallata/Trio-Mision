import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { sound } from '../../lib/sound';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98] select-none cursor-pointer',
  {
    variants: {
      variant: {
        default:
          'bg-primary bg-[linear-gradient(180deg,rgba(255,255,255,0.18)_0%,rgba(255,255,255,0)_60%)] text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_1px_2px_rgba(17,17,17,0.08)] hover:opacity-95 active:opacity-100',
        destructive:
          'bg-destructive bg-[linear-gradient(180deg,rgba(255,255,255,0.15)_0%,rgba(255,255,255,0)_60%)] text-destructive-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_1px_2px_rgba(17,17,17,0.08)] hover:opacity-95',
        outline:
          'border border-border/80 bg-background/50 hover:bg-muted/80 text-foreground',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border/40',
        ghost:
          'hover:bg-muted/70 text-foreground',
        link:
          'text-primary underline-offset-4 hover:underline p-0 h-auto',
        glass:
          'liquid-glass text-foreground hover:bg-white/90 dark:hover:bg-slate-800/90 shadow-sm',
        gradientBlue:
          'bg-gradient-to-b from-[#0A84FF] via-[#007AFF] to-[#0062D2] text-white border border-[#0062D2]/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.38),0_2px_4px_rgba(0,122,255,0.25)] hover:brightness-105 active:brightness-95',
        gradientDark:
          'bg-gradient-to-b from-[#2C2C2E] via-[#222224] to-[#1C1C1E] text-white border border-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_2px_6px_rgba(0,0,0,0.35)] hover:from-[#343438] hover:to-[#222224] active:brightness-95',
        gradientSurface:
          'bg-gradient-to-b from-white via-[#FBFBFD] to-[#F2F2F7] dark:from-[#2C2C2E] dark:via-[#242426] dark:to-[#1C1C1E] text-foreground border border-black/10 dark:border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_1px_2px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_1px_3px_rgba(0,0,0,0.3)] hover:brightness-98 dark:hover:brightness-110 active:brightness-95',
        gradientEmerald:
          'bg-gradient-to-b from-[#34C759] via-[#30D158] to-[#28B048] text-white border border-[#28B048]/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.38),0_2px_4px_rgba(48,209,88,0.25)] hover:brightness-105 active:brightness-95',
        gradientAmber:
          'bg-gradient-to-b from-[#FF9F0A] via-[#FF9500] to-[#E08200] text-white border border-[#E08200]/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.38),0_2px_4px_rgba(255,149,0,0.25)] hover:brightness-105 active:brightness-95',
        gradientPurple:
          'bg-gradient-to-b from-[#BF5AF2] via-[#AF52DE] to-[#9A42C8] text-white border border-[#9A42C8]/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.38),0_2px_4px_rgba(175,82,222,0.25)] hover:brightness-105 active:brightness-95',
        gradientRose:
          'bg-gradient-to-b from-[#FF375F] via-[#FF2D55] to-[#E02447] text-white border border-[#E02447]/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.38),0_2px_4px_rgba(255,45,85,0.25)] hover:brightness-105 active:brightness-95',
        glassGlow:
          'backdrop-blur-xl bg-gradient-to-b from-white/25 via-white/12 to-white/5 dark:from-white/12 dark:via-white/6 dark:to-white/2 border border-white/30 dark:border-white/15 text-foreground shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_2px_8px_rgba(0,0,0,0.06)] hover:bg-white/35 dark:hover:bg-white/18 active:scale-[0.98]',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-lg px-3 text-xs',
        lg: 'h-11 rounded-xl px-6 text-base font-semibold',
        pill: 'h-9 px-5 rounded-full text-xs font-semibold',
        icon: 'h-9 w-9 rounded-xl',
        iconSm: 'h-7 w-7 rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  soundType?: 'click' | 'pop' | 'tab' | 'toggle' | 'success' | 'alert' | 'none';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, soundType = 'click', onClick, ...props }, ref) => {
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (soundType !== 'none') {
        sound.play(soundType);
      }
      onClick?.(e);
    };

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        onClick={handleClick}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
