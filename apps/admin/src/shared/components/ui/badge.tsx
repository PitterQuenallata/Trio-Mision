import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors select-none tabular-nums',
  {
    variants: {
      variant: {
        default:
          'bg-primary/10 text-primary border border-primary/20',
        secondary:
          'bg-secondary text-secondary-foreground border border-border/50',
        destructive:
          'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20',
        success:
          'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
        warning:
          'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
        blue:
          'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
        purple:
          'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20',
        outline:
          'text-foreground border border-border',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
