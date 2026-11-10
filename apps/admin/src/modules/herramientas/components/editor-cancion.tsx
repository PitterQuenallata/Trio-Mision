import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../../../shared/components/ui/button';
import { Input } from '../../../shared/components/ui/input';
import { pillToast } from '../../../shared/components/ui/pill-toast';
import { Spinner } from '../../../components/ui/ios-spinner';
import { importacionesApi, type CancionImportada } from '../../../shared/api/domains/importaciones';
import { ChordProVista } from './chordpro-vista';
import { SweetAlert } from '../../../shared/components/ui/sweet-alert';

interface Campos {
  titulo: string;
  numero: string;
  tono: string;
  capo: string;
  autor: string;
}

/** Mismo criterio que la API: cambia o quita la directiva ({name: valor}) en el ChordPro. */
export function aplicarDirectiva(cp: string, nombre: string, valor: string): string {
  const quitada = cp.replace(new RegExp(`^\\{${nombre}:[^}]*\\}\\r?\\n?`, 'm'), '');
  return valor ? `{${nombre}: ${valor}}\n${quitada}` : quitada;
}

/** ChordPro con las directivas alineadas a los campos del formulario (vista previa y guardado). */
export function alinearChordpro(cp: string, c: Campos): string {
  let salida = aplicarDirectiva(cp, 'title', c.titulo.trim());
  salida = aplicarDirectiva(salida, 'number', c.numero.trim());
  salida = aplicarDirectiva(salida, 'key', c.tono.trim());
  salida = aplicarDirectiva(salida, 'capo', c.capo.trim());
  salida = aplicarDirectiva(salida, 'author', c.autor.trim());
  return salida;
}

interface EditorProps {
  importacionId: string;
  cancion: CancionImportada;
  /** Tras guardar: la canción queda revisada y lista para publicar. */
  onGuardada: (indice: number) => void;
  /** Al cerrar el aviso de finalizado: el flujo vuelve a empezar. */
  onFinalizado: () => void;
}

/**
 * Editor de una canción de la revisión, a la derecha de la lista: metadatos,
 * ChordPro y vista previa en vivo (como en la v1). Guardar la marca revisada.
 */
export const EditorCancion: React.FC<EditorProps> = ({ importacionId, cancion, onGuardada, onFinalizado }) => {
  // Se monta de nuevo por canción (key en el padre): el formulario parte de sus valores.
  const [campos, setCampos] = useState<Campos>({
    titulo: cancion.titulo,
    numero: cancion.numero ? String(cancion.numero) : '',
    tono: cancion.tono ?? '',
    capo: cancion.capo ? String(cancion.capo) : '',
    autor: cancion.autor ?? '',
  });
  const [texto, setTexto] = useState(cancion.chordpro);
  const [guardando, setGuardando] = useState(false);
  const [finalizado, setFinalizado] = useState(false);

  const set = (clave: keyof Campos) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setCampos((prev) => ({ ...prev, [clave]: e.target.value }));

  const vista = useMemo(() => alinearChordpro(texto, campos), [texto, campos]);

  const guardar = async () => {
    if (!campos.titulo.trim()) return pillToast.error('Falta el título', 'Escribe el nombre de la canción.');
    setGuardando(true);
    try {
      await importacionesApi.editarCancion(importacionId, cancion.indice, {
        titulo: campos.titulo.trim(),
        numero: campos.numero.trim() ? Number(campos.numero) : undefined,
        tono: campos.tono.trim(),
        capo: campos.capo.trim() ? Number(campos.capo) : undefined,
        autor: campos.autor.trim(),
        chordpro: vista,
      });
      onGuardada(cancion.indice);
      setFinalizado(true);
    } catch (err) {
      pillToast.error('No se pudo guardar', err instanceof Error ? err.message : undefined);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* En un portal: el carrusel usa transform y eso recortaría un overlay fixed. */}
      {createPortal(
        <SweetAlert
          isOpen={finalizado}
          type="success"
          title="¡Proceso finalizado!"
          text="¡En buena hora!"
          confirmText="Aceptar"
          onClose={() => {
            setFinalizado(false);
            onFinalizado();
          }}
        />,
        document.body,
      )}
      <div className="grid gap-3 sm:grid-cols-6">
        <Campo id="ed-titulo" etiqueta="Título" className="sm:col-span-3">
          <Input id="ed-titulo" value={campos.titulo} onChange={set('titulo')} />
        </Campo>
        <Campo id="ed-numero" etiqueta="Número">
          <Input id="ed-numero" inputMode="numeric" value={campos.numero} onChange={set('numero')} />
        </Campo>
        <Campo id="ed-tono" etiqueta="Tono">
          <Input id="ed-tono" value={campos.tono} onChange={set('tono')} placeholder="C, Am…" />
        </Campo>
        <Campo id="ed-capo" etiqueta="Capo">
          <Input id="ed-capo" inputMode="numeric" value={campos.capo} onChange={set('capo')} />
        </Campo>
        <Campo id="ed-autor" etiqueta="Autor" className="sm:col-span-3">
          <Input id="ed-autor" value={campos.autor} onChange={set('autor')} />
        </Campo>
        <Campo id="ed-autor-x" etiqueta="" className="sm:col-span-3">
          <div className="flex h-9 items-center justify-end">
            <Button disabled={guardando} onClick={() => void guardar()}>
              {guardando ? <Spinner size="sm" /> : 'Guardar y marcar revisada'}
            </Button>
          </div>
        </Campo>
      </div>

      {(cancion.issues ?? []).length > 0 && (
        <p className="rounded-xl border border-amber-400/40 p-3 text-xs text-amber-500">
          Revisa: {(cancion.issues ?? []).join(' · ')}
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="ed-chordpro" className="text-xs font-medium text-muted-foreground">ChordPro</label>
          <textarea
            id="ed-chordpro"
            spellCheck={false}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="h-[460px] w-full resize-y rounded-xl border border-input bg-background/50 px-3 py-2 font-mono text-xs shadow-sm"
          />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Vista previa</p>
          <div className="h-[460px] overflow-y-auto rounded-xl border border-border/50 bg-background/40 p-4">
            <ChordProVista texto={vista} />
          </div>
        </div>
      </div>
    </div>
  );
};

const Campo: React.FC<{ id: string; etiqueta: string; className?: string; children: React.ReactNode }> = ({ id, etiqueta, className, children }) => (
  <div className={'space-y-1.5 ' + (className ?? '')}>
    {etiqueta && <label htmlFor={id} className="text-xs font-medium text-muted-foreground">{etiqueta}</label>}
    {children}
  </div>
);

export default EditorCancion;
