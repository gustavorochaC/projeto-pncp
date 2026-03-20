import {
  DEFAULT_NOTICE_MULTI_TERM_MODE,
  PNCP_PORTAL_MAX_PAGES,
  PNCP_PORTAL_PAGE_SIZE,
  isNoticeMultiTermMode,
  type NoticeSearchFilters,
  type NoticeSortOption,
} from "@pncp/types";

export const NOTICE_RETURN_TO_PARAM = "returnTo";
export const NOTICE_HIGHLIGHT_PARAM = "highlightNotice";

export const defaultNoticeFilters: NoticeSearchFilters = {
  query: "",
  multiTermMode: DEFAULT_NOTICE_MULTI_TERM_MODE,
  state: "",
  city: "",
  modality: "",
  page: 1,
  pageSize: PNCP_PORTAL_PAGE_SIZE,
  sort: "publishedAt:desc",
};

const SORT_OPTIONS = new Set<NoticeSortOption>([
  "relevance",
  "publishedAt:desc",
  "closingAt:asc",
  "estimatedValue:desc",
  "estimatedValue:asc",
]);

function getFirstValue(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function parsePositiveNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return undefined;
  }

  return parsedValue;
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (!value) {
    return undefined;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return undefined;
}

function isSortOption(value: string | undefined): value is NoticeSortOption {
  return Boolean(value && SORT_OPTIONS.has(value as NoticeSortOption));
}

export function clampPortalPage(page: number | undefined): number | undefined {
  if (page === undefined) {
    return undefined;
  }

  return Math.max(1, Math.min(PNCP_PORTAL_MAX_PAGES, page));
}

export function parseNoticeFilters(
  params: Record<string, string | string[] | undefined>,
): NoticeSearchFilters {
  const query = getFirstValue(params.query) ?? defaultNoticeFilters.query;
  const state = getFirstValue(params.state) ?? defaultNoticeFilters.state;
  const city = getFirstValue(params.city) ?? defaultNoticeFilters.city;
  const modality =
    getFirstValue(params.modality) ?? defaultNoticeFilters.modality;
  const page =
    clampPortalPage(parsePositiveNumber(getFirstValue(params.page))) ??
    defaultNoticeFilters.page;
  const pageSize =
    parsePositiveNumber(getFirstValue(params.pageSize)) ??
    defaultNoticeFilters.pageSize;
  const sortValue = getFirstValue(params.sort);
  const sort = isSortOption(sortValue)
    ? sortValue
    : defaultNoticeFilters.sort;
  const multiTermModeValue = getFirstValue(params.multiTermMode);
  const multiTermMode = isNoticeMultiTermMode(multiTermModeValue)
    ? multiTermModeValue
    : defaultNoticeFilters.multiTermMode;

  return {
    ...defaultNoticeFilters,
    query,
    multiTermMode,
    activeTerm: getFirstValue(params.activeTerm),
    state,
    city,
    agency: getFirstValue(params.agency),
    modality,
    status: getFirstValue(params.status),
    publishedFrom: getFirstValue(params.publishedFrom),
    publishedTo: getFirstValue(params.publishedTo),
    closingFrom: getFirstValue(params.closingFrom),
    closingTo: getFirstValue(params.closingTo),
    estimatedValueMin: parsePositiveNumber(
      getFirstValue(params.estimatedValueMin),
    ),
    estimatedValueMax: parsePositiveNumber(
      getFirstValue(params.estimatedValueMax),
    ),
    procurementType: getFirstValue(params.procurementType),
    processNumber: getFirstValue(params.processNumber),
    identifier: getFirstValue(params.identifier),
    onlyOpen: parseBoolean(getFirstValue(params.onlyOpen)),
    onlyWithAttachments: parseBoolean(
      getFirstValue(params.onlyWithAttachments),
    ),
    page,
    pageSize,
    sort,
  };
}

export function buildNoticeSearchParams(
  filters: NoticeSearchFilters,
): URLSearchParams {
  const searchParams = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value == null || value === "" || value === false) {
      return;
    }

    if (
      key === "multiTermMode" &&
      value === DEFAULT_NOTICE_MULTI_TERM_MODE
    ) {
      return;
    }

    searchParams.set(key, String(value));
  });

  return searchParams;
}

export function buildReturnTo(
  pathname: string,
  searchParams: { toString(): string },
): string {
  const normalizedSearchParams = new URLSearchParams(searchParams.toString());
  normalizedSearchParams.delete(NOTICE_HIGHLIGHT_PARAM);
  normalizedSearchParams.delete(NOTICE_RETURN_TO_PARAM);
  const queryString = normalizedSearchParams.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

export function buildNoticeDetailHref(
  noticeId: string,
  returnTo?: string | null,
): string {
  const searchParams = new URLSearchParams();

  if (returnTo) {
    searchParams.set(NOTICE_RETURN_TO_PARAM, returnTo);
  }

  const queryString = searchParams.toString();
  return queryString ? `/notices/${noticeId}?${queryString}` : `/notices/${noticeId}`;
}

export function resolveSafeReturnTo(
  returnTo: string | null | undefined,
): string | null {
  if (!returnTo || !returnTo.startsWith("/") || returnTo.startsWith("//")) {
    return null;
  }

  return returnTo;
}

export function appendHighlightToReturnTo(
  returnTo: string,
  noticeId: string,
): string {
  const url = new URL(returnTo, "http://localhost");
  url.searchParams.set(NOTICE_HIGHLIGHT_PARAM, noticeId);
  return `${url.pathname}${url.search}`;
}
