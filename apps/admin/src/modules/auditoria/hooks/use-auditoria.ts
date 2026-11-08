import { useQuery } from '@tanstack/react-query';
import { initialAuditLogs } from '../data/auditoria-data';
import { AuditLog } from '../types/auditoria.types';

export const useAuditoriaLogs = () => {
  return useQuery({
    queryKey: ['auditoria-logs'],
    queryFn: async (): Promise<AuditLog[]> => initialAuditLogs,
    staleTime: 1000 * 60 * 5,
  });
};
