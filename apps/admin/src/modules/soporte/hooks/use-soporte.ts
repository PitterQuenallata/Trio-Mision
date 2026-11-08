import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { initialTickets } from '../data/soporte-data';
import { Ticket } from '../types/soporte.types';

const SOPORTE_QUERY_KEY = ['soporte-tickets'] as const;

let inMemoryTickets = [...initialTickets];

export const useSoporteTickets = () => {
  return useQuery({
    queryKey: SOPORTE_QUERY_KEY,
    queryFn: async (): Promise<Ticket[]> => inMemoryTickets,
    staleTime: 1000 * 60 * 5,
  });
};

export const useCreateTicket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newTicket: Ticket) => {
      inMemoryTickets = [newTicket, ...inMemoryTickets];
      return newTicket;
    },
    onSuccess: (newTicket) => {
      queryClient.setQueryData<Ticket[]>(SOPORTE_QUERY_KEY, (prev) => [newTicket, ...(prev || [])]);
    },
  });
};
