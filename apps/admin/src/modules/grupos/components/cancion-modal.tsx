import React, { useMemo, useState } from 'react';
import { Modal } from '../../../shared/components/ui/modal';
import { Button } from '../../../shared/components/ui/button';
import { Input } from '../../../shared/components/ui/input';
import { pillToast } from '../../../shared/components/ui/pill-toast';
import { Spinner } from '../../../components/ui/ios-spinner';
import { discografiaApi, type Acceso, type CancionGestion } from '../../../shared/api/domains/discografia';

const TONOS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
// Las canciones solo son gratis o Premium. La venta de una pista es aparte.
const ACCESOS: { valor: Acceso; etiqueta: string }[] = [
  { valor: 'free', etiqueta: 'Gratis' },
  { valor: 'premium', etiqueta: 'Premium (suscripción)' },
];

/** Vista previa simple de ChordPro: directivas como encabezados y acordes en negrita sobre la letra. */
export function vistaPrevia(chordpro: string): { tipo: 'titulo' | 'letra'; texto: string; acordes?: string[] }[] {
  return chordpro.split('\n').map((linea) => {
    const dir = linea.match(/^\{(\w+):?\s*(.*)\}$/);
    if (dir) return { tipo: 'titulo', texto: dir[2] || dir[1] };
    return { tipo: 'letra', texto: linea.replace(/\[[^\]]*\]/g, ''), acordes: [...linea.matchAll(/\[([^\]]*)\]/g)].map((m) => m[1]) };
  });
}

interface CancionModalProps {
  grupoId: string;
  albumId: string;
  cancion: CancionGestion | null;
  abierto: boolean;
  onClose: () => void;
  onGuardada: () => void;
}

/** Alta o edición de una canción con editor ChordPro y vista previa. */
export const CancionModal: React.FC<CancionModalProps> = (props) =>
  props.abierto ? <CancionContenido key={props.cancion?.id ?? 'nueva'} {...props} /> : null;

const CancionContenido: React.FC<CancionModalProps> = ({ grupoId, albumId, cancion, onClose, onGuardada }) => {
  const [titulo, setTitulo] = useState(cancion?.titulo ?? '');
  const [tono, setTono] = useState(cancion?.tono ?? 'C');
  const [capo, setCapo] = useState(cancion?.capo != null ? String(cancion.capo) : '');
  const [autor, setAutor] = useState(cancion?.autor ?? '');
  const [arreglista, setArreglista] = useState(cancion?.arreglista ?? '');
  const [acceso, setAcceso] = useState<Acceso>((cancion?.acceso as Acceso) ?? 'free');
  const [chordpro, setChordpro] = useState(cancion?.chordpro ?? '');
  const [guardando, setGuardando] = useState(false);
  const preview = useMemo(() => vistaPrevia(chordpro), [chordpro]);

  const guardar = async () => {
    if (!titulo.trim()) return pillToast.error('Falta el título', 'Escribe el nombre de la canción.');
    if (!chordpro.trim()) return pillToast.error('Falta la letra', 'Escribe la letra con sus acordes.');
    setGuardando(true);
    try {
      const datos = {
        titulo: titulo.trim(),
        tono,
        capo: capo ? Number(capo) : undefined,
        autor: autor.trim() || undefined,
        arreglista: arreglista.trim() || undefined,
        acceso,
      };
      if (cancion) {
        await discografiaApi.actualizarCancion(grupoId, cancion.id, { ...datos, chordpro });
      } else {
        await discografiaApi.crearCancion(grupoId, albumId, { ...datos, chordpro });
      }
      pillToast.success(cancion ? 'Canción guardada' : 'Canción agregada', titulo.trim());
      onGuardada();
      onClose();
    } catch (err) {
      pillToast.error('No se pudo guardar la canción', err instanceof Error ? err.message : undefined);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={cancion ? 'Editar canción' : 'Nueva canción'}
      size="xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => void guardar()} disabled={guardando}>
            {guardando ? <Spinner size="sm" /> : cancion ? 'Guardar' : 'Agregar canción'}
          </Button>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="grid gap-4 sm:grid-cols-2 content-start">
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="c-titulo" className="text-xs font-medium text-muted-foreground">Título</label>
            <Input id="c-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="c-tono" className="text-xs font-medium text-muted-foreground">Tono</label>
            <select id="c-tono" value={tono} onChange={(e) => setTono(e.target.value)} className="h-9 w-full rounded-xl border border-input bg-background/50 px-3 text-sm shadow-sm">
              {TONOS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="c-capo" className="text-xs font-medium text-muted-foreground">Capo</label>
            <Input id="c-capo" inputMode="numeric" value={capo} onChange={(e) => setCapo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="c-autor" className="text-xs font-medium text-muted-foreground">Autor</label>
            <Input id="c-autor" value={autor} onChange={(e) => setAutor(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="c-arr" className="text-xs font-medium text-muted-foreground">Arreglista</label>
            <Input id="c-arr" value={arreglista} onChange={(e) => setArreglista(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="c-acceso" className="text-xs font-medium text-muted-foreground">Acceso</label>
            <select id="c-acceso" value={acceso} onChange={(e) => setAcceso(e.target.value as Acceso)} className="h-9 w-full rounded-xl border border-input bg-background/50 px-3 text-sm shadow-sm">
              {ACCESOS.map((a) => <option key={a.valor} value={a.valor}>{a.etiqueta}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-3">
          <label htmlFor="c-chordpro" className="text-xs font-medium text-muted-foreground">Letra y acordes (ChordPro)</label>
          <textarea
            id="c-chordpro"
            rows={12}
            spellCheck={false}
            placeholder={'{title: Mi canción}\n[C]Primera línea de la [G]letra'}
            value={chordpro}
            onChange={(e) => setChordpro(e.target.value)}
            className="w-full rounded-xl border border-input bg-background/50 p-3 font-mono text-xs shadow-sm"
          />
          <div className="rounded-xl border border-border/50 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Vista previa</p>
            {chordpro.trim() === '' ? (
              <p className="text-sm text-muted-foreground">Aquí verás la letra con sus acordes.</p>
            ) : (
              <div className="space-y-1 text-sm">
                {preview.map((l, i) =>
                  l.tipo === 'titulo' ? (
                    <p key={i} className="font-semibold">{l.texto}</p>
                  ) : (
                    <p key={i} className="whitespace-pre-wrap">
                      {l.acordes && l.acordes.length > 0 && (
                        <span className="block font-mono text-xs font-semibold text-primary">{l.acordes.join('  ')}</span>
                      )}
                      {l.texto || ' '}
                    </p>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default CancionModal;
