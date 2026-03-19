"use client";

import {
  PNCP_PORTAL_PAGE_SIZE,
  type NoticeSearchFilters,
} from "@pncp/types";
import { clampPortalPage } from "../../lib/notice-navigation";

export function formatPortalResultsSummary(
  showingCount: number,
  totalCount: number,
): string {
  return `Exibindo: ${showingCount} de ${totalCount}`;
}

export function normalizePortalDashboardFilters(
  filters: NoticeSearchFilters,
): NoticeSearchFilters {
  return {
    ...filters,
    page: clampPortalPage(filters.page) ?? 1,
    pageSize: PNCP_PORTAL_PAGE_SIZE,
  };
}
