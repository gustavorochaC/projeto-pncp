export type NoticeSortOption =
  | "relevance"
  | "publishedAt:desc"
  | "closingAt:asc"
  | "estimatedValue:desc"
  | "estimatedValue:asc";

export const PNCP_PORTAL_PAGE_SIZE = 10;
export const PNCP_PORTAL_MAX_RESULTS = 9990;
export const PNCP_PORTAL_MAX_PAGES = 999;

/**
 * Splits a comma-separated query string into unique, trimmed terms.
 * Preserves the original casing but deduplicates case-insensitively.
 * Returns an empty array for null/undefined/blank input.
 *
 * Future: this function is the single normalization point for search terms.
 * When saved keyword groups are implemented, the group's terms can be fed
 * through this same pipeline to reuse the OR semantics on the backend.
 * TODO(saved-keyword-groups): CRUD for keyword groups, persistence, and UI.
 */
export function parseSearchTerms(query: string | null | undefined): string[] {
  if (!query) {
    return [];
  }

  const seen = new Set<string>();
  return query
    .split(",")
    .map((term) => term.trim())
    .filter((term) => {
      if (term.length === 0) {
        return false;
      }
      const lower = term.toLowerCase();
      if (seen.has(lower)) {
        return false;
      }
      seen.add(lower);
      return true;
    });
}

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
  mode?: "default" | "participation_requirements";
}

export interface AICitation {
  title: string;
  excerpt: string;
  attachmentId?: string;
  sourceUrl?: string;
  chunkIndex?: number;
  similarity?: number;
}

export type ParticipationRequirementCategory =
  | "habilitacao_juridica"
  | "regularidade_fiscal_trabalhista"
  | "qualificacao_economico_financeira"
  | "qualificacao_tecnica"
  | "certificacao"
  | "registro_licenca_credenciamento"
  | "declaracao_obrigatoria"
  | "outro_requisito_de_participacao";

export interface ParticipationRequirement {
  category: ParticipationRequirementCategory;
  subcategory: string;
  requirement: string;
  normalizedTerm: string;
  mandatoryLevel: "mandatory" | "conditional" | "optional" | "unclear";
  appliesTo: string;
  sourceDocument: string;
  evidenceExcerpt: string;
  confidence: "high" | "medium" | "low";
}

export interface ParticipationInference extends ParticipationRequirement {
  reasoning: string;
}

export interface ParticipationMissingEvidence {
  topic: string;
  reason: string;
  recommendedFollowup: string;
}

export interface ParticipationRequirementsResult {
  kind: "participation_requirements";
  explicitRequirements: ParticipationRequirement[];
  possibleInferences: ParticipationInference[];
  missingEvidence: ParticipationMissingEvidence[];
  documentsReviewed: string[];
  analysisNotes: string[];
}

export type AIMessageStructuredData = ParticipationRequirementsResult;

export interface AskAIResponse {
  conversationId: string;
  answer: string;
  citations: AICitation[];
  confidence: "high" | "medium" | "low";
  missingInformation?: string[];
  structuredData?: AIMessageStructuredData;
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
  structuredData?: AIMessageStructuredData;
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
export type AnalyzerSectionName =
  | "resumo"
  | "riscos"
  | "precos"
  | "documentos"
  | "requisitosParticipacao";

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
  requisitosParticipacao: AnalyzerSectionResult | null;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateSectionRequest {
  userId?: string;
  force?: boolean;
}
