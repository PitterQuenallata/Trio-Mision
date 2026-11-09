import React from 'react';
import { useForm } from '@tanstack/react-form';
import { useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../../shared/components/ui/modal';
import { Button } from '../../../shared/components/ui/button';
import { Input } from '../../../shared/components/ui/input';
import { pillToast } from '../../../shared/components/ui/pill-toast';
import { Spinner } from '../../../components/ui/ios-spinner';
import { adminUsuariosApi, type RolStaff } from '../../../shared/api/domains/usuarios';

const validateEmail = (value: string): string | undefined => {
  const v = value.trim();
  if (!v) return 'Escribe el correo.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Correo no válido.';
  return undefined;
};
const validatePassword = (value: string): string | undefined =>
  value.length >= 12 ? undefined : 'Mínimo 12 caracteres.';

const FORM_ID = 'crear-cuenta-form';

interface CrearCuentaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Alta de una cuenta staff (solo admin). Usa el modal y los avisos de la plantilla. */
export const CrearCuentaModal: React.FC<CrearCuentaModalProps> = ({ isOpen, onClose }) => {
  const queryClient = useQueryClient();

  const form = useForm({
    defaultValues: { email: '', display_name: '', password: '', rol: 'vendedor' as RolStaff },
    onSubmit: async ({ value }) => {
      try {
        const cuenta = await adminUsuariosApi.crear({
          email: value.email.trim(),
          password: value.password,
          display_name: value.display_name.trim() || undefined,
          rol: value.rol,
        });
        await queryClient.invalidateQueries({ queryKey: ['staff', 'usuarios'] });
        pillToast.success('Cuenta creada', `${cuenta.email}. Entrega la contraseña inicial al usuario.`);
        form.reset();
        onClose();
      } catch (err) {
        pillToast.error('No se pudo crear la cuenta', err instanceof Error ? err.message : undefined);
      }
    },
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Crear cuenta staff"
      description="La cuenta queda confirmada. Entrega la contraseña inicial al usuario."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" form={FORM_ID} disabled={isSubmitting}>
                {isSubmitting ? <Spinner size="sm" /> : 'Crear cuenta'}
              </Button>
            )}
          </form.Subscribe>
        </div>
      }
    >
      <form
        id={FORM_ID}
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
        noValidate
      >
        <form.Field name="email" validators={{ onChange: ({ value }) => validateEmail(value) }}>
          {(field) => (
            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="cuenta-email" className="text-xs font-medium text-muted-foreground">Correo</label>
              <Input id="cuenta-email" type="email" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} />
              {field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
                <p className="text-xs text-red-400">{String(field.state.meta.errors[0])}</p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field name="display_name">
          {(field) => (
            <div className="space-y-1.5">
              <label htmlFor="cuenta-nombre" className="text-xs font-medium text-muted-foreground">Nombre (opcional)</label>
              <Input id="cuenta-nombre" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} />
            </div>
          )}
        </form.Field>

        <form.Field name="rol">
          {(field) => (
            <div className="space-y-1.5">
              <label htmlFor="cuenta-rol" className="text-xs font-medium text-muted-foreground">Rol staff</label>
              <select
                id="cuenta-rol"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value as RolStaff)}
                className="h-9 w-full rounded-xl border border-input bg-background/50 px-3 text-sm shadow-sm"
              >
                <option value="vendedor">Vendedor</option>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          )}
        </form.Field>

        <form.Field name="password" validators={{ onChange: ({ value }) => validatePassword(value) }}>
          {(field) => (
            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="cuenta-password" className="text-xs font-medium text-muted-foreground">Contraseña inicial</label>
              <Input id="cuenta-password" type="password" autoComplete="new-password" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} />
              {field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
                <p className="text-xs text-red-400">{String(field.state.meta.errors[0])}</p>
              )}
            </div>
          )}
        </form.Field>
      </form>
    </Modal>
  );
};

export default CrearCuentaModal;
