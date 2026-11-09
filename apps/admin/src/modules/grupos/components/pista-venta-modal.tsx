import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../../shared/components/ui/modal';
import { Button } from '../../../shared/components/ui/button';
import { Input } from '../../../shared/components/ui/input';
import { AlertDialog } from '../../../shared/components/ui/alert-dialog';
import { pillToast } from '../../../shared/components/ui/pill-toast';
import { Spinner } from '../../../components/ui/ios-spinner';
import { pistasApi, type CancionGestion } from '../../../shared/api/domains/discografia';

interface PistaVentaModalProps {
  grupoId: string;
  cancion: CancionGestion | null;
  onClose: () => void;
}

/**
 * Pista a la venta de una canción. Es una venta aparte de la letra: se vincula
 * una pista del grupo con su precio. Solo se abre si el grupo vende pistas.
 */
export const PistaVentaModal: React.FC<PistaVentaModalProps> = ({ grupoId, cancion, onClose }) => {
  return cancion ? <Contenido key={cancion.id} grupoId={grupoId} cancion={cancion} onClose={onClose} /> : null;
};

const Contenido: React.FC<{ grupoId: string; cancion: CancionGestion; onClose: () => void }> = ({ grupoId, cancion, onClose }) => {
  const queryClient = useQueryClient();
  const [seleccion, setSeleccion] = useState<string>(cancion.pista?.id ?? '');
  const [precio, setPrecio] = useState(cancion.pista ? String(cancion.pista.precio_minor / 100) : '');
  const [nuevaPista, setNuevaPista] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [desvincular, setDesvincular] = useState(false);

  const pistas = useQuery({
    queryKey: ['pistas', grupoId],
    queryFn: () => pistasApi.listar(grupoId),
  });
  // Solo se ofrecen pistas libres o ya vinculadas a esta canción.
  const disponibles = (pistas.data ?? []).filter((p) => !p.cancion_id || p.cancion_id === cancion.id);

  const refrescar = async () => {
    await queryClient.invalidateQueries({ queryKey: ['discografia', grupoId] });
    await queryClient.invalidateQueries({ queryKey: ['pistas', grupoId] });
  };

  const ejecutar = async (accion: () => Promise<unknown>, exito: string) => {
    setOcupado(true);
    try {
      await accion();
      pillToast.success(exito, cancion.titulo);
      await refrescar();
      onClose();
    } catch (err) {
      pillToast.error('No se pudo completar', err instanceof Error ? err.message : undefined);
    } finally {
      setOcupado(false);
    }
  };

  const vincular = async () => {
    const monto = Number(precio.replace(',', '.'));
    if (!seleccion) return pillToast.error('Elige una pista', 'Selecciona la pista que se vende con esta canción.');
    if (!Number.isFinite(monto) || monto <= 0) return pillToast.error('Precio inválido', 'Escribe un precio mayor a 0 (en bolivianos).');
    // El precio se guarda en la unidad menor (centavos).
    await ejecutar(
      () => pistasApi.vincular(grupoId, cancion.id, seleccion, Math.round(monto * 100), 'BOB'),
      cancion.pista ? 'Pista actualizada' : 'Pista a la venta'
    );
  };

  const crearYVincular = async () => {
    if (!nuevaPista.trim()) return pillToast.error('Falta el nombre', 'Escribe el nombre de la pista.');
    setOcupado(true);
    try {
      const creada = await pistasApi.crear(grupoId, nuevaPista.trim());
      setSeleccion(creada.id);
      setNuevaPista('');
      await pistas.refetch();
      pillToast.success('Pista creada', 'Ahora elige el precio y vincúlala.');
    } catch (err) {
      pillToast.error('No se pudo crear la pista', err instanceof Error ? err.message : undefined);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <>
      <Modal
        isOpen
        onClose={onClose}
        title="Pista a la venta"
        description={`${cancion.titulo} · la letra no se vende aparte; solo la pista.`}
        size="lg"
        footer={
          <div className="flex items-center justify-between gap-2">
            {cancion.pista ? (
              <Button variant="ghost" disabled={ocupado} onClick={() => setDesvincular(true)}>Quitar de la venta</Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button disabled={ocupado} onClick={() => void vincular()}>
                {ocupado ? <Spinner size="sm" /> : cancion.pista ? 'Guardar' : 'Vincular pista'}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="pv-pista" className="text-xs font-medium text-muted-foreground">Pista del grupo</label>
            {pistas.isPending ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner size="sm" /> Cargando pistas…</div>
            ) : (
              <select
                id="pv-pista"
                value={seleccion}
                onChange={(e) => setSeleccion(e.target.value)}
                className="h-9 w-full rounded-xl border border-input bg-background/50 px-3 text-sm shadow-sm"
              >
                <option value="">Elige una pista…</option>
                {disponibles.map((p) => <option key={p.id} value={p.id}>{p.titulo}</option>)}
              </select>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="pv-precio" className="text-xs font-medium text-muted-foreground">Precio (Bs)</label>
            <Input id="pv-precio" inputMode="decimal" placeholder="15" value={precio} onChange={(e) => setPrecio(e.target.value)} className="max-w-[10rem]" />
          </div>

          <div className="space-y-2 rounded-2xl border border-border/50 p-4">
            <p className="text-xs font-medium text-muted-foreground">¿La pista no está en la lista? Créala aquí.</p>
            <div className="flex gap-2">
              <Input placeholder="Nombre de la pista" value={nuevaPista} onChange={(e) => setNuevaPista(e.target.value)} />
              <Button variant="outline" disabled={ocupado} onClick={() => void crearYVincular()}>Crear</Button>
            </div>
            <p className="text-xs text-muted-foreground">El audio se sube después, desde la ficha de la pista.</p>
          </div>
        </div>
      </Modal>

      <AlertDialog
        isOpen={desvincular}
        onClose={() => setDesvincular(false)}
        variant="warning"
        title="Quitar de la venta"
        description={`«${cancion.titulo}» deja de ofrecer su pista. La pista se conserva en el grupo.`}
        confirmText="Quitar"
        cancelText="Cancelar"
        onConfirm={() => {
          setDesvincular(false);
          void ejecutar(() => pistasApi.desvincular(grupoId, cancion.id), 'Pista quitada de la venta');
        }}
      />
    </>
  );
};

export default PistaVentaModal;
