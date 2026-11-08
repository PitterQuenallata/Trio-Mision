import { Column } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

interface DataTableColumnHeaderProps<TData, TValue>
  extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>;
  title: string;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <div className={cn('text-xs font-semibold text-muted-foreground uppercase tracking-wider', className)}>{title}</div>;
  }

  const isSorted = column.getIsSorted();

  return (
    <div className={cn('flex items-center space-x-1', className)}>
      <Button
        variant="ghost"
        size="sm"
        soundType="click"
        onClick={() => column.toggleSorting(isSorted === 'asc')}
        className="-ml-3 h-8 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground data-[state=open]:bg-accent"
      >
        <span>{title}</span>
        {isSorted === 'desc' ? (
          <ArrowDown className="ml-1.5 h-3.5 w-3.5 text-primary" />
        ) : isSorted === 'asc' ? (
          <ArrowUp className="ml-1.5 h-3.5 w-3.5 text-primary" />
        ) : (
          <ChevronsUpDown className="ml-1.5 h-3 w-3 opacity-60" />
        )}
      </Button>
    </div>
  );
}
