import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UpdateAdminUserPayload } from '@/entities';
import {
  banAdminUser,
  listAdminUsers,
  unbanAdminUser,
  updateAdminUser,
  type ListAdminUsersParams,
} from '@/lib/api';

const ADMIN_USERS_QUERY_KEY = ['admin', 'users'] as const;

export function useAdminUsersQuery(params: ListAdminUsersParams) {
  return useQuery({
    queryKey: [...ADMIN_USERS_QUERY_KEY, params],
    queryFn: () => listAdminUsers(params),
  });
}

export function useUpdateAdminUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: UpdateAdminUserPayload }) =>
      updateAdminUser(userId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_USERS_QUERY_KEY });
    },
  });
}

export function useBanAdminUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => banAdminUser(userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_USERS_QUERY_KEY });
    },
  });
}

export function useUnbanAdminUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => unbanAdminUser(userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_USERS_QUERY_KEY });
    },
  });
}
