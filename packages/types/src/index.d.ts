export type NoticeSortOption = "relevance" | "publishedAt:desc" | "closingAt:asc" | "estimatedValue:desc" | "estimatedValue:asc";
export interface NoticeSearchFilters {
    query?: string;
    state?: string;
    city?: string;
    agency?: string;
    modality?: string;
    status?: string;
    publishedFrom?: string;
    publishedTo?: string;
    closingFrom?: string;
    closingTo?: string;
    estimatedValueMin?: number;
    estimatedValueMax?: number;
    procurementType?: string;
    processNumber?: string;
    identifier?: string;
    onlyOpen?: boolean;
    onlyWithAttachments?: boolean;
    page?: number;
    pageSize?: number;
    sort?: NoticeSortOption;
}
export interface NoticeListItem {
    id: string;
    externalId: string;
    source: string;
    agency: string;
    object: string;
    modality: string;
    status: string;
    state?: string | null;
    city?: string | null;
    publishedAt?: string | null;
    openingAt?: string | null;
    closingAt?: string | null;
    estimatedValue?: number | null;
    hasAttachments: boolean;
}
export interface NoticeAttachment {
    id: string;
    noticeId: string;
    fileName: string;
    mimeType?: string | null;
    fileSizeBytes?: number | null;
    sourceUrl: string;
    storagePath?: string | null;
    extractedTextStatus?: string | null;
}
export interface NoticeTimelineItem {
    label: string;
    value: string | null;
    kind: "published" | "opening" | "closing" | "updated";
}
export interface NoticeDetail extends NoticeListItem {
    complementaryInfo?: string | null;
    justification?: string | null;
    processNumber?: string | null;
    procurementType?: string | null;
    portalUrl?: string | null;
    documents: NoticeAttachment[];
    timeline: NoticeTimelineItem[];
}
export interface PaginatedResponse<T> {
    items: T[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
}
export interface AskAIRequest {
    question: string;
    conversationId?: string;
}
export interface AICitation {
    title: string;
    excerpt: string;
    attachmentId?: string;
    sourceUrl?: string;
}
export interface AskAIResponse {
    conversationId: string;
    answer: string;
    citations: AICitation[];
    confidence: "high" | "medium" | "low";
    missingInformation?: string[];
}
export interface SavedSearchPayload {
    name: string;
    filters: NoticeSearchFilters;
}
export interface AlertRulePayload {
    name: string;
    filters: NoticeSearchFilters;
    channel: "in_app" | "email";
    frequency: "instant" | "daily" | "weekly";
}
