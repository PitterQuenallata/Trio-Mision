import React, { useState } from 'react';
import { ConfigTab } from '../types/configuracion.types';
import { ConfigGeneralTab } from '../components/config-general-tab';
import { ConfigSecurityTab } from '../components/config-security-tab';
import { ConfigNotificationsTab } from '../components/config-notifications-tab';
import { ConfigBackupsTab } from '../components/config-backups-tab';
import { ConfigApiTab } from '../components/config-api-tab';
import {
  initialGeneralConfig,
  initialSecurityConfig,
  initialNotificationChannels,
  initialBackupConfig,
  initialApiKeys,
  initialWebhooks,
} from '../data/configuracion-data';
import { useConfiguracion } from '../hooks/use-configuracion';
import { useSound } from '../../../shared/context/sound-context';
import { cn } from '../../../shared/lib/utils';

const TABS: { id: ConfigTab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'seguridad', label: 'Seguridad & IAM' },
  { id: 'notificaciones', label: 'Notificaciones' },
  { id: 'backups', label: 'Backups & Cloud' },
  { id: 'api', label: 'API & Webhooks' },
];

export const ConfiguracionPage: React.FC = () => {
  const { play } = useSound();

  const getInitialTab = (): ConfigTab => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash.includes('tab=seguridad')) return 'seguridad';
      if (hash.includes('tab=notificaciones')) return 'notificaciones';
      if (hash.includes('tab=backups')) return 'backups';
      if (hash.includes('tab=api')) return 'api';
      if (hash.includes('tab=general')) return 'general';
    }
    return 'general';
  };

  const [activeTab, setActiveTab] = useState<ConfigTab>(getInitialTab);

  React.useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.includes('tab=seguridad')) {
        setActiveTab('seguridad');
      } else if (hash.includes('tab=notificaciones')) {
        setActiveTab('notificaciones');
      } else if (hash.includes('tab=backups')) {
        setActiveTab('backups');
      } else if (hash.includes('tab=api')) {
        setActiveTab('api');
      } else if (hash.includes('tab=general')) {
        setActiveTab('general');
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const { data: configData } = useConfiguracion();
  const [generalConfig, setGeneralConfig] = useState(configData?.general || initialGeneralConfig);
  const [securityConfig, setSecurityConfig] = useState(configData?.security || initialSecurityConfig);
  const [channels, setChannels] = useState(configData?.channels || initialNotificationChannels);
  const [backupConfig, setBackupConfig] = useState(configData?.backup || initialBackupConfig);
  const [apiKeys, setApiKeys] = useState(configData?.apiKeys || initialApiKeys);
  const [webhooks, setWebhooks] = useState(configData?.webhooks || initialWebhooks);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Header & Tab Switcher */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Configuración del Sistema
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Parámetros globales de la plataforma, directivas de seguridad, políticas de respaldo y credenciales API
          </p>
        </div>

        {/* Apple Segmented Bar */}
        <div className="inline-flex p-1 rounded-2xl bg-muted/60 border border-border/50 backdrop-blur-md self-start md:self-auto overflow-x-auto scrollbar-none">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  play('click');
                  setActiveTab(tab.id);
                  window.location.hash = `#/configuracion?tab=${tab.id}`;
                }}
                className={cn(
                  'px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all duration-200',
                  isActive
                    ? 'bg-background text-foreground shadow-sm font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Tab View */}
      {activeTab === 'general' && (
        <ConfigGeneralTab
          initialConfig={generalConfig}
          onSave={setGeneralConfig}
        />
      )}

      {activeTab === 'seguridad' && (
        <ConfigSecurityTab
          initialConfig={securityConfig}
          onSave={setSecurityConfig}
        />
      )}

      {activeTab === 'notificaciones' && (
        <ConfigNotificationsTab
          initialChannels={channels}
          onSaveChannels={setChannels}
        />
      )}

      {activeTab === 'backups' && (
        <ConfigBackupsTab
          initialConfig={backupConfig}
          onSave={setBackupConfig}
        />
      )}

      {activeTab === 'api' && (
        <ConfigApiTab
          apiKeys={apiKeys}
          webhooks={webhooks}
          onAddApiKey={(key) => setApiKeys([key, ...apiKeys])}
          onRevokeApiKey={(id) => setApiKeys(apiKeys.filter((k) => k.id !== id))}
          onAddWebhook={(wh) => setWebhooks([wh, ...webhooks])}
        />
      )}
    </div>
  );
};
export default ConfiguracionPage;
