import React, { useMemo, useState } from 'react';
import { DataTable } from '../../../shared/components/data-table/data-table';
import { Button } from '../../../shared/components/ui/button';
import type { RolStaff, UsuarioStaff } from '../../../shared/api/domains/usuarios';
import { useUsuarios } from '../hooks/use-usuarios';
import { usuariosColumns } from '../components/usuarios-columns';
import { CrearCuentaModal } from '../components/crear-cuenta-modal';
import { GestionarUsuarioModal } from '../components/gestionar-usuario-modal';
import { Modal } from '../../../shared/components/ui/modal';
import { PermisosMatriz } from '../components/permisos-matriz';

export const UsuariosPage: React.FC = () => {
  const [rol, setRol] = useState<RolStaff | ''>('');
  const [creando, setCreando] = useState(false);
  const [verPermisos, setVerPermisos] = useState(false);
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);

  const usuarios = useUsuarios(rol === '' ? undefined : rol);

  const data = useMemo(() => usuarios.data ?? [], [usuarios.data]);
  // Se toma del listado vigente para que el modal muestre los cambios recién hechos.
  const seleccionado: UsuarioStaff | null = data.find((u) => u.id === seleccionadoId) ?? null;
  const columns = useMemo(() => usuariosColumns((u) => setSeleccionadoId(u.id)), []);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <header className="flex flex-col gap-4 border-b border-border/40 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Usuarios</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cuentas staff y managers de artistas. Solo el administrador crea cuentas y asigna roles.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setVerPermisos(true)}>Permisos por rol</Button>
          <Button onClick={() => setCreando(true)}>Crear cuenta staff</Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="usuarios-rol" className="text-xs font-medium text-muted-foreground">Rol staff</label>
        <select
          id="usuarios-rol"
          value={rol}
          onChange={(e) => setRol(e.target.value as RolStaff | '')}
          className="h-9 rounded-xl border border-input bg-background/50 px-3 text-sm shadow-sm"
        >
          <option value="">Todos</option>
          <option value="admin">Admin</option>
          <option value="editor">Editor</option>
          <option value="vendedor">Vendedor</option>
        </select>
      </div>

      {usuarios.isPending && <p className="text-sm text-muted-foreground">Cargando usuarios…</p>}
      {usuarios.isError && (
        <p role="alert" className="text-sm text-red-400">
          No se pudieron cargar los usuarios: {usuarios.error instanceof Error ? usuarios.error.message : 'error'}
        </p>
      )}
      {usuarios.isSuccess && (
        <DataTable
          columns={columns}
          data={data}
          searchKey="email"
          searchPlaceholder="Buscar por correo…"
          enableExport={false}
        />
      )}

      <CrearCuentaModal isOpen={creando} onClose={() => setCreando(false)} />

      <Modal
        isOpen={verPermisos}
        onClose={() => setVerPermisos(false)}
        title="Permisos por rol"
        description="Qué secciones ve cada rol en el panel. Se aplica en la interfaz y en la API."
        size="xl"
        footer={
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setVerPermisos(false)}>Cerrar</Button>
          </div>
        }
      >
        <PermisosMatriz />
      </Modal>
      <GestionarUsuarioModal usuario={seleccionado} onClose={() => setSeleccionadoId(null)} />
    </div>
  );
};

export default UsuariosPage;
