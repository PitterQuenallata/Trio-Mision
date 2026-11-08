import { ColumnDef } from '@tanstack/react-table';
import { Usuario } from '../types/usuarios.types';
import { DataTableColumnHeader } from '../../../shared/components/data-table/data-table-column-header';
import { Badge } from '../../../shared/components/ui/badge';
import { Button } from '../../../shared/components/ui/button';
import { MoreHorizontal, Edit2, Trash2 } from 'lucide-react';

export const usuariosColumns: ColumnDef<Usuario>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Usuario / Nombre" />,
    cell: ({ row }) => {
      const user = row.original;
      return (
        <div className="flex items-center gap-3">
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.name}
              className="h-9 w-9 rounded-xl object-cover border border-border shrink-0"
            />
          ) : (
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary font-semibold flex items-center justify-center text-xs shrink-0">
              {user.avatarText}
            </div>
          )}
          <div>
            <div className="font-semibold text-foreground text-xs leading-tight">{user.name}</div>
            <div className="text-[11px] text-muted-foreground font-mono">{user.email}</div>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: 'role',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Rol" />,
    cell: ({ row }) => {
      const role = row.getValue('role') as string;
      return (
        <span className="font-medium text-foreground">
          {role}
        </span>
      );
    },
  },
  {
    accessorKey: 'subscription',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Plan SaaS" />,
    cell: ({ row }) => {
      return (
        <Badge variant="blue" className="text-[11px]">
          {row.getValue('subscription')}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
    cell: ({ row }) => {
      const status = row.getValue('status') as string;
      return (
        <Badge
          variant={
            status === 'Activo'
              ? 'success'
              : status === 'Pendiente'
              ? 'warning'
              : 'secondary'
          }
        >
          {status}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'joinedAt',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Fecha Registro" />,
    cell: ({ row }) => {
      return <span className="text-muted-foreground font-mono text-[11px]">{row.getValue('joinedAt')}</span>;
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      return (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="iconSm" soundType="click" title="Editar">
            <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="iconSm" soundType="alert" title="Eliminar">
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      );
    },
  },
];
