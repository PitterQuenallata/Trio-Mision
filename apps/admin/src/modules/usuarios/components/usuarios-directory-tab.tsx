import React, { useState, useMemo } from 'react';
import {
  Search,
  UserPlus,
  Filter,
  Grid,
  List,
  Eye,
  Edit2,
  Trash2,
  Mail,
  Phone,
  MapPin,
  Building,
  Check,
  X,
} from 'lucide-react';
import { useIconHover } from '@animateicons/react';
import { DownloadIcon } from '@animateicons/react/lucide';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../shared/components/ui/card';
import { Button } from '../../../shared/components/ui/button';
import { Badge } from '../../../shared/components/ui/badge';
import { Input } from '../../../shared/components/ui/input';
import { DataTable } from '../../../shared/components/data-table/data-table';
import { usuariosColumns } from './usuarios-columns';
import { Usuario } from '../types/usuarios.types';
import { useSound } from '../../../shared/context/sound-context';
import { pillToast } from '../../../shared/components/ui/pill-toast';
import { cn } from '../../../shared/lib/utils';

interface UsuariosDirectoryTabProps {
  usuarios: Usuario[];
  onAddUsuario: (user: Usuario) => void;
  onSelectProfile: (user: Usuario) => void;
  onDeleteUsuario: (id: string) => void;
}

export const UsuariosDirectoryTab: React.FC<UsuariosDirectoryTabProps> = ({
  usuarios,
  onAddUsuario,
  onSelectProfile,
  onDeleteUsuario,
}) => {
  const { play } = useSound();
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const downloadHover = useIconHover();

  // Modal State
  const [isNewUserModalOpen, setIsNewUserModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('Editor');
  const [newDepartment, setNewDepartment] = useState('Diseño de Producto');
  const [newPhone, setNewPhone] = useState('+1 (555) 000-0000');
  const [newLocation, setNewLocation] = useState('San Francisco, CA');

  // Quick View Drawer State
  const [selectedUserForDrawer, setSelectedUserForDrawer] = useState<Usuario | null>(null);

  // Filtered List
  const filteredUsers = useMemo(() => {
    return usuarios.filter((u) => {
      const matchSearch =
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        (u.department && u.department.toLowerCase().includes(search.toLowerCase())) ||
        (u.location && u.location.toLowerCase().includes(search.toLowerCase()));

      const matchRole = roleFilter === 'all' || u.role === roleFilter;
      const matchStatus = statusFilter === 'all' || u.status === statusFilter;

      return matchSearch && matchRole && matchStatus;
    });
  }, [usuarios, search, roleFilter, statusFilter]);

  // Metrics
  const totalCount = usuarios.length;
  const activeCount = usuarios.filter((u) => u.status === 'Activo').length;
  const pendingCount = usuarios.filter((u) => u.status === 'Pendiente').length;
  const inactiveCount = usuarios.filter((u) => u.status === 'Inactivo').length;

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) {
      play('alert');
      pillToast.error('Campos Requeridos', 'Por favor ingresa nombre y correo corporativo.');
      return;
    }

    const initials = newName
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    const created: Usuario = {
      id: `USR-${Date.now().toString().slice(-4)}`,
      name: newName,
      email: newEmail,
      role: newRole,
      status: 'Activo',
      subscription: 'Pro Plan',
      avatarText: initials || 'US',
      avatar: `/images/profile/user-${Math.floor(1 + Math.random() * 12)}.jpg`,
      joinedAt: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
      phone: newPhone,
      department: newDepartment,
      location: newLocation,
      bio: 'Miembro del equipo recientemente incorporado al espacio corporativo.',
    };

    onAddUsuario(created);
    setIsNewUserModalOpen(false);
    setNewName('');
    setNewEmail('');
    play('success');
    pillToast.success('Usuario Creado con Éxito', `Se envió invitación de acceso a ${newEmail}.`);
  };

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-border">
          <CardContent className="p-4 space-y-1">
            <span className="text-xs text-muted-foreground block font-medium">Total de Usuarios</span>
            <div className="font-mono text-2xl font-bold text-foreground tabular-nums">{totalCount}</div>
            <span className="text-[11px] text-muted-foreground">Directorio global</span>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 space-y-1">
            <span className="text-xs text-muted-foreground block font-medium">Usuarios Activos</span>
            <div className="font-mono text-2xl font-bold text-emerald-500 tabular-nums">{activeCount}</div>
            <span className="text-[11px] text-emerald-500/80 font-mono">Con acceso habilitado</span>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 space-y-1">
            <span className="text-xs text-muted-foreground block font-medium">Invitaciones Pendientes</span>
            <div className="font-mono text-2xl font-bold text-amber-500 tabular-nums">{pendingCount}</div>
            <span className="text-[11px] text-amber-500/80 font-mono">En espera de aceptación</span>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 space-y-1">
            <span className="text-xs text-muted-foreground block font-medium">Cuentas Inactivas</span>
            <div className="font-mono text-2xl font-bold text-muted-foreground tabular-nums">{inactiveCount}</div>
            <span className="text-[11px] text-muted-foreground font-mono">Suspendidos o en baja</span>
          </CardContent>
        </Card>
      </div>

      {/* Main Container Card */}
      <Card className="border-border">
        <CardHeader className="pb-4 border-b border-border/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-bold">Directorio & Control de Miembros</CardTitle>
              <CardDescription className="text-xs">
                Administración de credenciales corporativas, roles de seguridad y asignación de planes
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                soundType="click"
                {...downloadHover.triggerProps}
                onClick={() => {
                  play('click');
                  pillToast.info('Directorio Exportado', 'Se descargó el archivo CSV de usuarios.');
                }}
                className="text-xs gap-1.5"
              >
                <DownloadIcon ref={downloadHover.ref} className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Exportar CSV</span>
              </Button>

              <Button
                variant="default"
                size="sm"
                soundType="pop"
                onClick={() => {
                  play('pop');
                  setIsNewUserModalOpen(true);
                }}
                className="text-xs gap-1.5"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Nuevo Usuario
              </Button>
            </div>
          </div>

          {/* Search, Filter Toolbar & View Toggle */}
          <div className="pt-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, correo o departamento..."
                className="pl-9 text-xs h-9 bg-background"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Role filter */}
              <select
                value={roleFilter}
                onChange={(e) => {
                  play('click');
                  setRoleFilter(e.target.value);
                }}
                className="h-9 px-3 rounded-xl border border-border bg-background text-xs font-medium text-foreground cursor-pointer focus:outline-hidden"
              >
                <option value="all">Todos los Roles</option>
                <option value="Administrador">Administrador</option>
                <option value="Editor">Editor</option>
                <option value="Desarrollador">Desarrollador</option>
                <option value="Soporte">Soporte</option>
                <option value="Cliente">Cliente</option>
              </select>

              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={(e) => {
                  play('click');
                  setStatusFilter(e.target.value);
                }}
                className="h-9 px-3 rounded-xl border border-border bg-background text-xs font-medium text-foreground cursor-pointer focus:outline-hidden"
              >
                <option value="all">Todos los Estados</option>
                <option value="Activo">Activos</option>
                <option value="Pendiente">Pendientes</option>
                <option value="Inactivo">Inactivos</option>
              </select>

              {/* View Switcher: Table / Grid */}
              <div className="flex items-center p-0.5 rounded-xl bg-secondary/60 border border-border">
                <button
                  type="button"
                  onClick={() => {
                    play('tab');
                    setViewMode('table');
                  }}
                  className={cn(
                    'p-1.5 rounded-lg text-xs transition-all cursor-pointer',
                    viewMode === 'table' ? 'bg-card text-foreground shadow-2xs font-semibold' : 'text-muted-foreground hover:text-foreground'
                  )}
                  title="Vista Tabla"
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    play('tab');
                    setViewMode('grid');
                  }}
                  className={cn(
                    'p-1.5 rounded-lg text-xs transition-all cursor-pointer',
                    viewMode === 'grid' ? 'bg-card text-foreground shadow-2xs font-semibold' : 'text-muted-foreground hover:text-foreground'
                  )}
                  title="Vista Tarjetas"
                >
                  <Grid className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {viewMode === 'table' ? (
            <div className="p-4">
              <DataTable
                columns={usuariosColumns}
                data={filteredUsers}
                searchKey="name"
                searchPlaceholder="Filtrar en tabla..."
              />
            </div>
          ) : (
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className="group p-4 rounded-2xl border border-border bg-card/60 hover:bg-card hover:border-foreground/20 hover:shadow-sm transition-all duration-200 flex flex-col justify-between space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {user.avatar ? (
                        <img
                          src={user.avatar}
                          alt={user.name}
                          className="h-11 w-11 rounded-2xl object-cover border border-border shrink-0"
                        />
                      ) : (
                        <div className="h-11 w-11 rounded-2xl bg-primary/10 text-primary font-bold flex items-center justify-center text-sm shrink-0">
                          {user.avatarText}
                        </div>
                      )}
                      <div>
                        <h4 className="font-semibold text-foreground text-xs line-clamp-1">{user.name}</h4>
                        <span className="text-[11px] text-muted-foreground font-mono block truncate max-w-[150px]">
                          {user.email}
                        </span>
                        <span className="text-[10px] text-primary font-medium block mt-0.5">
                          {user.role}
                        </span>
                      </div>
                    </div>

                    <Badge
                      variant={
                        user.status === 'Activo'
                          ? 'success'
                          : user.status === 'Pendiente'
                          ? 'warning'
                          : 'secondary'
                      }
                      className="text-[10px] font-mono shrink-0"
                    >
                      {user.status}
                    </Badge>
                  </div>

                  {user.department && (
                    <div className="space-y-1 text-[11px] text-muted-foreground border-t border-border/40 pt-3">
                      <div className="flex items-center gap-1.5 truncate">
                        <Building className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
                        <span className="truncate">{user.department}</span>
                      </div>
                      {user.location && (
                        <div className="flex items-center gap-1.5 truncate">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
                          <span className="truncate">{user.location}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs">
                    <span className="font-mono text-[10px] text-muted-foreground">
                      Alta: {user.joinedAt}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="iconSm"
                        soundType="click"
                        onClick={() => {
                          play('click');
                          setSelectedUserForDrawer(user);
                        }}
                        title="Ver detalles"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="iconSm"
                        soundType="tab"
                        onClick={() => {
                          play('tab');
                          onSelectProfile(user);
                        }}
                        title="Ir al perfil"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="iconSm"
                        soundType="alert"
                        onClick={() => {
                          play('alert');
                          onDeleteUsuario(user.id);
                          pillToast.info('Usuario Eliminado', `Se removió a ${user.name} del directorio.`);
                        }}
                        title="Eliminar usuario"
                        className="hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* New User Modal */}
      {isNewUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
          <Card className="w-full max-w-lg border-border shadow-xl">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold">Registrar Nuevo Usuario</CardTitle>
                  <CardDescription className="text-xs">
                    Envía una invitación directa para acceder al panel corporativo
                  </CardDescription>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNewUserModalOpen(false)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </CardHeader>
            <form onSubmit={handleCreateUser}>
              <CardContent className="p-6 space-y-4 text-xs">
                <div>
                  <label className="font-medium text-foreground block mb-1.5">Nombre Completo *</label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="ej. Mateo Anderson"
                    className="text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="font-medium text-foreground block mb-1.5">Correo Electrónico *</label>
                  <Input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="ej. mateo.anderson@blakor.io"
                    className="text-xs font-mono"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-medium text-foreground block mb-1.5">Rol de Seguridad</label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-medium text-foreground cursor-pointer focus:outline-hidden"
                    >
                      <option value="Administrador">Administrador</option>
                      <option value="Editor">Editor</option>
                      <option value="Desarrollador">Desarrollador</option>
                      <option value="Soporte">Soporte</option>
                      <option value="Cliente">Cliente</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-medium text-foreground block mb-1.5">Departamento</label>
                    <Input
                      value={newDepartment}
                      onChange={(e) => setNewDepartment(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-medium text-foreground block mb-1.5">Teléfono Directo</label>
                    <Input
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      className="text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="font-medium text-foreground block mb-1.5">Ubicación / Sede</label>
                    <Input
                      value={newLocation}
                      onChange={(e) => setNewLocation(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>
              </CardContent>

              <div className="p-4 border-t border-border/50 flex items-center justify-end gap-2 bg-secondary/20">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  soundType="click"
                  onClick={() => setIsNewUserModalOpen(false)}
                  className="text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="default"
                  size="sm"
                  soundType="success"
                  className="text-xs gap-1.5"
                >
                  <Check className="h-3.5 w-3.5" />
                  Crear y Enviar Invitación
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* User Quick View Drawer Modal */}
      {selectedUserForDrawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
          <Card className="w-full max-w-md border-border shadow-2xl">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold">Ficha de Usuario</CardTitle>
                  <CardDescription className="text-xs">Identificador: {selectedUserForDrawer.id}</CardDescription>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedUserForDrawer(null)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-5 text-xs">
              <div className="flex items-center gap-4">
                {selectedUserForDrawer.avatar ? (
                  <img
                    src={selectedUserForDrawer.avatar}
                    alt={selectedUserForDrawer.name}
                    className="h-16 w-16 rounded-2xl object-cover border border-border"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-2xl bg-primary/10 text-primary font-bold flex items-center justify-center text-lg">
                    {selectedUserForDrawer.avatarText}
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-bold text-foreground">{selectedUserForDrawer.name}</h3>
                  <span className="text-muted-foreground font-mono block">{selectedUserForDrawer.email}</span>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {selectedUserForDrawer.role}
                    </Badge>
                    <Badge
                      variant={
                        selectedUserForDrawer.status === 'Activo'
                          ? 'success'
                          : selectedUserForDrawer.status === 'Pendiente'
                          ? 'warning'
                          : 'secondary'
                      }
                      className="text-[10px] font-mono"
                    >
                      {selectedUserForDrawer.status}
                    </Badge>
                  </div>
                </div>
              </div>

              {selectedUserForDrawer.bio && (
                <div className="p-3.5 rounded-xl bg-secondary/30 border border-border text-[11px] text-muted-foreground leading-relaxed">
                  {selectedUserForDrawer.bio}
                </div>
              )}

              <div className="space-y-2.5 pt-2 border-t border-border/50 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Departamento:</span>
                  <span className="font-semibold text-foreground">{selectedUserForDrawer.department || 'General'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Ubicación:</span>
                  <span className="font-semibold text-foreground">{selectedUserForDrawer.location || 'Remoto'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Teléfono:</span>
                  <span className="font-mono text-foreground">{selectedUserForDrawer.phone || 'No registrado'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Plan Asignado:</span>
                  <span className="font-semibold text-primary">{selectedUserForDrawer.subscription}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Fecha de Registro:</span>
                  <span className="font-mono text-muted-foreground">{selectedUserForDrawer.joinedAt}</span>
                </div>
              </div>
            </CardContent>

            <div className="p-4 border-t border-border/50 flex items-center justify-end gap-2 bg-secondary/20">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedUserForDrawer(null)}
                className="text-xs"
              >
                Cerrar
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  onSelectProfile(selectedUserForDrawer);
                  setSelectedUserForDrawer(null);
                }}
                className="text-xs"
              >
                Ver Perfil Completo
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
