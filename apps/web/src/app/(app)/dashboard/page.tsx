import { SearchDashboard } from "@/components/dashboard/search-dashboard";
import {
  NOTICE_HIGHLIGHT_PARAM,
  parseNoticeFilters,
} from "@/lib/notice-navigation";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const highlightValue = resolvedSearchParams[NOTICE_HIGHLIGHT_PARAM];

  return (
    <SearchDashboard
      initialFilters={parseNoticeFilters(resolvedSearchParams)}
      initialHighlightNoticeId={
        Array.isArray(highlightValue) ? highlightValue[0] ?? null : highlightValue ?? null
      }
    />
  );
}
