import { useQuery } from '@tanstack/react-query';
import { initialStaffMembers, initialPermissionsMatrix } from '../data/staff-data';
import { StaffMember, PermissionRow } from '../types/staff.types';

export const useStaffMembers = () => {
  return useQuery({
    queryKey: ['staff-members'],
    queryFn: async (): Promise<StaffMember[]> => initialStaffMembers,
    staleTime: 1000 * 60 * 10,
  });
};

export const useStaffPermissions = () => {
  return useQuery({
    queryKey: ['staff-permissions'],
    queryFn: async (): Promise<PermissionRow[]> => initialPermissionsMatrix,
    staleTime: 1000 * 60 * 10,
  });
};
