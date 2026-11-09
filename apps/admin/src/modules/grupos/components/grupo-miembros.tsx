import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../shared/components/ui/button';
import { Input } from '../../../shared/components/ui/input';
import { AlertDialog } from '../../../shared/components/ui/alert-dialog';
import { pillToast } from '../../../shared/components/ui/pill-toast';
import { Spinner } from '../../../components/ui/ios-spinner';
import { usuariosApi } from '../../../shared/api/domains/usuarios';
import { miembrosGrupoApi, type GestorGrupo, type GrupoDetalle } from '../../../shared/api/domains/grupos';

type Rol = 'member' | 'manager';

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

const ROL_ETIQUETA: Record<Rol, string> = { manager: 'Manager', member: 'Member' };

/**
 * Vinculados del grupo: managers y members. El admin vincula, cambia el rol,
 * desactiva o reactiva el acceso (sin borrar la membresía) y desvincula.
 */
export const GrupoMiembros: React.FC<{ grupo: GrupoDetalle }> = ({ grupo }) => {
  const queryClient = useQueryClient();
  const [busqueda, setBusqueda] = useState('');
  const [rolNuevo, setRolNuevo] = useState<Rol>('member');
  const [ocupado, setOcupado] = useState(false);
  const [aDesvincular, setADesvincular] = useState<GestorGrupo | null>(null);
  const termino = useDebounced(busqueda.trim(), 300);

  const resultados = useQuery({
    queryKey: ['usuarios', 'buscar', termino],
    queryFn: () => usuariosApi.buscar(termino),
    enabled: termino.length >= 2,
    staleTime: 60_000,
  });

  const miembros = grupo.miembros ?? [];
  const yaVinculados = new Set(miembros.map((m) => m.user_id));
  const candidatos = (resultados.data ?? []).filter((u) => !yaVinculados.has(u.id));
  const managersActivos = miembros.filter((m) => m.rol === 'manager' && m.activo).length;

  const refrescar = async () => {
    await queryClient.invalidateQueries({ queryKey: ['grupo', grupo.id] });
    await queryClient.invalidateQueries({ queryKey: ['grupos'] });
  };
  const fallo = (titulo: string) => (err: unknown) =>
    pillToast.error(titulo, err instanceof Error ? err.message : undefined);

  const ejecutar = async (accion: () => Promise<unknown>, titulo: string, exito: string) => {
    setOcupado(true);
    try {
      await accion();
      pillToast.success(titulo, exito);
      await refrescar();
    } catch (err) {
      fallo('No se pudo completar')(err);
    } finally {
      setOcupado(false);
    }
  };

  const vincular = (userId: string, email: string) =>
    ejecutar(
      () => miembrosGrupoApi.vincular(grupo.id, userId, rolNuevo),
      'Vinculado',
      `${email} como ${ROL_ETIQUETA[rolNuevo]}`
    ).then(() => setBusqueda(''));

  const cambiarRol = (m: GestorGrupo) => {
    const nuevo: Rol = m.rol === 'manager' ? 'member' : 'manager';
    return ejecutar(
      () => miembrosGrupoApi.actualizar(grupo.id, m.user_id, { rol: nuevo }),
      'Rol actualizado',
      `${m.email} ahora es ${ROL_ETIQUETA[nuevo]}`
    );
  };

  const cambiarActivo = (m: GestorGrupo) =>
    ejecutar(
      () => miembrosGrupoApi.actualizar(grupo.id, m.user_id, { activo: !m.activo }),
      m.activo ? 'Acceso desactivado' : 'Acceso reactivado',
      m.email ?? ''
    );

  const desvincular = async () => {
    if (!aDesvincular) return;
    const m = aDesvincular;
    setADesvincular(null);
    await ejecutar(() => miembrosGrupoApi.desvincular(grupo.id, m.user_id), 'Desvinculado', m.email ?? '');
  };

  return (
    <div className="max-w-3xl space-y-6">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vinculados al grupo</h3>
          <span className="text-xs text-muted-foreground">{managersActivos} manager activo{managersActivos === 1 ? '' : 's'}</span>
        </div>
        {miembros.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nadie vinculado todavía.</p>
        ) : (
          <ul className="divide-y divide-border/40 rounded-2xl border border-border/50">
            {miembros.map((m) => (
              <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{m.display_name || m.email}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">{m.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                    {ROL_ETIQUETA[m.rol as Rol] ?? m.rol}
                  </span>
                  <span className={m.activo ? 'text-xs text-emerald-500' : 'text-xs text-red-400'}>
                    {m.activo ? 'Activo' : 'Desactivado'}
                  </span>
                  <Button variant="outline" size="sm" disabled={ocupado} onClick={() => void cambiarRol(m)}>
                    {m.rol === 'manager' ? 'Pasar a member' : 'Hacer manager'}
                  </Button>
                  <Button variant="outline" size="sm" disabled={ocupado} onClick={() => void cambiarActivo(m)}>
                    {m.activo ? 'Desactivar' : 'Activar'}
                  </Button>
                  <Button variant="ghost" size="sm" disabled={ocupado} onClick={() => setADesvincular(m)}>
                    Desvincular
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vincular usuario</h3>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            placeholder="Buscar por correo o nombre…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <select
            aria-label="Rol al vincular"
            value={rolNuevo}
            onChange={(e) => setRolNuevo(e.target.value as Rol)}
            className="h-9 rounded-xl border border-input bg-background/50 px-3 text-sm shadow-sm"
          >
            <option value="member">Member</option>
            <option value="manager">Manager</option>
          </select>
        </div>
        {termino.length < 2 ? (
          <p className="text-xs text-muted-foreground">
            Escribe al menos 2 letras. La persona debe haber iniciado sesión al menos una vez.
          </p>
        ) : resultados.isPending ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner size="sm" /> Buscando…</div>
        ) : (
          <ul className="max-h-64 overflow-y-auto divide-y divide-border/40 rounded-2xl border border-border/50">
            {candidatos.length === 0 && (
              <li className="px-4 py-3 text-sm text-muted-foreground">Ninguna cuenta disponible coincide.</li>
            )}
            {candidatos.map((u) => (
              <li key={u.id} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <p className="text-sm">{u.display_name || u.email}</p>
                  <p className="font-mono text-xs text-muted-foreground">{u.email}</p>
                </div>
                <Button size="sm" disabled={ocupado} onClick={() => void vincular(u.id, u.email ?? '')}>
                  Vincular
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AlertDialog
        isOpen={aDesvincular !== null}
        onClose={() => setADesvincular(null)}
        variant="danger"
        title="Desvincular del grupo"
        description={`${aDesvincular?.email ?? 'Este usuario'} perderá su vínculo con ${grupo.nombre}. Para volver a darle acceso habrá que vincularlo otra vez.`}
        confirmText="Desvincular"
        cancelText="Cancelar"
        onConfirm={() => void desvincular()}
        isLoading={ocupado}
      />
    </div>
  );
};

export default GrupoMiembros;
