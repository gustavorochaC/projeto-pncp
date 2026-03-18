"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { CreateTrainingRulePayload, UpdateTrainingRulePayload } from "@pncp/types";

export function useTrainingRules() {
  return useQuery({
    queryKey: ["trainingRules"],
    queryFn: () => apiClient.getTrainingRules(),
  });
}

export function useCreateTrainingRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTrainingRulePayload) =>
      apiClient.createTrainingRule(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["trainingRules"] });
    },
  });
}

export function useUpdateTrainingRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateTrainingRulePayload }) =>
      apiClient.updateTrainingRule(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["trainingRules"] });
    },
  });
}

export function useDeleteTrainingRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.deleteTrainingRule(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["trainingRules"] });
    },
  });
}
