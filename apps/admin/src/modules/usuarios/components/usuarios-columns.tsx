import type { ColumnDef } from '@tanstack/react-table';
import type { UsuarioStaff } from '../../../shared/api/domains/usuarios';

const ROLE_LABEL: Record<string, string> = { admin: 'Admin', editor: 'Editor', vendedor: 'Vendedor' };

/** Columnas de la tabla de usuarios. `onGestionar` abre el panel de gestión del usuario. */
export const usuariosColumns = (onGestionar?: (usuario: UsuarioStaff) => void): ColumnDef<UsuarioStaff>[] => [
  {
    accessorKey: 'email',
    header: 'Correo',
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.email || '—'}</span>,
  },
  {
    accessorKey: 'display_name',
    header: 'Nombre',
    cell: ({ row }) => row.original.display_name || '—',
  },
  {
    id: 'roles',
    header: 'Roles staff',
    cell: ({ row }) =>
      row.original.staff_roles.length === 0 ? (
        <span className="text-xs text-muted-foreground">Sin rol</span>
      ) : (
        <div className="flex flex-wrap gap-1">
          {row.original.staff_roles.map((role) => (
            <span key={role} className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
              {ROLE_LABEL[role] ?? role}
            </span>
          ))}
        </div>
      ),
  },
  {
    id: 'membresias',
    header: 'Artistas',
    cell: ({ row }) => {
      const m = row.original.artist_memberships;
      if (m.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
      return m.map((x) => (x.role === 'manager' ? 'Manager' : 'Member')).join(', ');
    },
  },
  {
    accessorKey: 'created_at',
    header: 'Alta',
    cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString('es'),
  },
  ...(onGestionar
    ? [
        {
          id: 'gestionar',
          header: '',
          enableSorting: false,
          cell: ({ row }: { row: { original: UsuarioStaff } }) => (
            <button
              type="button"
              onClick={() => onGestionar(row.original)}
              className="rounded-lg border border-border/60 px-2.5 py-1 text-xs font-medium hover:bg-muted/70"
            >
              Gestionar
            </button>
          ),
        } satisfies ColumnDef<UsuarioStaff>,
      ]
    : []),
];
