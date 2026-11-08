import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Spinner({ className, size = 'md', ...props }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label="Cargando"
      className={cn(
        'relative inline-block text-current shrink-0',
        size === 'sm' && 'h-3 w-3',
        size === 'md' && 'h-4 w-4',
        size === 'lg' && 'h-6 w-6',
        size === 'xl' && 'h-8 w-8',
        className
      )}
      {...props}
    >
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="spinner-blade" />
      ))}
      <span className="sr-only">Cargando...</span>
    </div>
  );
}

export function SpinnerDemo() {
  return (
    <div className="flex items-center gap-4">
      <Spinner size="sm" />
      <Spinner size="md" />
      <Spinner size="lg" />
      <Spinner size="xl" />
    </div>
  );
}

export { Spinner as IOSSpinner };
export default Spinner;
