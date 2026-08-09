import { useQuery } from '@tanstack/react-query';
import { listAdminLogs, type ListAdminLogsParams } from '@/lib/api';

export function useAdminLogsQuery(params: ListAdminLogsParams) {
  return useQuery({
    queryKey: ['admin', 'logs', params],
    queryFn: () => listAdminLogs(params),
  });
}
