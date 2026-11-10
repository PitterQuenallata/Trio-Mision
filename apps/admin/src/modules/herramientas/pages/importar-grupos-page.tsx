import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Plus, FileUp } from 'lucide-react';
import { Button } from '../../../shared/components/ui/button';
import { Modal } from '../../../shared/components/ui/modal';
import { Input } from '../../../shared/components/ui/input';
import { pillToast } from '../../../shared/components/ui/pill-toast';
import { Spinner } from '../../../components/ui/ios-spinner';
import { cn } from '../../../shared/lib/utils';
import { type GrupoItem } from '../../../shared/api/domains/grupos';
import { discografiaApi, etiquetaTipo, type AlbumGestion, type TipoLanzamiento } from '../../../shared/api/domains/discografia';
import { importacionesApi } from '../../../shared/api/domains/importaciones';
import { RevisionImportacion } from '../components/revision-importacion';
import { BuscadorGrupos } from '../components/buscador-grupos';

const MAX_PDF_BYTES = 20 * 1024 * 1024;

const VISTAS = [
  { id: 'grupo', titulo: 'Elige el grupo', descripcion: 'Busca por nombre y selecciona' },
  { id: 'album', titulo: 'Elige el álbum', descripcion: '' },
  { id: 'pdf', titulo: 'Sube el PDF', descripcion: '' },
  { id: 'revision', titulo: 'Revisa y publica', descripcion: '' },
] as const;

// Curva de resorte tipo iOS para el desplazamiento del carrusel.
const RESORTE = '[transition-timing-function:cubic-bezier(0.32,0.72,0,1)]';

/**
 * Subir el PDF de un álbum de grupo como recorrido de cuatro vistas: grupo →
 * álbum → PDF → revisión. El progreso vive dentro de la tarjeta (segmentos
 * clicables para volver a una vista ya completada) y cada selección avanza
 * sola a la siguiente vista. Al publicar, la vista se limpia para subir el
 * siguiente PDF.
 */
export const ImportarGruposPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [vista, setVista] = useState(0);
  const [grupo, setGrupo] = useState<GrupoItem | null>(null);
  const [album, setAlbum] = useState<AlbumGestion | null>(null);
  const [archivoNombre, setArchivoNombre] = useState('');
  const [importacionId, setImportacionId] = useState<string | null>(null);
  const [creandoAlbum, setCreandoAlbum] = useState(false);

  const discografia = useQuery({
    queryKey: ['discografia', grupo?.id],
    queryFn: () => discografiaApi.obtener(grupo!.id),
    enabled: grupo !== null,
  });
  const albumes = discografia.data?.albumes ?? [];

  // Una vista se alcanza solo si la anterior está completa.
  const completa = [grupo !== null, album !== null, importacionId !== null];
  const alcanzable = (i: number) => i === 0 || completa.slice(0, i).every(Boolean);

  const ir = (i: number) => {
    if (alcanzable(i)) setVista(i);
  };

  const elegirGrupo = (g: GrupoItem) => {
    if (grupo?.id !== g.id) {
      setAlbum(null);
      setImportacionId(null);
      setArchivoNombre('');
    }
    setGrupo(g);
    setVista(1);
  };

  const elegirAlbum = (a: AlbumGestion) => {
    if (album?.id !== a.id) {
      setImportacionId(null);
      setArchivoNombre('');
    }
    setAlbum(a);
    setVista(2);
  };

  const subir = useMutation({
    mutationFn: (archivo: File) => {
      // Misma clave para el mismo archivo y álbum: un reenvío no duplica el job.
      const clave = `pdf-${album!.id}-${archivo.size}-${archivo.lastModified}`.slice(0, 128);
      return importacionesApi.subirPdfAlbum(archivo, grupo!.id, album!.id, clave);
    },
    onSuccess: (job) => {
      setImportacionId(job.id);
      setVista(3);
      pillToast.success('PDF recibido', 'Se está convirtiendo a ChordPro.');
    },
    onError: (err) => pillToast.error('No se pudo subir el PDF', err instanceof Error ? err.message : undefined),
  });

  const elegirArchivo = (archivo: File | undefined) => {
    if (!archivo) return;
    if (!/\.pdf$/i.test(archivo.name) && archivo.type !== 'application/pdf') {
      return pillToast.error('Formato no admitido', 'Sube un archivo PDF.');
    }
    if (archivo.size > MAX_PDF_BYTES) {
      return pillToast.error('Archivo muy grande', 'El máximo es 20 MB.');
    }
    setArchivoNombre(archivo.name);
    subir.mutate(archivo);
  };

  // Publicado: se limpia la revisión y se vuelve a la vista del PDF, lista para el siguiente.
  const alPublicar = () => {
    setImportacionId(null);
    setArchivoNombre('');
    void queryClient.invalidateQueries({ queryKey: ['discografia', grupo?.id] });
    setVista(2);
  };

  // Contexto del paso actual: en la primera vista es una guía; después, la ruta elegida.
  const contexto =
    vista === 0
      ? VISTAS[0].descripcion
      : [grupo?.nombre, vista >= 2 ? album?.titulo : undefined].filter(Boolean).join(' · ');

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <header className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Subir álbum de grupo</h1>
        <p className="text-sm text-muted-foreground">
          Convierte el PDF con la letra y los acordes en canciones listas para publicar.
        </p>
      </header>

      {/* Tarjeta del recorrido: el progreso vive dentro, en el encabezado. */}
      <div className="overflow-hidden rounded-[28px] border border-border/40 bg-card/70 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_12px_32px_-12px_rgba(0,0,0,0.18)] backdrop-blur-xl">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-border/40 px-4 py-3.5 sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Volver al paso anterior"
            disabled={vista === 0}
            onClick={() => setVista((v) => Math.max(0, v - 1))}
            className="rounded-full"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          <div className="min-w-0 text-center">
            <p className="truncate text-sm font-semibold tracking-tight">{VISTAS[vista].titulo}</p>
            <p className="truncate text-xs text-muted-foreground">
              Paso {vista + 1} de {VISTAS.length}{contexto && ` · ${contexto}`}
            </p>
          </div>

          {/* Segmentos de progreso: los pasos alcanzables se pueden tocar para volver. */}
          <div className="flex items-center gap-1.5" role="navigation" aria-label="Pasos">
            {VISTAS.map((v, i) => {
              const activa = vista === i;
              const bloqueada = !alcanzable(i);
              return (
                <button
                  key={v.id}
                  type="button"
                  disabled={bloqueada}
                  onClick={() => ir(i)}
                  aria-label={v.titulo}
                  aria-current={activa ? 'step' : undefined}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    activa ? 'w-7 bg-primary' : 'w-1.5',
                    !activa && !bloqueada && 'bg-primary/45 hover:bg-primary/70',
                    bloqueada && 'cursor-not-allowed bg-muted-foreground/20',
                  )}
                />
              );
            })}
          </div>
        </div>

        {/* Carrusel: cada vista ocupa el ancho completo y se desliza hacia la izquierda. */}
        <div
          className={cn('flex items-start transition-transform duration-500', RESORTE)}
          style={{ transform: `translateX(-${vista * 100}%)` }}
        >
          <Vista activa={vista === 0}>
            <BuscadorGrupos seleccionadoId={grupo?.id ?? ''} onElegir={elegirGrupo} />
          </Vista>

          <Vista activa={vista === 1}>
            {grupo && (
              <div className="space-y-5">
                {discografia.isPending ? (
                  <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                    <Spinner size="sm" /> Cargando álbumes…
                  </div>
                ) : (
                  <div className="-mx-2 flex snap-x gap-4 overflow-x-auto px-2 pb-3 pt-1">
                    {albumes.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => elegirAlbum(a)}
                        className="group w-40 shrink-0 snap-start text-left sm:w-48"
                      >
                        <div className={cn(
                          'aspect-square overflow-hidden rounded-2xl border bg-muted/40 shadow-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-lg',
                          album?.id === a.id ? 'border-primary ring-2 ring-primary/40' : 'border-border/50',
                        )}>
                          {a.cover_url ? (
                            <img src={a.cover_url} alt={a.titulo} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center p-3 text-center text-xs text-muted-foreground">
                              {a.titulo}
                            </div>
                          )}
                        </div>
                        <p className="mt-2 truncate text-sm font-medium">{a.titulo}</p>
                        <p className="text-xs text-muted-foreground">
                          {etiquetaTipo[a.tipo]} · {a.canciones.length} canciones
                        </p>
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => setCreandoAlbum(true)}
                      className="flex aspect-square w-40 shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border/60 text-sm text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground sm:w-48"
                    >
                      <Plus className="h-6 w-6" />
                      Nuevo álbum
                    </button>
                  </div>
                )}
                {!discografia.isPending && albumes.length === 0 && (
                  <p className="text-sm text-muted-foreground">Este grupo todavía no tiene álbumes. Crea el primero.</p>
                )}
              </div>
            )}
          </Vista>

          <Vista activa={vista === 2}>
            {album && (
              <div className="mx-auto flex max-w-xl flex-col items-center gap-6 py-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  {subir.isPending ? <Spinner size="md" /> : <FileUp className="h-7 w-7 text-primary" />}
                </div>
                <label className="flex w-full cursor-pointer flex-col items-center gap-2.5 rounded-3xl border-2 border-dashed border-border/60 px-8 py-12 transition-colors hover:border-primary/60 hover:bg-muted/30">
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    className="sr-only"
                    disabled={subir.isPending}
                    onChange={(e) => {
                      elegirArchivo(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                  <span className="text-base font-semibold">{subir.isPending ? 'Subiendo…' : 'Elegir PDF'}</span>
                  <span className="text-xs text-muted-foreground">PDF con texto (no escaneado), máx. 20 MB</span>
                </label>
              </div>
            )}
          </Vista>

          <Vista activa={vista === 3}>
            {importacionId && album && (
              <div className="space-y-4">
                {archivoNombre && (
                  <p className="text-xs text-muted-foreground">Archivo: <span className="text-foreground">{archivoNombre}</span></p>
                )}
                <RevisionImportacion
                  importacionId={importacionId}
                  albumTitulo={album.titulo}
                  onPublicada={alPublicar}
                />
              </div>
            )}
          </Vista>
        </div>
      </div>

      {creandoAlbum && grupo && (
        <CrearAlbumModal
          grupoId={grupo.id}
          onClose={() => setCreandoAlbum(false)}
          onCreado={(creado) => {
            void queryClient.invalidateQueries({ queryKey: ['discografia', grupo.id] });
            setAlbum(creado);
            setImportacionId(null);
            setVista(2);
          }}
        />
      )}
    </div>
  );
};

/** Una vista del carrusel. Las no activas quedan fuera de la lectura de lectores de pantalla. */
const Vista: React.FC<{ activa: boolean; children: React.ReactNode }> = ({ activa, children }) => (
  <section className="min-h-[24rem] w-full shrink-0 p-5 sm:p-8" aria-hidden={!activa} inert={!activa}>
    {children}
  </section>
);

const CrearAlbumModal: React.FC<{ grupoId: string; onClose: () => void; onCreado: (album: AlbumGestion) => void }> = ({
  grupoId,
  onClose,
  onCreado,
}) => {
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState<TipoLanzamiento>('album');
  const [anio, setAnio] = useState('');
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!titulo.trim()) return pillToast.error('Falta el título', 'Escribe el nombre del álbum.');
    setGuardando(true);
    try {
      const anioNumero = anio.trim() ? Number(anio) : undefined;
      const creado = await discografiaApi.crearLanzamiento(grupoId, { titulo: titulo.trim(), tipo, anio: anioNumero });
      pillToast.success('Álbum creado', creado.titulo);
      // El álbum recién creado no trae canciones todavía: se completa con su forma mínima.
      onCreado({ ...creado, canciones: [], cover_url: undefined, orden: 0, publicado: false });
      onClose();
    } catch (err) {
      pillToast.error('No se pudo crear el álbum', err instanceof Error ? err.message : undefined);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Crear álbum"
      description="Se crea como borrador; las canciones se publican desde la revisión."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={guardando} onClick={() => void guardar()}>
            {guardando ? <Spinner size="sm" /> : 'Crear'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="ca-titulo" className="text-xs font-medium text-muted-foreground">Título</label>
          <Input id="ca-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="TRIO MISION Vol. 01" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="ca-tipo" className="text-xs font-medium text-muted-foreground">Tipo</label>
            <select
              id="ca-tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoLanzamiento)}
              className="h-9 w-full rounded-xl border border-input bg-background/50 px-3 text-sm shadow-sm"
            >
              {(Object.keys(etiquetaTipo) as TipoLanzamiento[]).map((t) => (
                <option key={t} value={t}>{etiquetaTipo[t]}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="ca-anio" className="text-xs font-medium text-muted-foreground">Año</label>
            <Input id="ca-anio" inputMode="numeric" value={anio} onChange={(e) => setAnio(e.target.value)} placeholder="2020" />
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ImportarGruposPage;
