import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { initialUsuarios } from '../data/usuarios-data';
import { Usuario } from '../types/usuarios.types';

const USUARIOS_QUERY_KEY = ['usuarios'] as const;

// In-memory store initialized with initial data
let inMemoryUsuarios = [...initialUsuarios];

export const fetchUsuarios = async (): Promise<Usuario[]> => {
  // Simulates instant micro-latency response
  return inMemoryUsuarios;
};

export const useUsuarios = () => {
  return useQuery({
    queryKey: USUARIOS_QUERY_KEY,
    queryFn: fetchUsuarios,
    staleTime: 1000 * 60 * 5,
  });
};

export const useCreateUsuario = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newUser: Usuario) => {
      inMemoryUsuarios = [newUser, ...inMemoryUsuarios];
      return newUser;
    },
    onSuccess: (newUser) => {
      queryClient.setQueryData<Usuario[]>(USUARIOS_QUERY_KEY, (prev) => [newUser, ...(prev || [])]);
    },
  });
};

export const useDeleteUsuario = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      inMemoryUsuarios = inMemoryUsuarios.filter((u) => u.id !== id);
      return id;
    },
    onSuccess: (deletedId) => {
      queryClient.setQueryData<Usuario[]>(USUARIOS_QUERY_KEY, (prev) =>
        (prev || []).filter((u) => u.id !== deletedId)
      );
    },
  });
};
