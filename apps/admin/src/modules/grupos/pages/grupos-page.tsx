import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { DataTable } from '../../../shared/components/data-table/data-table';
import { Button } from '../../../shared/components/ui/button';
import { Input } from '../../../shared/components/ui/input';
import { gruposApi, type GrupoItem } from '../../../shared/api/domains/grupos';
import { CrearGrupoModal } from '../components/crear-grupo-modal';

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export const GruposPage: React.FC = () => {
  const navigate = useNavigate();
  const [busqueda, setBusqueda] = useState('');
  const [creando, setCreando] = useState(false);
  const termino = useDebounced(busqueda.trim(), 300);

  const grupos = useQuery({
    queryKey: ['grupos', termino],
    queryFn: () => gruposApi.listar(termino),
    staleTime: 30_000,
  });

  const columnas = useMemo(
    () => [
      {
        accessorKey: 'nombre',
        header: 'Grupo',
        cell: ({ row }: { row: { original: GrupoItem } }) => (
          <button
            type="button"
            className="text-left font-medium hover:underline"
            onClick={() => void navigate({ to: '/grupos/$grupoId', params: { grupoId: row.original.id } })}
          >
            {row.original.nombre}
          </button>
        ),
      },
      {
        accessorKey: 'pais',
        header: 'País',
        cell: ({ row }: { row: { original: GrupoItem } }) => row.original.pais || '—',
      },
      {
        accessorKey: 'publicado',
        header: 'Estado',
        cell: ({ row }: { row: { original: GrupoItem } }) => (row.original.publicado ? 'Publicado' : 'Borrador'),
      },
      {
        accessorKey: 'vende_pistas',
        header: 'Vende pistas',
        cell: ({ row }: { row: { original: GrupoItem } }) =>
          row.original.vende_pistas ? `Sí · ${row.original.comision_pct ?? '—'} %` : 'No',
      },
      { accessorKey: 'albumes', header: 'Álbumes' },
      { accessorKey: 'managers', header: 'Managers' },
    ],
    [navigate]
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <header className="flex flex-col gap-4 border-b border-border/40 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Grupos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Grupos del catálogo: datos, álbumes, ventas y managers.</p>
        </div>
        <Button onClick={() => setCreando(true)}>Nuevo grupo</Button>
      </header>

      <Input
        placeholder="Buscar grupo por nombre…"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        className="max-w-sm"
      />

      {grupos.isPending && <p className="text-sm text-muted-foreground">Cargando grupos…</p>}
      {grupos.isError && (
        <p role="alert" className="text-sm text-red-400">
          No se pudieron cargar los grupos: {grupos.error instanceof Error ? grupos.error.message : 'error'}
        </p>
      )}
      {grupos.isSuccess && (
        <DataTable columns={columnas} data={grupos.data} enableExport={false} />
      )}

      <CrearGrupoModal
        isOpen={creando}
        onClose={() => setCreando(false)}
        onCreado={(grupo) => {
          setCreando(false);
          void navigate({ to: '/grupos/$grupoId', params: { grupoId: grupo.id } });
        }}
      />
    </div>
  );
};

export default GruposPage;
