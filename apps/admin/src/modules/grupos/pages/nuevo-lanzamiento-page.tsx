import React, { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../shared/components/ui/button';
import { Input } from '../../../shared/components/ui/input';
import { pillToast } from '../../../shared/components/ui/pill-toast';
import { Spinner } from '../../../components/ui/ios-spinner';
import { discografiaApi, etiquetaTipo, type TipoLanzamiento } from '../../../shared/api/domains/discografia';
import { PortadaInput } from '../components/portada-input';
import { Tracklist } from '../components/tracklist';
import { CancionModal } from '../components/cancion-modal';

const TIPOS: TipoLanzamiento[] = ['album', 'ep', 'sencillo'];
const PASOS = ['Datos', 'Canciones', 'Publicar'] as const;

/** Asistente para crear un lanzamiento: datos, canciones y publicación. */
export const NuevoLanzamientoPage: React.FC<{ grupoId: string; modo?: 'admin' | 'manager' }> = ({ grupoId, modo = 'admin' }) => {
  const navigate = useNavigate();
  const esManager = modo === 'manager';
  const queryClient = useQueryClient();
  const [paso, setPaso] = useState(0);
  const [tipo, setTipo] = useState<TipoLanzamiento>('album');
  const [titulo, setTitulo] = useState('');
  const [anio, setAnio] = useState('');
  const [portada, setPortada] = useState<string | undefined>(undefined);
  const [albumId, setAlbumId] = useState<string | null>(null);
  const [nuevaCancion, setNuevaCancion] = useState(false);
  const [creando, setCreando] = useState(false);

  // Con el lanzamiento creado, sus canciones se leen desde la discografía.
  const discografia = useQuery({
    queryKey: ['discografia', grupoId],
    queryFn: () => discografiaApi.obtener(grupoId),
    enabled: albumId !== null,
  });
  const album = albumId ? discografia.data?.albumes.find((a) => a.id === albumId) : undefined;

  const crearDatos = async () => {
    if (!titulo.trim()) return pillToast.error('Falta el título', 'Escribe el nombre del lanzamiento.');
    setCreando(true);
    try {
      const creado = await discografiaApi.crearLanzamiento(grupoId, {
        titulo: titulo.trim(),
        tipo,
        anio: anio ? Number(anio) : undefined,
        cover_key: portada,
      });
      setAlbumId(creado.id);
      setPaso(1);
    } catch (err) {
      pillToast.error('No se pudo crear el lanzamiento', err instanceof Error ? err.message : undefined);
    } finally {
      setCreando(false);
    }
  };

  const publicar = async (publicado: boolean) => {
    if (!albumId) return;
    try {
      await discografiaApi.actualizarLanzamiento(grupoId, albumId, { publicado });
      await queryClient.invalidateQueries({ queryKey: ['discografia', grupoId] });
      pillToast.success(publicado ? 'Lanzamiento publicado' : 'Guardado como borrador', titulo.trim());
      void navigate(
        esManager
          ? { to: '/mi-grupo/$grupoId/albumes/$albumId', params: { grupoId, albumId } }
          : { to: '/grupos/$grupoId/albumes/$albumId', params: { grupoId, albumId } },
      );
    } catch (err) {
      pillToast.error('No se pudo guardar', err instanceof Error ? err.message : undefined);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 animate-in fade-in duration-300">
      {esManager ? (
        <Link to="/mi-grupo/$grupoId" params={{ grupoId }} className="text-xs text-muted-foreground hover:underline">← Mi grupo</Link>
      ) : (
        <Link to="/grupos/$grupoId" params={{ grupoId }} className="text-xs text-muted-foreground hover:underline">← Grupo</Link>
      )}
      <header className="space-y-4 border-b border-border/40 pb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Nuevo lanzamiento</h1>
        <ol className="flex flex-wrap gap-2">
          {PASOS.map((p, i) => (
            <li
              key={p}
              className={
                'rounded-full px-3 py-1 text-xs font-medium ' +
                (i === paso ? 'bg-primary text-primary-foreground' : i < paso ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground')
              }
            >
              {i + 1}. {p}
            </li>
          ))}
        </ol>
      </header>

      {paso === 0 && (
        <section className="grid gap-6 md:grid-cols-[1fr_220px]">
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Tipo</p>
              <div className="flex gap-2">
                {TIPOS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTipo(t)}
                    className={
                      'rounded-xl border px-4 py-1.5 text-sm font-medium transition-colors ' +
                      (tipo === t ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 text-muted-foreground hover:bg-muted/60')
                    }
                  >
                    {etiquetaTipo[t]}
                  </button>
                ))}
              </div>
              {tipo === 'sencillo' && (
                <p className="text-xs text-muted-foreground">Un sencillo es un lanzamiento de una sola canción.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="nl-titulo" className="text-xs font-medium text-muted-foreground">Título</label>
              <Input id="nl-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="nl-anio" className="text-xs font-medium text-muted-foreground">Año</label>
              <Input id="nl-anio" inputMode="numeric" placeholder="2026" value={anio} onChange={(e) => setAnio(e.target.value)} className="max-w-[10rem]" />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Portada</p>
            <PortadaInput tipo="album" onSubida={setPortada} />
          </div>
          <div className="flex justify-end md:col-span-2">
            <Button onClick={() => void crearDatos()} disabled={creando}>
              {creando ? <Spinner size="sm" /> : 'Continuar'}
            </Button>
          </div>
        </section>
      )}

      {paso === 1 && albumId && (
        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {titulo} · {etiquetaTipo[tipo]} · {album?.canciones.length ?? 0} {(album?.canciones.length ?? 0) === 1 ? 'canción' : 'canciones'}
            </p>
            <Button onClick={() => setNuevaCancion(true)}>Agregar canción</Button>
          </div>
          {discografia.isPending ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner size="sm" /> Cargando…</div>
          ) : (
            <Tracklist grupoId={grupoId} albumId={albumId} canciones={album?.canciones ?? []} vendePistas={discografia.data?.vende_pistas ?? false} />
          )}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setPaso(0)}>Atrás</Button>
            <Button onClick={() => setPaso(2)}>Siguiente</Button>
          </div>
          <CancionModal
            grupoId={grupoId}
            albumId={albumId}
            cancion={null}
            abierto={nuevaCancion}
            onClose={() => setNuevaCancion(false)}
            onGuardada={() => queryClient.invalidateQueries({ queryKey: ['discografia', grupoId] })}
          />
        </section>
      )}

      {paso === 2 && albumId && (
        <section className="space-y-6">
          <div className="rounded-2xl border border-border/50 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{etiquetaTipo[tipo]}</p>
            <p className="mt-1 text-xl font-semibold">{titulo}</p>
            <p className="text-sm text-muted-foreground">
              {album?.canciones.length ?? 0} {(album?.canciones.length ?? 0) === 1 ? 'canción' : 'canciones'}
              {(album?.canciones.length ?? 0) === 0 && ' · todavía no tiene canciones'}
            </p>
          </div>
          <div className="flex flex-wrap justify-between gap-3">
            <Button variant="outline" onClick={() => setPaso(1)}>Atrás</Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void publicar(false)}>Guardar como borrador</Button>
              <Button onClick={() => void publicar(true)}>Publicar lanzamiento</Button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default NuevoLanzamientoPage;
