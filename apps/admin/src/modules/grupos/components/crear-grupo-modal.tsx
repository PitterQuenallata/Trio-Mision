import React, { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../../shared/components/ui/modal';
import { Button } from '../../../shared/components/ui/button';
import { Input } from '../../../shared/components/ui/input';
import { Switch } from '../../../shared/components/ui/switch';
import { pillToast } from '../../../shared/components/ui/pill-toast';
import { Spinner } from '../../../components/ui/ios-spinner';
import { gruposApi, type GrupoDetalle } from '../../../shared/api/domains/grupos';
import { PortadaInput } from './portada-input';

const FORM_ID = 'crear-grupo-form';

interface CrearGrupoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreado: (grupo: GrupoDetalle) => void;
}

/** Alta de un grupo. Lo básico aquí; venta de pistas y managers se configuran en la ficha. */
export const CrearGrupoModal: React.FC<CrearGrupoModalProps> = ({ isOpen, onClose, onCreado }) => {
  const queryClient = useQueryClient();
  const [portada, setPortada] = useState<string | undefined>(undefined);

  const form = useForm({
    defaultValues: { nombre: '', pais: '', bio: '', publicado: false },
    onSubmit: async ({ value }) => {
      try {
        const grupo = await gruposApi.crear({
          nombre: value.nombre.trim(),
          pais: value.pais.trim() || undefined,
          bio: value.bio.trim() || undefined,
          cover_key: portada,
          publicado: value.publicado,
        });
        await queryClient.invalidateQueries({ queryKey: ['grupos'] });
        pillToast.success('Grupo creado', grupo.nombre);
        form.reset();
        setPortada(undefined);
        onCreado(grupo);
      } catch (err) {
        pillToast.error('No se pudo crear el grupo', err instanceof Error ? err.message : undefined);
      }
    },
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nuevo grupo"
      description="Datos básicos. Luego podrás configurar ventas, álbumes y managers desde la ficha."
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(enviando) => (
              <Button type="submit" form={FORM_ID} disabled={enviando}>
                {enviando ? <Spinner size="sm" /> : 'Crear grupo'}
              </Button>
            )}
          </form.Subscribe>
        </div>
      }
    >
      <form
        id={FORM_ID}
        className="grid gap-4 sm:grid-cols-2"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <form.Field
          name="nombre"
          validators={{ onChange: ({ value }) => (value.trim().length >= 2 ? undefined : 'Escribe el nombre del grupo.') }}
        >
          {(field) => (
            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="grupo-nombre" className="text-xs font-medium text-muted-foreground">Nombre del grupo</label>
              <Input id="grupo-nombre" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} />
              {field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
                <p className="text-xs text-red-400">{String(field.state.meta.errors[0])}</p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field name="pais">
          {(field) => (
            <div className="space-y-1.5">
              <label htmlFor="grupo-pais" className="text-xs font-medium text-muted-foreground">País</label>
              <Input id="grupo-pais" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />
            </div>
          )}
        </form.Field>

        <form.Field name="publicado">
          {(field) => (
            <div className="flex items-end justify-between gap-4 pb-1">
              <div>
                <p className="text-sm font-medium">Publicado</p>
                <p className="text-xs text-muted-foreground">Visible en el catálogo público.</p>
              </div>
              <Switch checked={field.state.value} onCheckedChange={(v) => field.handleChange(v)} />
            </div>
          )}
        </form.Field>

        <form.Field name="bio">
          {(field) => (
            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="grupo-bio" className="text-xs font-medium text-muted-foreground">Biografía</label>
              <textarea
                id="grupo-bio"
                rows={3}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                className="w-full rounded-xl border border-input bg-background/50 px-3 py-2 text-sm shadow-sm"
              />
            </div>
          )}
        </form.Field>

        <div className="space-y-1.5 sm:col-span-2">
          <p className="text-xs font-medium text-muted-foreground">Portada</p>
          <PortadaInput tipo="grupo" onSubida={setPortada} />
        </div>
      </form>
    </Modal>
  );
};

export default CrearGrupoModal;
