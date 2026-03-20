import { describe, expect, it } from "vitest";
import {
  PNCP_PORTAL_MAX_PAGES,
  PNCP_PORTAL_PAGE_SIZE,
} from "@pncp/types";
import {
  buildNoticeSearchParams,
  clampPortalPage,
  defaultNoticeFilters,
  parseNoticeFilters,
} from "./notice-navigation";

describe("defaultNoticeFilters", () => {
  it("uses the same page size as the PNCP portal", () => {
    expect(defaultNoticeFilters.pageSize).toBe(PNCP_PORTAL_PAGE_SIZE);
  });

  it("defaults multi-term searches to any mode", () => {
    expect(defaultNoticeFilters.multiTermMode).toBe("any");
  });
});

describe("clampPortalPage", () => {
  it("keeps the page inside the portal navigation range", () => {
    expect(clampPortalPage(undefined)).toBeUndefined();
    expect(clampPortalPage(0)).toBe(1);
    expect(clampPortalPage(12)).toBe(12);
    expect(clampPortalPage(1005)).toBe(PNCP_PORTAL_MAX_PAGES);
  });
});

describe("parseNoticeFilters", () => {
  it("clamps pages above the portal limit from the URL", () => {
    const filters = parseNoticeFilters({
      page: "1005",
    });

    expect(filters.page).toBe(PNCP_PORTAL_MAX_PAGES);
    expect(filters.pageSize).toBe(PNCP_PORTAL_PAGE_SIZE);
  });

  it("preserves comma-separated query terms from the URL", () => {
    const filters = parseNoticeFilters({
      query: "cadeiras, mesas",
      multiTermMode: "same_notice",
      activeTerm: "mesas",
    });

    expect(filters.query).toBe("cadeiras, mesas");
    expect(filters.multiTermMode).toBe("same_notice");
    expect(filters.activeTerm).toBe("mesas");
  });
});

describe("buildNoticeSearchParams", () => {
  it("serializes comma-separated query into a single URL param", () => {
    const params = buildNoticeSearchParams({
      query: "cadeiras, mesas",
      page: 1,
      pageSize: PNCP_PORTAL_PAGE_SIZE,
      sort: "publishedAt:desc",
    });

    expect(params.get("query")).toBe("cadeiras, mesas");
  });

  it("round-trips multi-term query through parse and build", () => {
    const original = "cadeiras, mesas, armarios";
    const params = buildNoticeSearchParams({
      query: original,
      multiTermMode: "same_notice",
      activeTerm: "mesas",
      page: 1,
      pageSize: PNCP_PORTAL_PAGE_SIZE,
      sort: "publishedAt:desc",
    });

    const parsed = parseNoticeFilters(
      Object.fromEntries(params.entries()),
    );

    expect(parsed.query).toBe(original);
    expect(parsed.multiTermMode).toBe("same_notice");
    expect(parsed.activeTerm).toBe("mesas");
  });

  it("omits the default multi-term mode from the URL", () => {
    const params = buildNoticeSearchParams({
      query: "cadeiras, mesas",
      multiTermMode: "any",
      page: 1,
      pageSize: PNCP_PORTAL_PAGE_SIZE,
      sort: "publishedAt:desc",
    });

    expect(params.has("multiTermMode")).toBe(false);
  });
});
