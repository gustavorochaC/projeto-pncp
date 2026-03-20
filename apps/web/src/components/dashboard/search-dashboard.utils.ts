"use client";

import {
  DEFAULT_NOTICE_MULTI_TERM_MODE,
  PNCP_PORTAL_PAGE_SIZE,
  type NoticeSearchFilters,
  parseSearchTerms,
} from "@pncp/types";
import { clampPortalPage } from "../../lib/notice-navigation";

export function formatPortalResultsSummary(
  showingCount: number,
  totalCount: number,
  isTotalExact = true,
): string {
  if (!isTotalExact) {
    return `Exibindo: ${showingCount} resultados consolidados`;
  }

  return `Exibindo: ${showingCount} de ${totalCount}`;
}

export function normalizePortalDashboardFilters(
  filters: NoticeSearchFilters,
): NoticeSearchFilters {
  const searchTerms = parseSearchTerms(filters.query);
  const multiTermMode =
    filters.multiTermMode === "same_notice"
      ? "same_notice"
      : DEFAULT_NOTICE_MULTI_TERM_MODE;
  const activeTerm = shouldShowSearchTermTabs(searchTerms, multiTermMode)
    ? resolveActiveTerm(filters.activeTerm, searchTerms)
    : undefined;

  return {
    ...filters,
    multiTermMode,
    activeTerm,
    page: clampPortalPage(filters.page) ?? 1,
    pageSize: PNCP_PORTAL_PAGE_SIZE,
  };
}

export function shouldShowSearchTermTabs(
  searchTerms: string[],
  multiTermMode: NoticeSearchFilters["multiTermMode"],
): boolean {
  return searchTerms.length > 1 && multiTermMode !== "same_notice";
}

function resolveActiveTerm(
  activeTerm: string | undefined,
  searchTerms: string[],
): string | undefined {
  if (!activeTerm) {
    return undefined;
  }

  const normalizedActiveTerm = activeTerm.trim().toLowerCase();
  if (!normalizedActiveTerm) {
    return undefined;
  }

  return searchTerms.find(
    (term) => term.trim().toLowerCase() === normalizedActiveTerm,
  );
}
