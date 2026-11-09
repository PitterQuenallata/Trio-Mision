import { useQuery } from '@tanstack/react-query';
import { usuariosApi, type RolStaff } from '../../../shared/api/domains/usuarios';

/** Usuarios desde la API. Solo lo pide un admin (la ruta está restringida). */
export function useUsuarios(rol?: RolStaff) {
  return useQuery({
    queryKey: ['staff', 'usuarios', rol ?? 'todos'],
    queryFn: () => usuariosApi.list(rol),
  });
}
