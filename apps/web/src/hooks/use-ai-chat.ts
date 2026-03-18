"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { AskAIRequest } from "@pncp/types";

export function useAskAI(noticeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AskAIRequest) => apiClient.askAI(noticeId, payload),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["conversations", noticeId] });
      void queryClient.invalidateQueries({ queryKey: ["messages", data.conversationId] });
      void queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
  });
}

export function useConversations(noticeId: string) {
  return useQuery({
    queryKey: ["conversations", noticeId],
    queryFn: () => apiClient.getConversations(noticeId),
    enabled: Boolean(noticeId),
  });
}

export function useConversationMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () => apiClient.getConversationMessages(conversationId!),
    enabled: Boolean(conversationId),
  });
}

export function useProcessDocuments(noticeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.processDocuments(noticeId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["processingStatus", noticeId] });
    },
  });
}

export function useAIStatus() {
  return useQuery({
    queryKey: ["aiStatus"],
    queryFn: () => apiClient.getAIStatus(),
    refetchInterval: 30_000,
    staleTime: 20_000,
  });
}

export function useProcessingStatus(noticeId: string) {
  return useQuery({
    queryKey: ["processingStatus", noticeId],
    queryFn: () => apiClient.getProcessingStatus(noticeId),
    enabled: Boolean(noticeId),
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.status === "processing" ? 2000 : false;
    },
  });
}
