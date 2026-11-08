import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  initialGeneralConfig,
  initialSecurityConfig,
  initialNotificationChannels,
  initialBackupConfig,
  initialApiKeys,
  initialWebhooks,
} from '../data/configuracion-data';
import {
  GeneralConfig,
  SecurityConfig,
  NotificationChannel,
  BackupConfig,
  ApiKeyItem,
  WebhookEndpoint,
} from '../types/configuracion.types';

const CONFIG_QUERY_KEY = ['system-configuration'] as const;

interface PlatformConfigState {
  general: GeneralConfig;
  security: SecurityConfig;
  channels: NotificationChannel[];
  backup: BackupConfig;
  apiKeys: ApiKeyItem[];
  webhooks: WebhookEndpoint[];
}

let inMemoryConfig: PlatformConfigState = {
  general: initialGeneralConfig,
  security: initialSecurityConfig,
  channels: initialNotificationChannels,
  backup: initialBackupConfig,
  apiKeys: initialApiKeys,
  webhooks: initialWebhooks,
};

export const useConfiguracion = () => {
  return useQuery({
    queryKey: CONFIG_QUERY_KEY,
    queryFn: async (): Promise<PlatformConfigState> => inMemoryConfig,
    staleTime: 1000 * 60 * 10,
  });
};

export const useUpdateGeneralConfig = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updated: Partial<GeneralConfig>) => {
      inMemoryConfig.general = { ...inMemoryConfig.general, ...updated };
      return inMemoryConfig.general;
    },
    onSuccess: (newGeneral) => {
      queryClient.setQueryData<PlatformConfigState>(CONFIG_QUERY_KEY, (prev) =>
        prev ? { ...prev, general: newGeneral } : prev
      );
    },
  });
};

export const useUpdateSecurityConfig = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updated: Partial<SecurityConfig>) => {
      inMemoryConfig.security = { ...inMemoryConfig.security, ...updated };
      return inMemoryConfig.security;
    },
    onSuccess: (newSecurity) => {
      queryClient.setQueryData<PlatformConfigState>(CONFIG_QUERY_KEY, (prev) =>
        prev ? { ...prev, security: newSecurity } : prev
      );
    },
  });
};
