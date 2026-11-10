import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../shared/components/ui/button';
import { pillToast } from '../../../shared/components/ui/pill-toast';
import { Spinner } from '../../../components/ui/ios-spinner';
import { Badge } from '../../../components/ui/badge';
import {
  importacionesApi,
  etiquetaEstado,
  type CancionImportada,
  type EstadoImportacion,
} from '../../../shared/api/domains/importaciones';
import { EditorCancion } from './editor-cancion';

interface RevisionProps {
  importacionId: string;
  albumTitulo: string;
  onPublicada: () => void;
}

const ESTADOS_EN_CURSO: EstadoImportacion[] = ['queued', 'running'];

/**
 * Revisión de un PDF convertido. A la izquierda, la lista de canciones (clic para
 * abrir, casilla para publicar); a la derecha, el editor con vista previa.
 */
export const RevisionImportacion: React.FC<RevisionProps> = ({ importacionId, albumTitulo, onPublicada }) => {
  const queryClient = useQueryClient();
  const [activa, setActiva] = useState<number | null>(null);
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());
  const [precargada, setPrecargada] = useState(false);

  const job = useQuery({
    queryKey: ['importacion', importacionId],
    queryFn: () => importacionesApi.obtener(importacionId),
    refetchInterval: (q) => (q.state.data && ESTADOS_EN_CURSO.includes(q.state.data.estado as EstadoImportacion) ? 3000 : false),
  });

  const canciones = job.data?.canciones ?? [];
  const publicadas = new Set((job.data?.publicados ?? []).map((p) => p.indice));
  const listas = job.data?.estado === 'done';

  // Al terminar la conversión: se preselecciona lo "ok" sin publicar y se abre la primera que requiere revisión.
  useEffect(() => {
    if (!listas || precargada) return;
    setSeleccion(new Set(canciones.filter((c) => c.status === 'ok' && !publicadas.has(c.indice)).map((c) => c.indice)));
    const primera = canciones.find((c) => c.status === 'revisar') ?? canciones[0];
    setActiva(primera ? primera.indice : null);
    setPrecargada(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listas, precargada]);

  const publicar = useMutation({
    mutationFn: (indices: number[]) => importacionesApi.publicar(importacionId, indices),
    onSuccess: async (r) => {
      pillToast.success('Canciones publicadas', `${r.total_creados} al álbum ${albumTitulo}.`);
      await queryClient.invalidateQueries({ queryKey: ['importacion', importacionId] });
      onPublicada();
    },
    onError: (err) => pillToast.error('No se pudo publicar', err instanceof Error ? err.message : undefined),
  });

  const reintentar = useMutation({
    mutationFn: () => importacionesApi.reintentar(importacionId),
    onSuccess: async () => {
      pillToast.info('Reintentando', 'La conversión vuelve a la cola.');
      await queryClient.invalidateQueries({ queryKey: ['importacion', importacionId] });
    },
    onError: (err) => pillToast.error('No se pudo reintentar', err instanceof Error ? err.message : undefined),
  });

  const alternar = (indice: number) => {
    setSeleccion((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(indice)) siguiente.delete(indice);
      else siguiente.add(indice);
      return siguiente;
    });
  };

  if (job.isPending) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner size="sm" /> Cargando conversión…</div>;
  }
  if (job.isError) {
    return <p role="alert" className="text-sm text-red-400">No se pudo cargar la conversión.</p>;
  }

  const estado = job.data.estado as EstadoImportacion;
  const revisar = canciones.filter((c) => c.status === 'revisar').length;
  const oks = canciones.filter((c) => c.status === 'ok' && !publicadas.has(c.indice)).map((c) => c.indice);
  const cancionActiva: CancionImportada | undefined = canciones.find((c) => c.indice === activa);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {etiquetaEstado[estado]}
          {listas && ` · ${canciones.length} canciones · ${revisar} para revisar · ${publicadas.size} publicadas`}
          {job.data.pdf && (
            <>
              {' · '}
              <a href={job.data.pdf.url} target="_blank" rel="noreferrer" className="underline">Ver PDF original</a>
            </>
          )}
        </p>
        {listas && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={publicar.isPending || oks.length === 0} onClick={() => publicar.mutate(oks)}>
              Publicar las {oks.length} ok
            </Button>
            <Button
              disabled={publicar.isPending || seleccion.size === 0}
              onClick={() => publicar.mutate([...seleccion].sort((a, b) => a - b))}
            >
              {publicar.isPending ? <Spinner size="sm" /> : `Publicar seleccionadas (${seleccion.size})`}
            </Button>
          </div>
        )}
      </div>

      {(estado === 'queued' || estado === 'running') && (
        <div className="flex items-center gap-3 rounded-xl border border-border/50 p-4 text-sm">
          <Spinner size="sm" />
          <span>Convirtiendo el PDF… {job.data.progreso > 0 ? `${job.data.progreso} %` : ''}</span>
        </div>
      )}

      {estado === 'failed' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-400/40 p-4 text-sm">
          <span className="text-red-400">
            No se pudo convertir este PDF{job.data.error_code ? ` (${job.data.error_code})` : ''}.
          </span>
          <Button variant="outline" disabled={reintentar.isPending} onClick={() => reintentar.mutate()}>Reintentar</Button>
        </div>
      )}

      {listas && canciones.length === 0 && (
        <p className="text-sm text-muted-foreground">No se detectaron canciones en este PDF. Revisa que tenga texto (no sea escaneado).</p>
      )}

      {listas && canciones.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
          <ul className="max-h-[560px] divide-y divide-border/40 overflow-y-auto rounded-2xl border border-border/50">
            {canciones.map((c) => {
              const yaPublicada = publicadas.has(c.indice);
              const abierta = c.indice === activa;
              return (
                <li
                  key={c.indice}
                  className={'flex items-center gap-2 px-3 py-2 ' + (abierta ? 'bg-primary/10' : '')}
                >
                  <input
                    type="checkbox"
                    aria-label={`Seleccionar ${c.titulo}`}
                    className="h-4 w-4 shrink-0 accent-primary"
                    disabled={yaPublicada}
                    checked={yaPublicada || seleccion.has(c.indice)}
                    onChange={() => alternar(c.indice)}
                  />
                  <button
                    type="button"
                    onClick={() => setActiva(c.indice)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span className="w-6 shrink-0 text-right font-mono text-[11px] text-muted-foreground">{c.numero ?? '—'}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{c.titulo}</span>
                    {yaPublicada ? (
                      <Badge variant="default">Pub.</Badge>
                    ) : c.status === 'ok' ? null : (
                      <Badge variant="destructive">Revisar</Badge>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="min-w-0 rounded-2xl border border-border/50 bg-card/70 p-4">
            {cancionActiva ? (
              <EditorCancion
                key={`${cancionActiva.indice}-${cancionActiva.titulo}-${cancionActiva.status}`}
                importacionId={importacionId}
                cancion={cancionActiva}
                onGuardada={(indice) => {
                  // Una canción revisada queda seleccionada para publicar.
                  setSeleccion((prev) => new Set(prev).add(indice));
                  void queryClient.invalidateQueries({ queryKey: ['importacion', importacionId] });
                }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Elige una canción de la lista para revisarla.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RevisionImportacion;
