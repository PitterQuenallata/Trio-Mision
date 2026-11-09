import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../shared/components/ui/button';
import { pillToast } from '../../../shared/components/ui/pill-toast';
import { discografiaApi, type CancionGestion } from '../../../shared/api/domains/discografia';
import { CancionModal } from './cancion-modal';
import { PistaVentaModal } from './pista-venta-modal';

/** Lista de canciones de un lanzamiento: orden, edición y publicación por canción. */
export const Tracklist: React.FC<{ grupoId: string; albumId: string; canciones: CancionGestion[]; vendePistas: boolean }> = ({ grupoId, albumId, canciones, vendePistas }) => {
  const queryClient = useQueryClient();
  const [ocupado, setOcupado] = useState(false);
  const [editando, setEditando] = useState<CancionGestion | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [pistaDe, setPistaDe] = useState<CancionGestion | null>(null);

  const refrescar = () => queryClient.invalidateQueries({ queryKey: ['discografia', grupoId] });

  const mover = async (indice: number, direccion: -1 | 1) => {
    const destino = indice + direccion;
    if (destino < 0 || destino >= canciones.length) return;
    const ids = canciones.map((c) => c.id);
    [ids[indice], ids[destino]] = [ids[destino], ids[indice]];
    setOcupado(true);
    try {
      await discografiaApi.ordenarCanciones(grupoId, albumId, ids);
      await refrescar();
    } catch (err) {
      pillToast.error('No se pudo reordenar', err instanceof Error ? err.message : undefined);
    } finally {
      setOcupado(false);
    }
  };

  const publicar = async (c: CancionGestion) => {
    setOcupado(true);
    try {
      await discografiaApi.actualizarCancion(grupoId, c.id, { publicada: !c.publicado });
      pillToast.success(c.publicado ? 'Canción en borrador' : 'Canción publicada', c.titulo);
      await refrescar();
    } catch (err) {
      pillToast.error('No se pudo cambiar el estado', err instanceof Error ? err.message : undefined);
    } finally {
      setOcupado(false);
    }
  };

  if (canciones.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no hay canciones en este lanzamiento.</p>;
  }

  return (
    <>
      <ul className="divide-y divide-border/40 rounded-2xl border border-border/50">
        {canciones.map((c, i) => (
          <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="w-6 text-right font-mono text-xs text-muted-foreground">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{c.titulo}</p>
              <p className="text-xs text-muted-foreground">
                {c.tono ? `Tono ${c.tono}` : 'Sin tono'} · {c.acceso === 'premium' ? 'Premium' : 'Gratis'}
                {vendePistas && c.pista && ` · Pista a la venta: Bs ${(c.pista.precio_minor / 100).toFixed(2)}`}
              </p>
            </div>
            <span className={c.publicado ? 'text-xs text-emerald-500' : 'text-xs text-muted-foreground'}>
              {c.publicado ? 'Publicada' : 'Borrador'}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" disabled={ocupado || i === 0} onClick={() => void mover(i, -1)} aria-label="Subir">↑</Button>
              <Button variant="ghost" size="sm" disabled={ocupado || i === canciones.length - 1} onClick={() => void mover(i, 1)} aria-label="Bajar">↓</Button>
              <Button variant="outline" size="sm" disabled={ocupado} onClick={() => { setEditando(c); setAbierto(true); }}>Editar</Button>
              {vendePistas && (
                <Button variant="outline" size="sm" disabled={ocupado} onClick={() => setPistaDe(c)}>
                  {c.pista ? 'Pista' : 'Vincular pista'}
                </Button>
              )}
              <Button variant="outline" size="sm" disabled={ocupado} onClick={() => void publicar(c)}>
                {c.publicado ? 'Despublicar' : 'Publicar'}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {vendePistas && (
        <PistaVentaModal grupoId={grupoId} cancion={pistaDe} onClose={() => setPistaDe(null)} />
      )}
      <CancionModal
        grupoId={grupoId}
        albumId={albumId}
        cancion={editando}
        abierto={abierto}
        onClose={() => { setAbierto(false); setEditando(null); }}
        onGuardada={refrescar}
      />
    </>
  );
};

export default Tracklist;
