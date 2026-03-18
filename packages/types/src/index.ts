export type NoticeSortOption =
  | "relevance"
  | "publishedAt:desc"
  | "closingAt:asc"
  | "estimatedValue:desc"
  | "estimatedValue:asc";

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
  noticeNumber?: string | null;
  updatedAt?: string | null;
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

export interface NoticeOfficialLink {
  id: string;
  label: string;
  url: string;
  kind: "document" | "source_system";
}

export interface NoticeItem {
  numeroItem: number;
  descricao: string;
  materialOuServico: string;
  materialOuServicoNome: string;
  valorUnitarioEstimado: number | null;
  valorTotal: number | null;
  quantidade: number | null;
  unidadeMedida: string | null;
  situacaoCompraItemNome: string | null;
  criterioJulgamentoNome: string | null;
  temResultado: boolean;
}

export interface NoticeArchive {
  sequencialDocumento: number;
  titulo: string;
  tipoDocumentoNome: string;
  url: string;
  statusAtivo: boolean;
}

export interface NoticeDetail extends NoticeListItem {
  complementaryInfo?: string | null;
  justification?: string | null;
  processNumber?: string | null;
  procurementType?: string | null;
  instrumentType?: string | null;
  portalUrl?: string | null;
  valorTotalHomologado?: number | null;
  amparoLegal?: string | null;
  processo?: string | null;
  srp?: boolean | null;
  linkSistemaOrigem?: string | null;
  linkProcessoEletronico?: string | null;
  orgaoEntidade?: string | null;
  unidadeOrgao?: string | null;
  cnpjOrgao?: string | null;
  items?: NoticeItem[];
  archives?: NoticeArchive[];
  officialLinks: NoticeOfficialLink[];
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
  userId?: string;
}

export interface AICitation {
  title: string;
  excerpt: string;
  attachmentId?: string;
  sourceUrl?: string;
  chunkIndex?: number;
  similarity?: number;
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

// --- AI Conversation Types ---
export interface AIConversationSummary {
  id: string;
  noticeId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface AIMessageItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: AICitation[];
  confidence?: "high" | "medium" | "low";
  createdAt: string;
}

// --- AI Training Rules Types ---
export interface AITrainingRuleItem {
  id: string;
  name: string;
  content: string;
  isActive: boolean;
  priority: number;
  createdAt: string;
}

export interface CreateTrainingRulePayload {
  name: string;
  content: string;
}

export interface UpdateTrainingRulePayload {
  name?: string;
  content?: string;
  isActive?: boolean;
  priority?: number;
}

// --- Document Processing Types ---
export interface DocumentProcessingStatus {
  noticeId: string;
  status: "idle" | "processing" | "done" | "error";
  chunksCount: number;
  embeddingsCount: number;
  message?: string;
}

// ── Analyzer ──
export type AnalyzerSectionName = "resumo" | "riscos" | "precos" | "documentos";

export interface AnalyzerSectionResult {
  content: string;
  generatedAt: string;
  confidence: "high" | "medium" | "low";
  metadata?: Record<string, unknown>;
}

export interface AnalyzerReportResponse {
  id: string;
  noticeId: string;
  resumo: AnalyzerSectionResult | null;
  riscos: AnalyzerSectionResult | null;
  precos: AnalyzerSectionResult | null;
  documentos: AnalyzerSectionResult | null;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateSectionRequest {
  userId?: string;
  force?: boolean;
}
