import React, { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../shared/components/ui/button';
import { pillToast } from '../../../shared/components/ui/pill-toast';
import { Spinner } from '../../../components/ui/ios-spinner';
import { discografiaApi, etiquetaTipo } from '../../../shared/api/domains/discografia';
import { Tracklist } from '../components/tracklist';
import { CancionModal } from '../components/cancion-modal';
import { EditarLanzamientoModal } from '../components/editar-lanzamiento-modal';

/** Página de un lanzamiento: portada, datos y lista de canciones (estilo Spotify). */
export const AlbumPage: React.FC<{ grupoId: string; albumId: string; modo?: 'admin' | 'manager' }> = ({
  grupoId,
  albumId,
  modo = 'admin',
}) => {
  const queryClient = useQueryClient();
  const esManager = modo === 'manager';
  const [editandoDatos, setEditandoDatos] = useState(false);
  const [nuevaCancion, setNuevaCancion] = useState(false);

  const discografia = useQuery({
    queryKey: ['discografia', grupoId],
    queryFn: () => discografiaApi.obtener(grupoId),
  });

  if (discografia.isPending) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner size="sm" /> Cargando lanzamiento…</div>;
  }
  const album = discografia.data?.albumes.find((a) => a.id === albumId);
  if (discografia.isError || !album) {
    return (
      <div className="space-y-3">
        <p role="alert" className="text-sm text-red-400">No se encontró el lanzamiento.</p>
        {esManager ? (
          <Link to="/mi-grupo/$grupoId" params={{ grupoId }} className="text-sm underline">Volver a mi grupo</Link>
        ) : (
          <Link to="/grupos/$grupoId" params={{ grupoId }} className="text-sm underline">Volver al grupo</Link>
        )}
      </div>
    );
  }

  const cambiarPublicacion = async () => {
    try {
      await discografiaApi.actualizarLanzamiento(grupoId, album.id, { publicado: !album.publicado });
      pillToast.success(album.publicado ? 'Lanzamiento en borrador' : 'Lanzamiento publicado', album.titulo);
      await queryClient.invalidateQueries({ queryKey: ['discografia', grupoId] });
    } catch (err) {
      pillToast.error('No se pudo cambiar el estado', err instanceof Error ? err.message : undefined);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {esManager ? (
        <Link to="/mi-grupo/$grupoId" params={{ grupoId }} className="text-xs text-muted-foreground hover:underline">
          ← Mi grupo
        </Link>
      ) : (
        <Link to="/grupos/$grupoId" params={{ grupoId }} className="text-xs text-muted-foreground hover:underline">
          ← {discografia.data?.nombre ?? 'Grupo'}
        </Link>
      )}

      <header className="flex flex-col gap-6 md:flex-row md:items-end">
        <div className="h-48 w-48 shrink-0 overflow-hidden rounded-2xl border border-border/50 bg-muted/40 shadow-sm">
          {album.cover_url ? (
            <img src={album.cover_url} alt={album.titulo} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">Sin portada</div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{etiquetaTipo[album.tipo]}</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">{album.titulo}</h1>
          <p className="text-sm text-muted-foreground">
            {discografia.data?.nombre}
            {album.anio ? ` · ${album.anio}` : ''} · {album.canciones.length} {album.canciones.length === 1 ? 'canción' : 'canciones'}
            {' · '}
            <span className={album.publicado ? 'text-emerald-500' : ''}>{album.publicado ? 'Publicado' : 'Borrador'}</span>
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditandoDatos(true)}>Editar datos</Button>
            <Button variant="outline" onClick={() => void cambiarPublicacion()}>
              {album.publicado ? 'Pasar a borrador' : 'Publicar'}
            </Button>
            <Button onClick={() => setNuevaCancion(true)}>Agregar canción</Button>
          </div>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Canciones</h2>
        <Tracklist grupoId={grupoId} albumId={album.id} canciones={album.canciones} vendePistas={discografia.data?.vende_pistas ?? false} />
      </section>

      <EditarLanzamientoModal
        grupoId={grupoId}
        lanzamiento={editandoDatos ? album : null}
        onClose={() => setEditandoDatos(false)}
      />
      <CancionModal
        grupoId={grupoId}
        albumId={album.id}
        cancion={null}
        abierto={nuevaCancion}
        onClose={() => setNuevaCancion(false)}
        onGuardada={() => queryClient.invalidateQueries({ queryKey: ['discografia', grupoId] })}
      />
    </div>
  );
};

export default AlbumPage;
