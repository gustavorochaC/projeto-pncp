"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { AnalyzerSectionName, GenerateSectionRequest } from "@pncp/types";

export function useAnalyzerReport(noticeId: string | null) {
  return useQuery({
    queryKey: ["analyzerReport", noticeId],
    queryFn: () => apiClient.getAnalyzerReport(noticeId!),
    enabled: Boolean(noticeId),
  });
}

export function useGenerateSection(noticeId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ section, body }: { section: AnalyzerSectionName; body: GenerateSectionRequest }) =>
      apiClient.analyzeSection(noticeId!, section, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["analyzerReport", noticeId] });
    },
  });
}
