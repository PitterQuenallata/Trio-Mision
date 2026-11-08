import React, { useState } from 'react';
import {
  Users,
  UserCircle2,
  Settings,
} from 'lucide-react';
import { initialUsuarios } from '../data/usuarios-data';
import { Usuario } from '../types/usuarios.types';
import { useUsuarios, useCreateUsuario, useDeleteUsuario } from '../hooks/use-usuarios';
import { UsuariosDirectoryTab } from '../components/usuarios-directory-tab';
import { UsuariosProfileTab } from '../components/usuarios-profile-tab';
import { UsuariosAccountTab } from '../components/usuarios-account-tab';
import { useSound } from '../../../shared/context/sound-context';
import { cn } from '../../../shared/lib/utils';

export type UsuariosSubTab = 'directory' | 'profile' | 'account';

export const UsuariosPage: React.FC = () => {
  const { play } = useSound();
  const { data: usuarios = initialUsuarios } = useUsuarios();
  const createMutation = useCreateUsuario();
  const deleteMutation = useDeleteUsuario();

  const getInitialTab = (): UsuariosSubTab => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash.includes('tab=profile')) return 'profile';
      if (hash.includes('tab=account') || hash.includes('tab=security')) return 'account';
      if (hash.includes('tab=directory')) return 'directory';
    }
    return 'directory';
  };

  const [activeTab, setActiveTab] = useState<UsuariosSubTab>(getInitialTab);
  const [selectedUserForProfile, setSelectedUserForProfile] = useState<Usuario | null>(null);

  React.useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.includes('tab=profile')) {
        setActiveTab('profile');
      } else if (hash.includes('tab=account') || hash.includes('tab=security')) {
        setActiveTab('account');
      } else if (hash.includes('tab=directory')) {
        setActiveTab('directory');
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleAddUsuario = (newUser: Usuario) => {
    createMutation.mutate(newUser);
  };

  const handleDeleteUsuario = (id: string) => {
    deleteMutation.mutate(id);
  };

  const handleSelectProfile = (user: Usuario) => {
    setSelectedUserForProfile(user);
    setActiveTab('profile');
  };

  const handleNavigateToAccount = () => {
    setActiveTab('account');
  };

  const subTabs: {
    id: UsuariosSubTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }[] = [
    { id: 'directory', label: 'Directorio de Usuarios', icon: Users, badge: String(usuarios.length) },
    { id: 'profile', label: 'Perfil de Usuario', icon: UserCircle2 },
    { id: 'account', label: 'Ajustes de Cuenta', icon: Settings },
  ];

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5 font-mono">
          <span>Administración Central</span>
          <span>/</span>
          <span className="text-foreground">Módulo de Usuarios</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Directorio, Perfiles & Cuentas
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-3xl leading-relaxed">
              Estructura integral adaptada de la plantilla Modernize: gestión centralizada de miembros del equipo, perfil social con timeline y galería, y panel de configuración de seguridad y facturación.
            </p>
          </div>
        </div>
      </div>

      {/* Segmented Sub-Tabs Navigation */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-secondary/50 border border-border overflow-x-auto">
        {subTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                play('tab');
                setActiveTab(tab.id as UsuariosSubTab);
                window.location.hash = `#/usuarios?tab=${tab.id}`;
              }}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap cursor-pointer',
                isActive
                  ? 'bg-card text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className={cn('h-3.5 w-3.5', isActive ? 'text-primary' : 'text-muted-foreground')} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className={cn(
                    'font-mono text-[10px] px-1.5 py-0.2 rounded-full tabular-nums',
                    isActive
                      ? 'bg-primary text-white font-bold'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* SUB-TAB CONTENTS */}
      {activeTab === 'directory' && (
        <UsuariosDirectoryTab
          usuarios={usuarios}
          onAddUsuario={handleAddUsuario}
          onSelectProfile={handleSelectProfile}
          onDeleteUsuario={handleDeleteUsuario}
        />
      )}

      {activeTab === 'profile' && (
        <UsuariosProfileTab
          selectedUser={selectedUserForProfile}
          onNavigateToAccount={handleNavigateToAccount}
        />
      )}

      {activeTab === 'account' && (
        <UsuariosAccountTab />
      )}
    </div>
  );
};
