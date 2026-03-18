import type { NoticeDetail, NoticeSearchFilters } from "@pncp/types";

export interface ProcurementSourceAdapter {
  key: string;
  searchNotices(filters: NoticeSearchFilters): Promise<unknown[]>;
  getNoticeDetails(id: string): Promise<unknown>;
  getNoticeDocuments(id: string): Promise<unknown[]>;
  normalizeNotice(payload: unknown): Promise<NoticeDetail>;
  syncNotice(id: string): Promise<void>;
  syncSearchWindow(filters: NoticeSearchFilters): Promise<number>;
}
