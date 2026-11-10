import React from 'react';
import { useForm } from '@tanstack/react-form';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../shared/components/ui/button';
import { Input } from '../../../shared/components/ui/input';
import { Switch } from '../../../shared/components/ui/switch';
import { pillToast } from '../../../shared/components/ui/pill-toast';
import { Spinner } from '../../../components/ui/ios-spinner';
import { gruposApi, type RedesGrupo } from '../../../shared/api/domains/grupos';
import { artistasApi } from '../../../shared/api/domains/artistas';
import { PortadaInput } from './portada-input';

/** Datos editables de un grupo; el admin recibe el detalle completo y el manager la ficha. */
export interface GrupoEditable {
  id: string;
  nombre: string;
  pais?: string;
  bio?: string;
  redes?: RedesGrupo | unknown;
  cover_key?: string;
  cover_url?: string;
  publicado?: boolean;
}

const REDES: { clave: keyof RedesGrupo; etiqueta: string }[] = [
  { clave: 'instagram', etiqueta: 'Instagram' },
  { clave: 'youtube', etiqueta: 'YouTube' },
  { clave: 'spotify', etiqueta: 'Spotify' },
  { clave: 'facebook', etiqueta: 'Facebook' },
  { clave: 'tiktok', etiqueta: 'TikTok' },
  { clave: 'x', etiqueta: 'X' },
  { clave: 'web', etiqueta: 'Sitio web' },
];

/** Datos del grupo: nombre, país, biografía, redes, portada y publicación. */
export const GrupoDatos: React.FC<{ grupo: GrupoEditable; modo?: 'admin' | 'manager' }> = ({ grupo, modo = 'admin' }) => {
  const queryClient = useQueryClient();
  const esManager = modo === 'manager';

  const form = useForm({
    defaultValues: {
      nombre: grupo.nombre,
      pais: grupo.pais ?? '',
      bio: grupo.bio ?? '',
      publicado: grupo.publicado ?? false,
      redes: (grupo.redes ?? {}) as RedesGrupo,
      cover_key: grupo.cover_key,
    },
    onSubmit: async ({ value }) => {
      try {
        if (esManager) {
          // El manager solo edita la ficha; nombre y publicación son del staff.
          await artistasApi.actualizarMio(grupo.id, {
            pais: value.pais.trim(),
            bio: value.bio.trim(),
            redes: value.redes as Record<string, string>,
            cover_key: value.cover_key,
          });
          await queryClient.invalidateQueries({ queryKey: ['mis-artistas', grupo.id] });
        } else {
          await gruposApi.actualizar(grupo.id, {
            nombre: value.nombre.trim(),
            pais: value.pais.trim(),
            bio: value.bio.trim(),
            publicado: value.publicado,
            redes: value.redes,
            cover_key: value.cover_key,
          });
          await queryClient.invalidateQueries({ queryKey: ['grupo', grupo.id] });
          await queryClient.invalidateQueries({ queryKey: ['grupos'] });
        }
        pillToast.success('Datos guardados', value.nombre);
      } catch (err) {
        pillToast.error('No se pudieron guardar los datos', err instanceof Error ? err.message : undefined);
      }
    },
  });

  return (
    <form
      className="space-y-6"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <form.Field name="nombre">
          {(field) => (
            <div className="space-y-1.5">
              <label htmlFor="g-nombre" className="text-xs font-medium text-muted-foreground">Nombre</label>
              {esManager ? (
                <p id="g-nombre" className="flex h-9 items-center text-sm text-foreground">{field.state.value}</p>
              ) : (
                <Input id="g-nombre" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />
              )}
            </div>
          )}
        </form.Field>
        <form.Field name="pais">
          {(field) => (
            <div className="space-y-1.5">
              <label htmlFor="g-pais" className="text-xs font-medium text-muted-foreground">País</label>
              <Input id="g-pais" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />
            </div>
          )}
        </form.Field>
        <form.Field name="bio">
          {(field) => (
            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="g-bio" className="text-xs font-medium text-muted-foreground">Biografía</label>
              <textarea
                id="g-bio"
                rows={4}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                className="w-full rounded-xl border border-input bg-background/50 px-3 py-2 text-sm shadow-sm"
              />
            </div>
          )}
        </form.Field>
      </div>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Redes</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {REDES.map((red) => (
            <form.Field key={red.clave} name={`redes.${red.clave}`}>
              {(field) => (
                <div className="space-y-1.5">
                  <label htmlFor={`red-${red.clave}`} className="text-xs font-medium text-muted-foreground">{red.etiqueta}</label>
                  <Input
                    id={`red-${red.clave}`}
                    placeholder="https://"
                    value={field.state.value ?? ''}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </form.Field>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Portada</h3>
        <form.Field name="cover_key">
          {(field) => (
            <PortadaInput
              tipo="grupo"
              urlActual={grupo.cover_url}
              onSubida={(key) => field.handleChange(key)}
            />
          )}
        </form.Field>
      </section>

      {!esManager && (
        <form.Field name="publicado">
          {(field) => (
            <div className="flex items-center justify-between rounded-2xl border border-border/50 px-4 py-3">
              <div>
                <p className="text-sm font-medium">Publicado</p>
                <p className="text-xs text-muted-foreground">Visible en el catálogo público.</p>
              </div>
              <Switch checked={field.state.value} onCheckedChange={(v) => field.handleChange(v)} />
            </div>
          )}
        </form.Field>
      )}

      <div className="flex justify-end">
        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(enviando) => (
            <Button type="submit" disabled={enviando}>
              {enviando ? <Spinner size="sm" /> : 'Guardar datos'}
            </Button>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
};

export default GrupoDatos;
