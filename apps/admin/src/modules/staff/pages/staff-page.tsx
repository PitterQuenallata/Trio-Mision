import React, { useState } from 'react';
import { Plus, X, Shield, Mail, User, KeyRound, Check } from 'lucide-react';
import { Button } from '../../../shared/components/ui/button';
import { Input } from '../../../shared/components/ui/input';
import { Switch } from '../../../shared/components/ui/switch';
import { StaffGrid } from '../components/staff-grid';
import { StaffPermissionsMatrix } from '../components/staff-permissions-matrix';
import { initialStaffMembers, initialPermissionsMatrix } from '../data/staff-data';
import { StaffMember } from '../types/staff.types';
import { useStaffMembers, useStaffPermissions } from '../hooks/use-staff';
import { useSound } from '../../../shared/context/sound-context';
import { pillToast } from '../../../shared/components/ui/pill-toast';

export const StaffPage: React.FC = () => {
  const { play } = useSound();
  const { data: initialMembers = initialStaffMembers } = useStaffMembers();
  const { data: permissions = initialPermissionsMatrix } = useStaffPermissions();
  const [members, setMembers] = useState<StaffMember[]>(initialMembers);

  // Invite Staff Modal State
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Senior Backend Dev');
  const [inviteAccess, setInviteAccess] = useState('Clúster Kubernetes EU');
  const [inviteTwoFactor, setInviteTwoFactor] = useState(true);

  const handleOpenInvite = () => {
    play('pop');
    setIsInviteModalOpen(true);
    pillToast.info('Invitar al Staff', 'Asistente de asignación de credenciales y roles RBAC.');
  };

  const handleCloseInvite = () => {
    play('click');
    setIsInviteModalOpen(false);
  };

  const handleSubmitInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) {
      play('alert');
      pillToast.error('Campos Requeridos', 'Por favor ingresa el nombre y correo corporativo.');
      return;
    }

    const initials = inviteName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0].toUpperCase())
      .join('');

    const newMember: StaffMember = {
      id: `staff-${Date.now()}`,
      name: inviteName.trim(),
      email: inviteEmail.trim(),
      role: inviteRole,
      access: inviteAccess,
      twoFactor: inviteTwoFactor,
      lastActive: 'Invitación pendiente',
      avatar: initials || 'ST',
    };

    play('success');
    setMembers((prev) => [newMember, ...prev]);
    setIsInviteModalOpen(false);
    setInviteName('');
    setInviteEmail('');
    pillToast.success('Invitación Despachada', `Se remitió el enlace seguro a ${newMember.email}.`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Staff & Control de Acceso (RBAC)
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Administración del equipo interno, privilegios granulares y autenticación multifactor 2FA
          </p>
        </div>
        <Button
          variant="default"
          size="sm"
          onClick={handleOpenInvite}
          className="gap-1.5 text-xs rounded-xl shadow-sm self-start sm:self-auto cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Invitar Miembro al Staff</span>
        </Button>
      </div>

      {/* Staff Members Grid */}
      <StaffGrid members={members} />

      {/* RBAC Permissions Matrix */}
      <StaffPermissionsMatrix permissions={permissions} />

      {/* Apple HIG Modal: Invitar Miembro al Staff */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg rounded-2xl border border-border/80 bg-card p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">Invitar Miembro al Staff</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Asigna privilegios y remite enlace temporal de credenciales
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseInvite}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitInvite} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Nombre Completo</span>
                </label>
                <Input
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Ej. Lucas Silva"
                  className="text-xs h-9"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Correo Electrónico Corporativo</span>
                </label>
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="lucas.silva@blakor.com"
                  className="text-xs h-9"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Rol RBAC</span>
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full text-xs h-9 px-3 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="Super Admin">Super Admin</option>
                    <option value="Security Lead">Security Lead</option>
                    <option value="Cloud Architect">Cloud Architect</option>
                    <option value="Senior Backend Dev">Senior Backend Dev</option>
                    <option value="FinOps Lead">FinOps Lead</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Nivel de Acceso</span>
                  </label>
                  <select
                    value={inviteAccess}
                    onChange={(e) => setInviteAccess(e.target.value)}
                    className="w-full text-xs h-9 px-3 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="Acceso Global Cifrado">Acceso Global Cifrado</option>
                    <option value="Clúster Kubernetes EU">Clúster Kubernetes EU</option>
                    <option value="Solo Lectura Facturación">Solo Lectura Facturación</option>
                    <option value="Logs & Telemetría">Logs & Telemetría</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-muted/20">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-foreground block">Exigir Autenticación 2FA</span>
                  <span className="text-[11px] text-muted-foreground block">
                    Obligatorio para interactuar con pods y secretos de producción
                  </span>
                </div>
                <Switch checked={inviteTwoFactor} onCheckedChange={setInviteTwoFactor} />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/40">
                <Button type="button" variant="outline" size="sm" onClick={handleCloseInvite} className="text-xs h-9">
                  Cancelar
                </Button>
                <Button type="submit" variant="default" size="sm" className="text-xs h-9 gap-1.5">
                  <Check className="h-3.5 w-3.5" />
                  <span>Enviar Invitación Segura</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default StaffPage;
