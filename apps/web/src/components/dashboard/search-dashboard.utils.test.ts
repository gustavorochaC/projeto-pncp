import { describe, expect, it } from "vitest";
import {
  DEFAULT_NOTICE_MULTI_TERM_MODE,
  PNCP_PORTAL_MAX_PAGES,
  PNCP_PORTAL_PAGE_SIZE,
} from "@pncp/types";
import {
  formatPortalResultsSummary,
  normalizePortalDashboardFilters,
  shouldShowSearchTermTabs,
} from "./search-dashboard.utils";

describe("formatPortalResultsSummary", () => {
  it("formats the summary exactly like the PNCP portal", () => {
    expect(formatPortalResultsSummary(10, 9990)).toBe("Exibindo: 10 de 9990");
  });

  it("shows a consolidated summary when the total is not exact", () => {
    expect(formatPortalResultsSummary(10, 9990, false)).toBe(
      "Exibindo: 10 resultados consolidados",
    );
  });
});

describe("normalizePortalDashboardFilters", () => {
  it("forces the dashboard to use the portal page size", () => {
    const filters = normalizePortalDashboardFilters({
      query: "cadeiras",
      page: 1005,
      pageSize: 20,
    });

    expect(filters.page).toBe(PNCP_PORTAL_MAX_PAGES);
    expect(filters.pageSize).toBe(PNCP_PORTAL_PAGE_SIZE);
  });

  it("defaults the multi-term mode and removes invalid active terms", () => {
    const filters = normalizePortalDashboardFilters({
      query: "cadeiras, mesas",
      activeTerm: "armarios",
    });

    expect(filters.multiTermMode).toBe(DEFAULT_NOTICE_MULTI_TERM_MODE);
    expect(filters.activeTerm).toBeUndefined();
  });

  it("keeps the active term only when tabs should be visible", () => {
    const filters = normalizePortalDashboardFilters({
      query: "cadeiras, mesas",
      multiTermMode: "any",
      activeTerm: "Mesas",
    });

    expect(filters.activeTerm).toBe("mesas");
  });
});

describe("shouldShowSearchTermTabs", () => {
  it("shows tabs only for any-mode multi-term searches", () => {
    expect(shouldShowSearchTermTabs(["cadeiras"], "any")).toBe(false);
    expect(shouldShowSearchTermTabs(["cadeiras", "mesas"], "same_notice")).toBe(false);
    expect(shouldShowSearchTermTabs(["cadeiras", "mesas"], "any")).toBe(true);
  });
});
