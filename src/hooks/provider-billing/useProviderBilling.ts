import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { providerBillingApi } from "../../services/providerBillingApi";
import type { CreateBillingRatePayload, UpdateBillingRatePayload } from "../../types/providerBilling";
import { providerBillingKeys } from "./queryKeys";

export function useProviderBillingRates(providerId: number) {
  return useQuery({
    queryKey: providerBillingKeys.rates(providerId),
    queryFn: ({ signal }) => providerBillingApi.getBillingRates(providerId, { signal }),
    enabled: providerId > 0,
  });
}

export function useProviderBillingHistory(providerId: number, enabled = true) {
  return useQuery({
    queryKey: providerBillingKeys.history(providerId),
    queryFn: ({ signal }) => providerBillingApi.getBillingHistory(providerId, { signal }),
    enabled: providerId > 0 && enabled,
  });
}

export function useProviderBillingMutations(providerId: number) {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: providerBillingKeys.rates(providerId) }),
      queryClient.invalidateQueries({ queryKey: providerBillingKeys.history(providerId) }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: (payload: CreateBillingRatePayload) =>
      providerBillingApi.createBillingRate(providerId, payload),
    onSuccess: invalidate,
  });

  const createWithConfirmMutation = useMutation({
    mutationFn: (payload: CreateBillingRatePayload) =>
      providerBillingApi.createWithModeSwitchConfirm(providerId, payload),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ rateId, payload }: { rateId: number; payload: UpdateBillingRatePayload }) =>
      providerBillingApi.updateBillingRate(providerId, rateId, payload),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (rateId: number) => providerBillingApi.deleteBillingRate(providerId, rateId),
    onSuccess: invalidate,
  });

  return {
    createMutation,
    createWithConfirmMutation,
    updateMutation,
    deleteMutation,
  };
}
