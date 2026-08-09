import { useQuery } from '@tanstack/react-query';
import { listAdminUsers, type ListAdminUsersParams } from '@/lib/api';

export function useAdminUsersQuery(params: ListAdminUsersParams) {
  return useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: () => listAdminUsers(params),
  });
}
