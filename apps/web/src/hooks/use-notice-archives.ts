"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export function useNoticeArchives(id: string) {
  return useQuery({
    queryKey: ["notice-archives", id],
    queryFn: () => apiClient.getNoticeArchives(id),
    enabled: Boolean(id)
  });
}
