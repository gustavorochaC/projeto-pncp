"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export function useNotice(id: string) {
  return useQuery({
    queryKey: ["notice", id],
    queryFn: () => apiClient.getNotice(id),
    enabled: Boolean(id)
  });
}
