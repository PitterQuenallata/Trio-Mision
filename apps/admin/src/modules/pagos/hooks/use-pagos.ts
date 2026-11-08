import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { initialInvoices, initialPricingPlans } from '../data/pagos-data';
import { Invoice, PricingPlan } from '../types/pagos.types';

const PAGOS_QUERY_KEY = ['invoices'] as const;

let inMemoryInvoices = [...initialInvoices];

export const useInvoices = () => {
  return useQuery({
    queryKey: PAGOS_QUERY_KEY,
    queryFn: async (): Promise<Invoice[]> => inMemoryInvoices,
    staleTime: 1000 * 60 * 5,
  });
};

export const usePricingPlans = () => {
  return useQuery({
    queryKey: ['pricing-plans'],
    queryFn: async (): Promise<PricingPlan[]> => initialPricingPlans,
    staleTime: 1000 * 60 * 15,
  });
};

export const useCreateInvoice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newInvoice: Invoice) => {
      inMemoryInvoices = [newInvoice, ...inMemoryInvoices];
      return newInvoice;
    },
    onSuccess: (newInvoice) => {
      queryClient.setQueryData<Invoice[]>(PAGOS_QUERY_KEY, (prev) => [newInvoice, ...(prev || [])]);
    },
  });
};
