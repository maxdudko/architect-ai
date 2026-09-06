import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BillingMode,
  CreatePlanPayload,
  UpdatePlanPayload,
  UpsertPlanPricePayload,
} from '@/entities';
import {
  assignWorkspacePlan,
  createAdminPlan,
  listAdminPlans,
  updateAdminPlan,
  upsertAdminPlanPrice,
} from '@/lib/api';

const ADMIN_PLANS_QUERY_KEY = ['admin', 'plans'] as const;

export function useAdminPlansQuery() {
  return useQuery({
    queryKey: ADMIN_PLANS_QUERY_KEY,
    queryFn: listAdminPlans,
  });
}

export function useCreateAdminPlanMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePlanPayload) => createAdminPlan(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_PLANS_QUERY_KEY });
    },
  });
}

export function useUpdateAdminPlanMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ planId, payload }: { planId: string; payload: UpdatePlanPayload }) =>
      updateAdminPlan(planId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_PLANS_QUERY_KEY });
    },
  });
}

export function useUpsertAdminPlanPriceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      planId,
      billingMode,
      payload,
    }: {
      planId: string;
      billingMode: BillingMode;
      payload: UpsertPlanPricePayload;
    }) => upsertAdminPlanPrice(planId, billingMode, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_PLANS_QUERY_KEY });
    },
  });
}

export function useAssignWorkspacePlanMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workspaceId, planId }: { workspaceId: string; planId: string }) =>
      assignWorkspacePlan(workspaceId, planId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'usage'] });
    },
  });
}
