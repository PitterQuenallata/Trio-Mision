import * as React from 'react';
import { cn } from '../../lib/utils';
import { sound } from '../../lib/sound';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onCheckedChange,
  disabled = false,
  className,
  id,
}) => {
  const handleClick = () => {
    if (disabled) return;
    sound.play('toggle');
    onCheckedChange(!checked);
  };

  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      disabled={disabled}
      onClick={handleClick}
      className={cn(
        'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 select-none',
        checked ? 'bg-primary' : 'bg-muted-foreground/30 dark:bg-muted-foreground/20',
        className
      )}
    >
      <span
        className={cn(
          'pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-out',
          checked ? 'translate-x-5' : 'translate-x-0'
        )}
      />
    </button>
  );
};
