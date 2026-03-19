import { describe, expect, it } from "vitest";
import {
  PNCP_PORTAL_MAX_PAGES,
  PNCP_PORTAL_PAGE_SIZE,
} from "@pncp/types";
import {
  formatPortalResultsSummary,
  normalizePortalDashboardFilters,
} from "./search-dashboard.utils";

describe("formatPortalResultsSummary", () => {
  it("formats the summary exactly like the PNCP portal", () => {
    expect(formatPortalResultsSummary(10, 9990)).toBe("Exibindo: 10 de 9990");
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
});
