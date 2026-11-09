import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../../shared/components/ui/modal';
import { Button } from '../../../shared/components/ui/button';
import { Input } from '../../../shared/components/ui/input';
import { Switch } from '../../../shared/components/ui/switch';
import { AlertDialog } from '../../../shared/components/ui/alert-dialog';
import { pillToast } from '../../../shared/components/ui/pill-toast';
import { Spinner } from '../../../components/ui/ios-spinner';
import { buscarArtistasStaff } from '../../../shared/api/domains/artistas';
import { adminUsuariosApi, type RolStaff, type UsuarioStaff } from '../../../shared/api/domains/usuarios';

const ROLES: { value: RolStaff; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'editor', label: 'Editor' },
  { value: 'vendedor', label: 'Vendedor' },
];

/** Valor que solo cambia cuando deja de cambiar durante `ms`. */
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/** Quitar acceso pide confirmación. */
type Pendiente =
  | { tipo: 'rol'; rol: RolStaff }
  | { tipo: 'manager'; artistaId: string; artistaNombre: string };

interface GestionarUsuarioModalProps {
  usuario: UsuarioStaff | null;
  onClose: () => void;
}

/** Roles staff y managers por artista de un usuario. Solo admin. */
export const GestionarUsuarioModal: React.FC<GestionarUsuarioModalProps> = ({ usuario, onClose }) => {
  const queryClient = useQueryClient();
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const [busqueda, setBusqueda] = useState('');
  // La búsqueda espera a que el admin deje de escribir: una petición por pausa, no por tecla.
  const termino = useDebounced(busqueda.trim(), 300);

  // Al cambiar de usuario, la búsqueda se limpia.
  useEffect(() => setBusqueda(''), [usuario?.id]);

  // Solo se consulta cuando hay al menos 2 caracteres escritos.
  const resultados = useQuery({
    queryKey: ['staff', 'artistas', termino],
    queryFn: () => buscarArtistasStaff(termino),
    enabled: usuario !== null && termino.length >= 2,
    staleTime: 60_000,
  });

  const refrescar = () => queryClient.invalidateQueries({ queryKey: ['staff', 'usuarios'] });
  const fallo = (err: unknown) =>
    pillToast.error('No se pudo completar la acción', err instanceof Error ? err.message : undefined);

  const rol = useMutation({
    mutationFn: ({ r, conceder }: { r: RolStaff; conceder: boolean }) =>
      adminUsuariosApi.cambiarRol(usuario!.id, r, conceder),
    onSuccess: (_, { r, conceder }) => {
      pillToast.success(conceder ? 'Rol concedido' : 'Rol retirado', `${r} · ${usuario?.email ?? ''}`);
      void refrescar();
    },
    onError: fallo,
  });

  const manager = useMutation({
    mutationFn: ({ artistId, conceder }: { artistId: string; conceder: boolean }) =>
      adminUsuariosApi.cambiarManager(artistId, usuario!.id, conceder),
    onSuccess: (_, { conceder }) => {
      pillToast.success(conceder ? 'Manager añadido' : 'Manager retirado', usuario?.email ?? '');
      setBusqueda('');
      void refrescar();
    },
    onError: fallo,
  });

  // Los artistas que ya administra vienen en el listado de usuarios (con su nombre).
  const administrados = useMemo(
    () => (usuario?.artist_memberships ?? []).filter((m) => m.role === 'manager'),
    [usuario]
  );
  const idsAdministrados = useMemo(() => new Set(administrados.map((m) => m.artist_id)), [administrados]);
  const disponibles = useMemo(
    () => (resultados.data ?? []).filter((a) => !idsAdministrados.has(a.id)),
    [resultados.data, idsAdministrados]
  );

  const confirmar = () => {
    if (!pendiente) return;
    if (pendiente.tipo === 'rol') rol.mutate({ r: pendiente.rol, conceder: false });
    else manager.mutate({ artistId: pendiente.artistaId, conceder: false });
    setPendiente(null);
  };

  const cantidadManager = administrados.length;
  const ocupado = rol.isPending || manager.isPending;

  return (
    <>
      <Modal
        isOpen={usuario !== null}
        onClose={onClose}
        title="Gestionar cuenta"
        description={usuario?.email ?? ''}
        size="lg"
        footer={
          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>Cerrar</Button>
          </div>
        }
      >
        {usuario && (
          <div className="space-y-6">
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Roles staff</h3>
              <ul className="divide-y divide-border/40 rounded-2xl border border-border/50">
                {ROLES.map((r) => {
                  const tiene = usuario.staff_roles.includes(r.value);
                  return (
                    <li key={r.value} className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm font-medium">{r.label}</span>
                      <Switch
                        checked={tiene}
                        disabled={ocupado}
                        onCheckedChange={() =>
                          tiene ? setPendiente({ tipo: 'rol', rol: r.value }) : rol.mutate({ r: r.value, conceder: true })
                        }
                      />
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="space-y-3">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Manager de artista</h3>
                <p className="text-xs text-muted-foreground">
                  {cantidadManager === 0
                    ? 'No administra ningún artista.'
                    : `Administra ${cantidadManager} artista${cantidadManager === 1 ? '' : 's'}.`}
                </p>
              </div>

              {administrados.length > 0 && (
                <ul className="divide-y divide-border/40 rounded-2xl border border-border/50">
                  {administrados.map((m) => (
                    <li key={m.artist_id} className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm font-medium">{m.nombre}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={ocupado}
                        onClick={() => setPendiente({ tipo: 'manager', artistaId: m.artist_id, artistaNombre: m.nombre })}
                      >
                        Quitar
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="space-y-2">
                <label htmlFor="buscar-artista" className="text-xs font-medium text-muted-foreground">
                  Añadir como manager
                </label>
                <Input
                  id="buscar-artista"
                  placeholder="Escribe el nombre del artista…"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
                {busqueda.trim().length < 2 ? (
                  <p className="text-xs text-muted-foreground">Escribe al menos 2 letras para buscar.</p>
                ) : resultados.isPending ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Spinner size="sm" /> Buscando…
                  </div>
                ) : resultados.isError ? (
                  <p role="alert" className="text-sm text-red-400">No se pudo buscar. Inténtalo de nuevo.</p>
                ) : (
                  <ul className="max-h-56 overflow-y-auto divide-y divide-border/40 rounded-2xl border border-border/50">
                    {disponibles.length === 0 && (
                      <li className="px-4 py-3 text-sm text-muted-foreground">Ningún artista coincide.</li>
                    )}
                    {disponibles.map((a) => (
                      <li key={a.id} className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-sm">{a.nombre}</span>
                        <Button size="sm" disabled={ocupado} onClick={() => manager.mutate({ artistId: a.id, conceder: true })}>
                          Añadir
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>
        )}
      </Modal>

      <AlertDialog
        isOpen={pendiente !== null}
        onClose={() => setPendiente(null)}
        variant="danger"
        title={pendiente?.tipo === 'manager' ? 'Quitar manager' : 'Quitar rol'}
        description={
          pendiente?.tipo === 'manager'
            ? `${usuario?.email ?? 'Este usuario'} dejará de administrar ${pendiente.artistaNombre}. Perderá el acceso a ese artista.`
            : `${usuario?.email ?? 'Este usuario'} dejará de tener el rol ${pendiente?.rol ?? ''}.`
        }
        confirmText="Quitar"
        cancelText="Cancelar"
        onConfirm={confirmar}
      />
    </>
  );
};

export default GestionarUsuarioModal;
