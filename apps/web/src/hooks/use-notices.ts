"use client";

import { useQuery } from "@tanstack/react-query";
import type { NoticeSearchFilters } from "@pncp/types";
import { apiClient } from "@/lib/api-client";

export function useNotices(filters: NoticeSearchFilters) {
  return useQuery({
    queryKey: ["notices", filters],
    queryFn: () => apiClient.getNotices(filters)
  });
}
