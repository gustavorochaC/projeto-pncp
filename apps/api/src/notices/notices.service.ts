import { Injectable, Logger } from "@nestjs/common";
import { PncpEditalStatus, type Prisma } from "@prisma/client";
import type {
  NoticeAttachment,
  NoticeDetail,
  NoticeListItem,
  NoticeOfficialLink,
  NoticeSearchResponse,
} from "@pncp/types";
import { PNCP_PORTAL_PAGE_SIZE } from "@pncp/types";
import { AIService } from "../ai/ai.service";
import { DocumentProcessorService } from "../ai/rag/document-processor.service";
import { PrismaService } from "../common/prisma.service";
import { PncpAdapter } from "../sources/pncp.adapter";
import { isLegacyPncpPortalUrl } from "../sources/pncp-publication.util";
import { PncpConsultaService } from "../sources/pncp-consulta.service";
import {
  PncpSearchService,
  normalizePortalSearchPage,
  resolvePncpSearchStatus
} from "../sources/pncp-search.service";
import type { AskAIDto } from "./dto/ask-ai.dto";
import type { NoticeQueryDto } from "./dto/notice-query.dto";
import {
  mapPncpSearchItemToPersistableEdital,
  mapPncpEditalRowToNoticeListItem,
  type NoticeListRow,
  noticeListSelect
} from "./notice-search.mapper";
import {
  buildNoticeSearchTermGroups,
  createNoticeSearchTermContext,
  evaluateNoticeSearchRows,
  filterEvaluationsByContext,
  type NoticeSearchTermContext
} from "./notice-search-term.util";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = PNCP_PORTAL_PAGE_SIZE;
const MAX_PAGE_SIZE = 100;
type SearchItems = Awaited<ReturnType<PncpSearchService["searchEditais"]>>["items"];
const CLOSED_STATUSES: PncpEditalStatus[] = [
  PncpEditalStatus.ENCERRADO,
  PncpEditalStatus.REVOGADO,
  PncpEditalStatus.ANULADO,
  PncpEditalStatus.SUSPENSO
];

@Injectable()
export class NoticesService {
  private readonly logger = new Logger(NoticesService.name);

  constructor(
    private readonly aiService: AIService,
    private readonly pncpAdapter: PncpAdapter,
    private readonly pncpConsultaService: PncpConsultaService,
    private readonly pncpSearchService: PncpSearchService,
    private readonly prisma: PrismaService,
    private readonly documentProcessorService: DocumentProcessorService
  ) {}

  async search(query: NoticeQueryDto): Promise<NoticeSearchResponse> {
    const searchContext = createNoticeSearchTermContext(query);
    const terms = searchContext.terms;

    if (terms.length > 1) {
      return this.searchMultiTerm(query, searchContext);
    }

    if (!this.shouldQueryPncp(query)) {
      return this.searchFromLocalCache(query, searchContext);
    }

    try {
      return await this.searchFromPncp(query, searchContext);
    } catch (error) {
      const localResult = await this.searchFromLocalCache(query, searchContext);
      this.logger.warn(
        `Busca remota do PNCP indisponivel. Usando cache local. Motivo: ${stringifyUnknown(error)}`
      );
      return localResult;
    }
  }

  async getDetail(id: string): Promise<NoticeDetail> {
    const edital = await this.prisma.pncpEdital.findUniqueOrThrow({
      where: { id }
    });

    const officialDocumentUrl = sanitizePublicUrl(edital.linkEdital, edital.portalUrl);
    const sourceSystemUrl = sanitizePublicUrl(edital.linkSistemaOrigem, edital.portalUrl);
    const documents: NoticeAttachment[] = officialDocumentUrl
      ? [
          {
            id: `${edital.id}-primary`,
            noticeId: edital.id,
            fileName: "Documento oficial",
            mimeType: "application/pdf",
            sourceUrl: officialDocumentUrl
          }
        ]
      : [];

    const officialLinks = this.buildOfficialLinks(
      edital.id,
      officialDocumentUrl,
      sourceSystemUrl
    );

    const raw = edital.rawPayload as Record<string, unknown> | null;
    const tipoNome = typeof raw?.tipoNome === "string" ? raw.tipoNome : null;

    // Fetch items and archives in parallel (fail-safe: empty arrays on error)
    const [items, archives] = await Promise.all([
      edital.cnpjOrgao && edital.anoCompra && edital.sequencialCompra
        ? this.pncpConsultaService.getItens({
            cnpjOrgao: edital.cnpjOrgao,
            anoCompra: edital.anoCompra,
            sequencialCompra: edital.sequencialCompra
          }).catch(() => [])
        : Promise.resolve([]),
      edital.cnpjOrgao && edital.anoCompra && edital.sequencialCompra
        ? this.pncpConsultaService.getArquivos({
            cnpjOrgao: edital.cnpjOrgao,
            anoCompra: edital.anoCompra,
            sequencialCompra: edital.sequencialCompra
          }).catch(() => [])
        : Promise.resolve([])
    ]);

    // Build archive URLs
    const pncpArchives = archives.map((arq) => ({
      sequencialDocumento: arq.sequencialDocumento,
      titulo: arq.titulo,
      tipoDocumentoNome: arq.tipoDocumentoNome,
      statusAtivo: arq.statusAtivo,
      url: `https://pncp.gov.br/api/pncp/v1/orgaos/${edital.cnpjOrgao}/compras/${edital.anoCompra}/${edital.sequencialCompra}/arquivos/${arq.sequencialDocumento}`
    }));

    const noticeItems = items.map((item) => ({
      numeroItem: item.numeroItem,
      descricao: item.descricao,
      materialOuServico: item.materialOuServico,
      materialOuServicoNome: item.materialOuServicoNome,
      valorUnitarioEstimado: typeof item.valorUnitarioEstimado === "number" ? item.valorUnitarioEstimado : null,
      valorTotal: typeof item.valorTotal === "number" ? item.valorTotal : null,
      quantidade: typeof item.quantidade === "number" ? item.quantidade : null,
      unidadeMedida: typeof item.unidadeMedida === "string" ? item.unidadeMedida : null,
      situacaoCompraItemNome: typeof item.situacaoCompraItemNome === "string" ? item.situacaoCompraItemNome : null,
      criterioJulgamentoNome: typeof item.criterioJulgamentoNome === "string" ? item.criterioJulgamentoNome : null,
      temResultado: item.temResultado === true
    }));

    return this.pncpAdapter.normalizeNotice({
      ...edital,
      pncp_id: edital.pncpId,
      nome_orgao: edital.nomeOrgao,
      objeto_compra: edital.objetoCompra,
      modalidade_nome: edital.modalidadeNome,
      situacao_nome: edital.situacaoNome,
      municipio_nome: edital.municipioNome,
      data_publicacao_pncp: edital.dataPublicacaoPncp?.toISOString(),
      data_abertura_proposta: edital.dataAberturaProposta?.toISOString(),
      data_encerramento_proposta: edital.dataEncerramentoProposta?.toISOString(),
      data_ultima_atualizacao_pncp: edital.dataUltimaAtualizacao?.toISOString(),
      valor_total_estimado: edital.valorTotalEstimado ? Number(edital.valorTotalEstimado) : null,
      valor_total_homologado: edital.valorTotalHomologado ? Number(edital.valorTotalHomologado) : null,
      informacao_complementar: edital.informacaoComplementar,
      justificativa: edital.justificativa,
      numero_controle_pncp: edital.numeroControlePncp,
      modo_disputa_nome: edital.modoDisputaNome,
      tipo_nome: tipoNome,
      link_sistema_origem: edital.linkSistemaOrigem,
      link_edital: officialDocumentUrl,
      portal_url: edital.portalUrl,
      cnpj_orgao: edital.cnpjOrgao,
      nome_unidade: edital.nomeUnidade,
      official_links: officialLinks,
      documents,
      items: noticeItems,
      archives: pncpArchives
    });
  }

  async getDocuments(id: string) {
    const notice = await this.getDetail(id);
    return notice.documents;
  }

  async getNoticeItems(id: string) {
    const edital = await this.prisma.pncpEdital.findUniqueOrThrow({ where: { id } });
    if (!edital.cnpjOrgao || !edital.anoCompra || !edital.sequencialCompra) {
      return [];
    }
    return this.pncpConsultaService.getItens({
      cnpjOrgao: edital.cnpjOrgao,
      anoCompra: edital.anoCompra,
      sequencialCompra: edital.sequencialCompra
    }).catch(() => []);
  }

  async getNoticeArchives(id: string) {
    const edital = await this.prisma.pncpEdital.findUniqueOrThrow({ where: { id } });
    if (!edital.cnpjOrgao || !edital.anoCompra || !edital.sequencialCompra) {
      return [];
    }
    const arquivos = await this.pncpConsultaService.getArquivos({
      cnpjOrgao: edital.cnpjOrgao,
      anoCompra: edital.anoCompra,
      sequencialCompra: edital.sequencialCompra
    }).catch(() => []);
    return arquivos.map((arq) => ({
      ...arq,
      url: `https://pncp.gov.br/api/pncp/v1/orgaos/${edital.cnpjOrgao}/compras/${edital.anoCompra}/${edital.sequencialCompra}/arquivos/${arq.sequencialDocumento}`
    }));
  }

  async askAI(id: string, payload: AskAIDto) {
    return this.aiService.answerNoticeQuestion(id, payload);
  }

  async processDocuments(id: string) {
    return this.documentProcessorService.processNoticeDocuments(id);
  }

  async getProcessingStatus(id: string) {
    return this.documentProcessorService.getProcessingStatus(id);
  }

  private async searchFromPncp(
    query: NoticeQueryDto,
    searchContext: NoticeSearchTermContext
  ): Promise<NoticeSearchResponse> {
    const page = normalizePortalSearchPage(query.page);
    const pageSize = normalizePageSize(query.pageSize);
    const remoteResult = await this.pncpSearchService.searchEditais({
      ...query,
      page,
      pageSize
    });
    const items = await this.persistSearchItems(remoteResult.items);
    return buildNoticeSearchResponse({
      items,
      page,
      pageSize,
      total: remoteResult.total,
      searchContext,
      termGroups: [],
      isTotalExact: true
    });
  }

  private async searchFromLocalCache(
    query: NoticeQueryDto,
    searchContext: NoticeSearchTermContext,
    options?: {
      termGroups?: NoticeSearchResponse["termGroups"];
      isTotalExact?: boolean;
    }
  ): Promise<NoticeSearchResponse> {
    const page = normalizePage(query.page);
    const pageSize = normalizePageSize(query.pageSize);
    const skip = (page - 1) * pageSize;
    const orderBy = this.buildOrderBy(query.sort);
    const where = this.buildBaseSearchWhere(query);

    if (searchContext.hasTerms) {
      const rows = await this.prisma.pncpEdital.findMany({
        where,
        orderBy,
        select: noticeListSelect
      });
      const evaluations = evaluateNoticeSearchRows(rows, searchContext);
      const filteredRows = filterEvaluationsByContext(evaluations, searchContext).map(
        (evaluation) => evaluation.row
      );
      const paginatedRows = filteredRows.slice(skip, skip + pageSize);

      return buildNoticeSearchResponse({
        items: paginatedRows.map((row) => mapPncpEditalRowToNoticeListItem(row)),
        page,
        pageSize,
        total: filteredRows.length,
        searchContext,
        termGroups:
          options?.termGroups ??
          buildNoticeSearchTermGroups(evaluations, searchContext.terms),
        isTotalExact: options?.isTotalExact ?? true
      });
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.pncpEdital.count({ where }),
      this.prisma.pncpEdital.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        select: noticeListSelect
      })
    ]);

    return buildNoticeSearchResponse({
      items: rows.map((row) => mapPncpEditalRowToNoticeListItem(row)),
      page,
      pageSize,
      total,
      searchContext,
      termGroups: [],
      isTotalExact: options?.isTotalExact ?? true
    });
  }

  private async searchMultiTerm(
    query: NoticeQueryDto,
    searchContext: NoticeSearchTermContext
  ): Promise<NoticeSearchResponse> {
    if (this.shouldQueryPncp(query)) {
      try {
        const remoteSnapshot = await this.prefetchPncpForTerms(
          query,
          searchContext.terms,
          searchContext.activeTerm
        );

        if (searchContext.mode === "any" && searchContext.activeTerm && remoteSnapshot.activeTermResult) {
          return buildNoticeSearchResponse({
            items: await this.fetchPersistedItemsBySearchItems(remoteSnapshot.activeTermResult.items),
            page: normalizePortalSearchPage(query.page),
            pageSize: normalizePageSize(query.pageSize),
            total: remoteSnapshot.activeTermResult.total,
            searchContext,
            termGroups: remoteSnapshot.termGroups,
            isTotalExact: true
          });
        }

        return this.searchFromLocalCache(query, searchContext, {
          termGroups: remoteSnapshot.termGroups,
          isTotalExact: false
        });
      } catch (error) {
        this.logger.warn(
          `Prefetch remoto para busca multi-termo falhou. Usando cache local. Motivo: ${stringifyUnknown(error)}`
        );
      }
    }

    return this.searchFromLocalCache(query, searchContext);
  }

  private async prefetchPncpForTerms(
    query: NoticeQueryDto,
    terms: string[],
    activeTerm: string | null
  ): Promise<{
    activeTermResult: Awaited<ReturnType<PncpSearchService["searchEditais"]>> | null;
    termGroups: NoticeSearchResponse["termGroups"];
  }> {
    const page = normalizePortalSearchPage(query.page);
    const pageSize = normalizePageSize(query.pageSize);
    const results = await Promise.allSettled(
      terms.map((term) =>
        this.pncpSearchService.searchEditais({
          ...query,
          query: term,
          page: activeTerm === term ? page : 1,
          pageSize: activeTerm ? (activeTerm === term ? pageSize : 1) : pageSize
        })
      )
    );

    const fulfilledResults = results.flatMap((result, index) =>
      result.status === "fulfilled"
        ? [
            {
              term: terms[index] ?? "",
              result: result.value
            }
          ]
        : []
    );
    const allItems = fulfilledResults.flatMap(({ result }) => result.items);

    if (allItems.length > 0) {
      await this.persistSearchItems(allItems);
    }

    return {
      activeTermResult:
        fulfilledResults.find(({ term }) => term === activeTerm)?.result ?? null,
      termGroups: fulfilledResults.map(({ term, result }) => ({
        term,
        total: result.total
      }))
    };
  }

  private async persistSearchItems(
    items: SearchItems
  ): Promise<NoticeListItem[]> {
    if (items.length === 0) {
      return [];
    }

    const fetchedAt = new Date();
    const mappedItems = items
      .map((item) => mapPncpSearchItemToPersistableEdital(item, fetchedAt))
      .filter((item): item is NonNullable<typeof item> => item !== null);

    if (mappedItems.length === 0) {
      return [];
    }

    await Promise.all(
      mappedItems.map((mapped) =>
        this.prisma.pncpEdital.upsert({
          where: { pncpId: mapped.create.pncpId },
          create: mapped.create,
          update: mapped.update
        })
      )
    );

    return this.fetchPersistedItemsBySearchItems(items);
  }

  private async fetchPersistedItemsBySearchItems(items: SearchItems): Promise<NoticeListItem[]> {
    const pncpIds = items
      .map((item) => cleanText(item.numero_controle_pncp))
      .filter((value): value is string => value !== null);

    if (pncpIds.length === 0) {
      return [];
    }

    return this.fetchPersistedItemsByPncpIds(pncpIds);
  }

  private async fetchPersistedItemsByPncpIds(pncpIds: string[]): Promise<NoticeListItem[]> {
    const rows = await this.prisma.pncpEdital.findMany({
      where: {
        pncpId: {
          in: pncpIds
        }
      },
      select: noticeListSelect
    });

    const rowsByPncpId = new Map<string, NoticeListRow>(
      rows.map((row) => [row.pncpId, row])
    );

    return pncpIds
      .map((pncpId) => rowsByPncpId.get(pncpId) ?? null)
      .filter((row): row is NoticeListRow => row !== null)
      .map((row) => mapPncpEditalRowToNoticeListItem(row));
  }

  private shouldQueryPncp(query: NoticeQueryDto): boolean {
    if (hasUnsupportedRemoteFilters(query)) {
      return false;
    }

    return resolvePncpSearchStatus(query) !== null;
  }

  private buildBaseSearchWhere(query: NoticeQueryDto): Prisma.PncpEditalWhereInput {
    const conditions: Prisma.PncpEditalWhereInput[] = [
      {
        OR: [
          { isPublishedOnPncp: true },
          { isPublishedOnPncp: null }
        ]
      }
    ];

    const state = cleanText(query.state)?.toUpperCase();
    if (state) {
      conditions.push({
        uf: {
          equals: state,
          mode: "insensitive"
        }
      });
    }

    const city = cleanText(query.city);
    if (city) {
      conditions.push({ municipioNome: containsInsensitive(city) });
    }

    const agency = cleanText(query.agency);
    if (agency) {
      conditions.push({ nomeOrgao: containsInsensitive(agency) });
    }

    const agencyId = cleanText(query.agencyId);
    if (agencyId) {
      conditions.push({ cnpjOrgao: containsInsensitive(agencyId.replace(/\D/g, "")) });
    }

    const modality = cleanText(query.modality);
    if (modality) {
      conditions.push({ modalidadeNome: containsInsensitive(modality) });
    }

    const modalityId = cleanText(query.modalityId);
    if (modalityId) {
      conditions.push({ codigoModalidade: { equals: modalityId } });
    }

    const municipioId = cleanText(query.municipioId);
    if (municipioId) {
      conditions.push({ municipioIbge: { equals: municipioId } });
    }

    const statusFilter = this.buildStatusFilter(query.status);
    if (statusFilter) {
      conditions.push(statusFilter);
    }

    const publishedRange = buildDateRangeFilter(query.publishedFrom, query.publishedTo);
    if (publishedRange) {
      conditions.push({ dataPublicacaoPncp: publishedRange });
    }

    const closingRange = buildDateRangeFilter(query.closingFrom, query.closingTo);
    if (closingRange) {
      conditions.push({ dataEncerramentoProposta: closingRange });
    }

    if (typeof query.estimatedValueMin === "number" || typeof query.estimatedValueMax === "number") {
      const range: Prisma.DecimalNullableFilter = {};
      if (typeof query.estimatedValueMin === "number") {
        range.gte = query.estimatedValueMin;
      }
      if (typeof query.estimatedValueMax === "number") {
        range.lte = query.estimatedValueMax;
      }
      conditions.push({ valorTotalEstimado: range });
    }

    if (query.onlyWithAttachments) {
      conditions.push({ linkEdital: { not: null } });
    }

    if (query.onlyOpen) {
      conditions.push({
        OR: [
          { status: null },
          {
            status: {
              notIn: CLOSED_STATUSES
            }
          }
        ]
      });
      conditions.push({
        OR: [
          { dataEncerramentoProposta: null },
          { dataEncerramentoProposta: { gte: new Date() } }
        ]
      });
    }

    return {
      AND: conditions
    };
  }

  private buildStatusFilter(statusValue?: string): Prisma.PncpEditalWhereInput | null {
    const normalized = cleanText(statusValue)?.toLowerCase();
    if (!normalized) {
      return null;
    }

    const mappedStatus = mapStatusTextToEnum(normalized);
    if (mappedStatus) {
      return { status: mappedStatus };
    }

    return {
      situacaoNome: containsInsensitive(normalized)
    };
  }

  private buildOrderBy(
    sort: NoticeQueryDto["sort"]
  ): Prisma.PncpEditalOrderByWithRelationInput[] {
    switch (sort) {
      case "closingAt:asc":
        return [{ dataEncerramentoProposta: "asc" }, { dataPublicacaoPncp: "desc" }];
      case "estimatedValue:desc":
        return [{ valorTotalEstimado: "desc" }, { dataPublicacaoPncp: "desc" }];
      case "estimatedValue:asc":
        return [{ valorTotalEstimado: "asc" }, { dataPublicacaoPncp: "desc" }];
      case "relevance":
      case "publishedAt:desc":
      default:
        return [{ dataPublicacaoPncp: "desc" }, { dataUltimaAtualizacao: "desc" }];
    }
  }

  private buildOfficialLinks(
    noticeId: string,
    officialDocumentUrl: string | null,
    sourceSystemUrl: string | null
  ): NoticeOfficialLink[] {
    if (officialDocumentUrl) {
      return [
        {
          id: `${noticeId}-official-document`,
          label: "Documento oficial",
          url: officialDocumentUrl,
          kind: "document"
        }
      ];
    }

    if (sourceSystemUrl) {
      return [
        {
          id: `${noticeId}-source-system`,
          label: "Sistema de origem",
          url: sourceSystemUrl,
          kind: "source_system"
        }
      ];
    }

    return [];
  }
}

function normalizePage(value: number | undefined): number {
  if (!Number.isFinite(value) || value === undefined) {
    return DEFAULT_PAGE;
  }

  return Math.max(DEFAULT_PAGE, Math.trunc(value));
}

function normalizePageSize(value: number | undefined): number {
  if (!Number.isFinite(value) || value === undefined) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.max(1, Math.min(MAX_PAGE_SIZE, Math.trunc(value)));
}

function containsInsensitive(value: string): Prisma.StringFilter {
  return {
    contains: value,
    mode: "insensitive"
  };
}

function buildDateRangeFilter(
  from?: string,
  to?: string
): Prisma.DateTimeNullableFilter | null {
  const fromDate = parseDateFilter(from, "start");
  const toDate = parseDateFilter(to, "end");

  if (!fromDate && !toDate) {
    return null;
  }

  const range: Prisma.DateTimeNullableFilter = {};
  if (fromDate) {
    range.gte = fromDate;
  }
  if (toDate) {
    range.lte = toDate;
  }

  return range;
}

function parseDateFilter(value: string | undefined, boundary: "start" | "end"): Date | null {
  const normalized = cleanText(value);
  if (!normalized) {
    return null;
  }

  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(normalized);
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  if (isDateOnly) {
    if (boundary === "start") {
      parsed.setHours(0, 0, 0, 0);
    } else {
      parsed.setHours(23, 59, 59, 999);
    }
  }

  return parsed;
}

function sanitizePublicUrl(value?: string | null, portalUrl?: string | null): string | null {
  const normalized = cleanText(value);
  if (!normalized) {
    return null;
  }

  if (isLegacyPncpPortalUrl(normalized)) {
    return null;
  }

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
  } catch {
    return null;
  }

  if (portalUrl && normalizeComparableUrl(normalized) === normalizeComparableUrl(portalUrl)) {
    return null;
  }

  return normalized;
}

function normalizeComparableUrl(value: string): string {
  return value.trim().replace(/\/+$/, "").toLowerCase();
}

function cleanText(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : null;
}

function mapStatusTextToEnum(normalized: string): PncpEditalStatus | null {
  if (normalized.includes("suspens")) {
    return PncpEditalStatus.SUSPENSO;
  }
  if (normalized.includes("anulad")) {
    return PncpEditalStatus.ANULADO;
  }
  if (normalized.includes("revogad")) {
    return PncpEditalStatus.REVOGADO;
  }
  if (normalized.includes("encerrad") || normalized.includes("julgamento")) {
    return PncpEditalStatus.ENCERRADO;
  }
  if (normalized.includes("abert") || normalized.includes("receb")) {
    return PncpEditalStatus.ABERTO;
  }
  if (normalized.includes("divulgad") || normalized.includes("publicad")) {
    return PncpEditalStatus.PUBLICADO;
  }

  return null;
}

function stringifyUnknown(value: unknown): string {
  if (value instanceof Error) {
    return value.message;
  }

  return String(value);
}

function hasUnsupportedRemoteFilters(query: NoticeQueryDto): boolean {
  return (
    Boolean(cleanText(query.publishedFrom)) ||
    Boolean(cleanText(query.publishedTo)) ||
    Boolean(cleanText(query.closingFrom)) ||
    Boolean(cleanText(query.closingTo)) ||
    typeof query.estimatedValueMin === "number" ||
    typeof query.estimatedValueMax === "number" ||
    query.onlyWithAttachments === true
  );
}

function buildNoticeSearchResponse(args: {
  items: NoticeListItem[];
  page: number;
  pageSize: number;
  total: number;
  searchContext: NoticeSearchTermContext;
  termGroups: NoticeSearchResponse["termGroups"];
  isTotalExact: boolean;
}): NoticeSearchResponse {
  return {
    items: args.items,
    page: args.page,
    pageSize: args.pageSize,
    total: args.total,
    totalPages: args.pageSize > 0 ? Math.ceil(args.total / args.pageSize) : 0,
    searchTerms: args.searchContext.terms,
    multiTermMode: args.searchContext.mode,
    activeTerm: args.searchContext.activeTerm,
    termGroups: args.termGroups,
    isTotalExact: args.isTotalExact
  };
}
