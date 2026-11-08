import React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { AuditLog } from '../types/auditoria.types';
import { DataTableColumnHeader } from '../../../shared/components/data-table/data-table-column-header';
import { Badge } from '../../../shared/components/ui/badge';
import { Button } from '../../../shared/components/ui/button';
import { Eye } from 'lucide-react';
import { cn } from '../../../shared/lib/utils';

export const getAuditoriaColumns = (
  onSelectLog: (log: AuditLog) => void
): ColumnDef<AuditLog>[] => [
  {
    accessorKey: 'severity',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Severidad" />,
    cell: ({ row }) => {
      const sev = row.getValue('severity') as 'low' | 'medium' | 'high';
      return (
        <Badge
          variant="outline"
          className={cn(
            'text-[10px] font-mono uppercase tracking-wider',
            sev === 'high' && 'border-rose-500/40 text-rose-500 bg-rose-500/10',
            sev === 'medium' && 'border-amber-500/40 text-amber-500 bg-amber-500/10',
            sev === 'low' && 'border-blue-500/40 text-blue-500 bg-blue-500/10'
          )}
        >
          {sev}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'action',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Acción" />,
    cell: ({ row }) => (
      <div>
        <span className="font-semibold text-foreground text-xs">{row.getValue('action')}</span>
        <p className="text-[10px] text-muted-foreground font-mono">{row.original.target}</p>
      </div>
    ),
  },
  {
    accessorKey: 'actor',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Actor" />,
    cell: ({ row }) => (
      <span className="font-medium text-foreground text-xs">{row.getValue('actor')}</span>
    ),
  },
  {
    accessorKey: 'ip',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Dirección IP" />,
    cell: ({ row }) => (
      <code className="bg-muted px-2 py-0.5 rounded font-mono text-[11px] text-muted-foreground">
        {row.getValue('ip')}
      </code>
    ),
  },
  {
    accessorKey: 'timestamp',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Fecha & Hora" />,
    cell: ({ row }) => (
      <span className="font-mono text-xs tabular-nums text-muted-foreground">
        {row.getValue('timestamp')}
      </span>
    ),
  },
  {
    id: 'actions',
    header: () => <span className="text-right block">Detalle</span>,
    cell: ({ row }) => (
      <div className="text-right">
        <Button
          variant="ghost"
          size="iconSm"
          onClick={() => onSelectLog(row.original)}
          title="Ver registro completo"
        >
          <Eye className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
        </Button>
      </div>
    ),
  },
];
