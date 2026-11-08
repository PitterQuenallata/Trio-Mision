import { useQuery } from '@tanstack/react-query';
import { initialLicenses, initialLicenseMetrics } from '../data/licencias-data';
import { License, LicenseMetric } from '../types/licencias.types';

export const useLicencias = () => {
  return useQuery({
    queryKey: ['licencias'],
    queryFn: async (): Promise<License[]> => initialLicenses,
    staleTime: 1000 * 60 * 10,
  });
};

export const useLicenciasMetrics = () => {
  return useQuery({
    queryKey: ['licencias-metrics'],
    queryFn: async (): Promise<LicenseMetric[]> => initialLicenseMetrics,
    staleTime: 1000 * 60 * 10,
  });
};
