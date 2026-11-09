import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../../shared/components/ui/modal';
import { Button } from '../../../shared/components/ui/button';
import { Input } from '../../../shared/components/ui/input';
import { Switch } from '../../../shared/components/ui/switch';
import { pillToast } from '../../../shared/components/ui/pill-toast';
import { Spinner } from '../../../components/ui/ios-spinner';
import { discografiaApi, etiquetaTipo, type AlbumGestion, type TipoLanzamiento } from '../../../shared/api/domains/discografia';
import { PortadaInput } from './portada-input';

const TIPOS: TipoLanzamiento[] = ['album', 'ep', 'sencillo'];

interface EditarLanzamientoModalProps {
  grupoId: string;
  lanzamiento: AlbumGestion | null;
  onClose: () => void;
}

/** Datos de un lanzamiento: tipo, título, año, orden, portada y publicación. */
export const EditarLanzamientoModal: React.FC<EditarLanzamientoModalProps> = ({ grupoId, lanzamiento, onClose }) => {
  const queryClient = useQueryClient();
  // Se monta solo con un lanzamiento: el formulario arranca con sus datos.
  return lanzamiento ? (
    <EditarContenido
      key={lanzamiento.id}
      grupoId={grupoId}
      lanzamiento={lanzamiento}
      onClose={onClose}
      onGuardado={() => queryClient.invalidateQueries({ queryKey: ['discografia', grupoId] })}
    />
  ) : null;
};

const EditarContenido: React.FC<{
  grupoId: string;
  lanzamiento: AlbumGestion;
  onClose: () => void;
  onGuardado: () => void;
}> = ({ grupoId, lanzamiento, onClose, onGuardado }) => {
  const [titulo, setTitulo] = useState(lanzamiento.titulo);
  const [tipo, setTipo] = useState<TipoLanzamiento>(lanzamiento.tipo);
  const [anio, setAnio] = useState(lanzamiento.anio ? String(lanzamiento.anio) : '');
  const [orden, setOrden] = useState(String(lanzamiento.orden));
  const [publicado, setPublicado] = useState(lanzamiento.publicado);
  const [portada, setPortada] = useState<string | undefined>(undefined);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!titulo.trim()) {
      pillToast.error('Falta el título', 'Escribe el nombre del lanzamiento.');
      return;
    }
    setGuardando(true);
    try {
      await discografiaApi.actualizarLanzamiento(grupoId, lanzamiento.id, {
        titulo: titulo.trim(),
        tipo,
        anio: anio ? Number(anio) : undefined,
        orden: Number(orden) || 0,
        publicado,
        cover_key: portada,
      });
      pillToast.success('Datos guardados', titulo.trim());
      onGuardado();
      onClose();
    } catch (err) {
      pillToast.error('No se pudo guardar', err instanceof Error ? err.message : undefined);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Datos del lanzamiento"
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => void guardar()} disabled={guardando}>
            {guardando ? <Spinner size="sm" /> : 'Guardar'}
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
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
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor="lz-titulo" className="text-xs font-medium text-muted-foreground">Título</label>
          <Input id="lz-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="lz-anio" className="text-xs font-medium text-muted-foreground">Año</label>
          <Input id="lz-anio" inputMode="numeric" placeholder="2026" value={anio} onChange={(e) => setAnio(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="lz-orden" className="text-xs font-medium text-muted-foreground">Orden en la discografía</label>
          <Input id="lz-orden" inputMode="numeric" value={orden} onChange={(e) => setOrden(e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <p className="text-xs font-medium text-muted-foreground">Portada</p>
          <PortadaInput tipo="album" urlActual={lanzamiento.cover_url} onSubida={setPortada} />
        </div>
        <div className="flex items-center justify-between rounded-2xl border border-border/50 px-4 py-3 sm:col-span-2">
          <div>
            <p className="text-sm font-medium">Publicado</p>
            <p className="text-xs text-muted-foreground">Visible en el catálogo cuando el grupo esté publicado.</p>
          </div>
          <Switch checked={publicado} onCheckedChange={setPublicado} />
        </div>
      </div>
    </Modal>
  );
};

export default EditarLanzamientoModal;
