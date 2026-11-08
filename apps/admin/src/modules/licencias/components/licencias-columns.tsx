import React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { License } from '../types/licencias.types';
import { DataTableColumnHeader } from '../../../shared/components/data-table/data-table-column-header';
import { Badge } from '../../../shared/components/ui/badge';
import { Button } from '../../../shared/components/ui/button';
import { Copy, CheckCircle2 } from 'lucide-react';
import { pillToast } from '../../../shared/components/ui/pill-toast';

export const getLicenciasColumns = (
  copiedId: string | null,
  handleCopy: (id: string, key: string) => void
): ColumnDef<License>[] => [
  {
    accessorKey: 'client',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Cliente" />,
    cell: ({ row }) => (
      <div className="font-semibold text-foreground text-xs leading-tight">
        {row.getValue('client')}
      </div>
    ),
  },
  {
    accessorKey: 'tier',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Nivel de Plan" />,
    cell: ({ row }) => (
      <Badge variant="outline" className="text-[11px] font-mono">
        {row.getValue('tier')}
      </Badge>
    ),
  },
  {
    accessorKey: 'key',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Clave de Licencia" />,
    cell: ({ row }) => {
      const lic = row.original;
      const isCopied = copiedId === lic.id;
      return (
        <div className="flex items-center gap-2">
          <code className="bg-muted px-2 py-0.5 rounded font-mono text-[11px] text-foreground">
            {lic.key}
          </code>
          <Button
            variant="ghost"
            size="iconSm"
            soundType="none"
            onClick={() => handleCopy(lic.id, lic.key)}
            title="Copiar clave criptográfica"
          >
            {isCopied ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            )}
          </Button>
        </div>
      );
    },
  },
  {
    accessorKey: 'seats',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Asientos Asignados" />,
    cell: ({ row }) => (
      <span className="font-mono text-xs tabular-nums text-muted-foreground">
        {row.getValue('seats')}
      </span>
    ),
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
    cell: ({ row }) => {
      const status = row.getValue('status') as string;
      const variant =
        status === 'Activa'
          ? 'success'
          : status.includes('Vencer')
          ? 'warning'
          : 'destructive';
      return (
        <Badge variant={variant} className="text-[11px]">
          {status}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'expiresAt',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Vencimiento" />,
    cell: ({ row }) => (
      <span className="font-mono text-xs tabular-nums text-muted-foreground">
        {row.getValue('expiresAt')}
      </span>
    ),
  },
];
