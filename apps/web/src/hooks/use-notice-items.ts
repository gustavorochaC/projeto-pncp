"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export function useNoticeItems(id: string) {
  return useQuery({
    queryKey: ["notice-items", id],
    queryFn: () => apiClient.getNoticeItems(id),
    enabled: Boolean(id)
  });
}
