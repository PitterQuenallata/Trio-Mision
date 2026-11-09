import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { artistasApi } from '../../../shared/api/domains/artistas';
import { ArtistaCard } from '../components/artista-card';

export const MiGrupoPage: React.FC = () => {
  const artistas = useQuery({ queryKey: ['mis-artistas'], queryFn: artistasApi.listarMios });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <header className="border-b border-border/40 pb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Mi grupo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Artistas que administras. Por ahora solo lectura: la edición del catálogo se conecta en la siguiente etapa.
        </p>
      </header>

      {artistas.isPending && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {artistas.isError && (
        <p role="alert" className="text-sm text-red-400">
          No se pudieron cargar tus artistas: {artistas.error instanceof Error ? artistas.error.message : 'error'}
        </p>
      )}
      {artistas.isSuccess && (artistas.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No administras ningún artista. Pide al administrador que te vincule como manager.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {artistas.data.map((a) => (
            <ArtistaCard key={a.id} artista={a} />
          ))}
        </div>
      ))}
    </div>
  );
};

export default MiGrupoPage;
