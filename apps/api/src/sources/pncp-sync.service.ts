import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PncpEditalStatus, type Prisma } from "@prisma/client";
import { PrismaService } from "../common/prisma.service";
import { PncpConsultaService } from "./pncp-consulta.service";
import { buildPncpPortalUrl, isLegacyPncpPortalUrl, sanitizeCnpj } from "./pncp-publication.util";

interface PncpOrgaoEntidade {
  cnpj?: string | null;
  razaoSocial?: string | null;
}

interface PncpUnidadeOrgao {
  ufNome?: string | null;
  ufSigla?: string | null;
  municipioNome?: string | null;
  codigoIbge?: string | null;
  nomeUnidade?: string | null;
  codigoUnidade?: string | null;
}

interface PncpCompraProposta {
  numeroControlePNCP?: string | null;
  numeroCompra?: string | null;
  anoCompra?: number | null;
  sequencialCompra?: number | null;
  orgaoEntidade?: PncpOrgaoEntidade | null;
  unidadeOrgao?: PncpUnidadeOrgao | null;
  modalidadeId?: number | null;
  modalidadeNome?: string | null;
  modoDisputaId?: number | null;
  modoDisputaNome?: string | null;
  situacaoCompraId?: number | string | null;
  situacaoCompraNome?: string | null;
  valorTotalEstimado?: number | null;
  valorTotalHomologado?: number | null;
  dataPublicacaoPncp?: string | null;
  dataAberturaProposta?: string | null;
  dataEncerramentoProposta?: string | null;
  dataAtualizacao?: string | null;
  dataAtualizacaoGlobal?: string | null;
  objetoCompra?: string | null;
  informacaoComplementar?: string | null;
  justificativaPresencial?: string | null;
  linkSistemaOrigem?: string | null;
  linkEdital?: string | null;
  linkProcessoEletronico?: string | null;
  tipoInstrumentoConvocatorioCodigo?: number | null;
  tipoInstrumentoConvocatorioNome?: string | null;
}

interface PncpPropostaPage {
  data?: PncpCompraProposta[];
  totalRegistros?: number;
  totalPaginas?: number;
  numeroPagina?: number;
  paginasRestantes?: number;
  empty?: boolean;
}

export interface PncpSyncOptions {
  finalDate?: string;
  maxPages?: number;
  pageSize?: number;
  reason?: "manual" | "cron";
}

export interface PncpSyncResult {
  source: "pncp";
  reason: "manual" | "cron";
  finalDate: string;
  pageSize: number;
  requestedPages: number;
  pagesProcessed: number;
  recordsProcessed: number;
  recordsSkipped: number;
  totalAvailable: number;
  startedAt: string;
  finishedAt: string;
}

export interface PncpRevalidationResult {
  source: "pncp";
  targetRecords: number;
  processed: number;
  published: number;
  notFound: number;
  transientFailures: number;
  skipped: number;
  startedAt: string;
  finishedAt: string;
}

@Injectable()
export class PncpSyncService {
  private readonly logger = new Logger(PncpSyncService.name);
  private readonly baseUrl = (process.env.PNCP_BASE_URL ?? "https://pncp.gov.br/api/consulta").replace(/\/+$/, "");
  private readonly defaultPageSize = this.clampNumber(
    Number(process.env.PNCP_SYNC_PAGE_SIZE ?? 50),
    10,
    50
  );
  private readonly pageConcurrency = this.clampNumber(
    Number(process.env.PNCP_SYNC_CONCURRENCY ?? 3),
    1,
    10
  );
  private readonly maxRetries = 3;
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pncpConsultaService: PncpConsultaService
  ) {}

  @Cron(CronExpression.EVERY_6_HOURS)
  async scheduleSync() {
    if (process.env.PNCP_SYNC_ENABLED !== "true") {
      return;
    }

    try {
      await this.syncActiveProposals({
        reason: "cron"
      });
    } catch (error) {
      this.logger.error("Scheduled PNCP sync failed", error);
    }
  }

  async syncActiveProposals(options: PncpSyncOptions = {}): Promise<PncpSyncResult> {
    if (this.isRunning) {
      throw new Error("PNCP sync is already running.");
    }

    this.isRunning = true;
    const startedAt = new Date();
    const finalDate = this.resolveFinalDate(options.finalDate);
    const pageSize = this.resolvePageSize(options.pageSize);
    const reason = options.reason ?? "manual";
    const source = await this.ensureSource();

    const log = await this.prisma.noticeSyncLog.create({
      data: {
        sourceId: source.id,
        syncType: "active-proposals",
        status: "running",
        detail: JSON.stringify({
          reason,
          finalDate,
          pageSize,
          maxPages: options.maxPages ?? null
        })
      }
    });

    let pagesProcessed = 0;
    let recordsProcessed = 0;
    let recordsSkipped = 0;
    let requestedPages = 0;
    let totalAvailable = 0;

    try {
      const firstPage = await this.fetchPropostaPage(1, finalDate, pageSize);
      totalAvailable = firstPage.totalRegistros ?? 0;
      const totalPagesFromApi = Math.max(
        Number(firstPage.totalPaginas ?? 0),
        (firstPage.data?.length ?? 0) > 0 ? 1 : 0
      );
      requestedPages = options.maxPages
        ? Math.min(totalPagesFromApi, options.maxPages)
        : totalPagesFromApi;

      const firstResult = await this.upsertBatch(firstPage.data ?? [], startedAt);
      pagesProcessed += requestedPages > 0 ? 1 : 0;
      recordsProcessed += firstResult.processed;
      recordsSkipped += firstResult.skipped;

      const remainingPages: number[] = [];
      for (let page = 2; page <= requestedPages; page += 1) {
        remainingPages.push(page);
      }

      for (let i = 0; i < remainingPages.length; i += this.pageConcurrency) {
        const pageChunk = remainingPages.slice(i, i + this.pageConcurrency);
        const chunkResponses = await Promise.all(
          pageChunk.map((page) => this.fetchPropostaPage(page, finalDate, pageSize))
        );

        for (const response of chunkResponses) {
          const result = await this.upsertBatch(response.data ?? [], startedAt);
          pagesProcessed += 1;
          recordsProcessed += result.processed;
          recordsSkipped += result.skipped;
        }
      }

      const finishedAt = new Date();
      const summary: PncpSyncResult = {
        source: "pncp",
        reason,
        finalDate,
        pageSize,
        requestedPages,
        pagesProcessed,
        recordsProcessed,
        recordsSkipped,
        totalAvailable,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString()
      };

      await this.prisma.noticeSyncLog.update({
        where: { id: log.id },
        data: {
          status: "success",
          detail: JSON.stringify(summary),
          finishedAt
        }
      });

      this.logger.log(
        `PNCP sync completed: ${recordsProcessed} records processed in ${pagesProcessed} pages.`
      );

      return summary;
    } catch (error) {
      await this.prisma.noticeSyncLog.update({
        where: { id: log.id },
        data: {
          status: "error",
          detail: this.buildErrorDetail({
            reason,
            finalDate,
            pageSize,
            requestedPages,
            pagesProcessed,
            recordsProcessed,
            recordsSkipped,
            totalAvailable,
            error
          }),
          finishedAt: new Date()
        }
      });

      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  async revalidateLegacyPublicationStatus(limit = 200): Promise<PncpRevalidationResult> {
    const startedAt = new Date();
    const take = this.clampNumber(limit, 1, 1_000);

    const editais = await this.prisma.pncpEdital.findMany({
      where: {
        OR: [
          {
            linkEdital: {
              startsWith: "https://pncp.gov.br/compras/"
            }
          },
          {
            isPublishedOnPncp: null
          }
        ]
      },
      orderBy: {
        updatedAt: "desc"
      },
      take,
      select: {
        id: true,
        cnpjOrgao: true,
        anoCompra: true,
        sequencialCompra: true,
        linkEdital: true
      }
    });

    let processed = 0;
    let published = 0;
    let notFound = 0;
    let transientFailures = 0;
    let skipped = 0;

    for (const edital of editais) {
      const cnpjOrgao = sanitizeCnpj(edital.cnpjOrgao);
      const anoCompra = this.intOrNull(edital.anoCompra);
      const sequencialCompra = this.intOrNull(edital.sequencialCompra);
      if (!cnpjOrgao || anoCompra === null || sequencialCompra === null) {
        skipped += 1;
        continue;
      }

      const validatedAt = new Date();
      const result = await this.pncpConsultaService.getCompra({
        cnpjOrgao,
        anoCompra,
        sequencialCompra
      });
      processed += 1;

      if (result.kind === "ok") {
        const portalUrl = buildPncpPortalUrl({
          cnpjOrgao,
          anoCompra,
          sequencialCompra
        });
        const linkEditalFromConsulta = this.cleanText(result.data.linkEdital);

        const updateData: Prisma.PncpEditalUpdateInput = {
          isPublishedOnPncp: true,
          validatedAt,
          portalUrl,
          status: this.mapStatusToEnum(result.data.situacaoCompraNome),
          situacaoCodigo: this.intOrNull(result.data.situacaoCompraId),
          situacaoNome: this.cleanText(result.data.situacaoCompraNome),
          dataUltimaAtualizacao: this.dateOrNull(
            result.data.dataAtualizacaoGlobal ?? result.data.dataAtualizacao
          )
        };

        if (linkEditalFromConsulta) {
          updateData.linkEdital = linkEditalFromConsulta;
        } else if (isLegacyPncpPortalUrl(edital.linkEdital)) {
          updateData.linkEdital = null;
        }

        const linkSistemaOrigem = this.cleanText(result.data.linkSistemaOrigem);
        if (linkSistemaOrigem) {
          updateData.linkSistemaOrigem = linkSistemaOrigem;
        }

        await this.prisma.pncpEdital.update({
          where: { id: edital.id },
          data: updateData
        });

        published += 1;
        continue;
      }

      if (result.kind === "not_found") {
        await this.prisma.pncpEdital.update({
          where: { id: edital.id },
          data: {
            isPublishedOnPncp: false,
            validatedAt,
            portalUrl: null,
            linkEdital: isLegacyPncpPortalUrl(edital.linkEdital) ? null : edital.linkEdital
          }
        });

        notFound += 1;
        continue;
      }

      transientFailures += 1;
    }

    const finishedAt = new Date();
    return {
      source: "pncp",
      targetRecords: editais.length,
      processed,
      published,
      notFound,
      transientFailures,
      skipped,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString()
    };
  }

  private async fetchPropostaPage(
    page: number,
    finalDate: string,
    pageSize: number
  ): Promise<PncpPropostaPage> {
    const url = new URL(`${this.baseUrl}/v1/contratacoes/proposta`);
    url.searchParams.set("dataFinal", finalDate);
    url.searchParams.set("pagina", String(page));
    url.searchParams.set("tamanhoPagina", String(pageSize));

    const response = await this.fetchWithRetry(url.toString(), page);

    if (response.status === 204) {
      return {
        data: [],
        totalPaginas: 0,
        totalRegistros: 0,
        numeroPagina: page,
        paginasRestantes: 0,
        empty: true
      };
    }

    const text = await response.text();
    if (!response.ok) {
      throw new Error(
        `PNCP request failed on page ${page}: ${response.status} ${text.slice(0, 300)}`
      );
    }

    let payload: PncpPropostaPage;
    try {
      payload = JSON.parse(text) as PncpPropostaPage;
    } catch {
      throw new Error(`PNCP response on page ${page} is not valid JSON.`);
    }

    return payload;
  }

  private async fetchWithRetry(url: string, page: number): Promise<Response> {
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        const response = await fetch(url, {
          method: "GET",
          headers: {
            Accept: "application/json"
          }
        });

        if (response.status === 429 || response.status >= 500) {
          if (attempt === this.maxRetries) {
            return response;
          }

          await this.sleep(this.getRetryDelayMs(attempt));
          continue;
        }

        return response;
      } catch (error) {
        lastError = error;
        if (attempt === this.maxRetries) {
          break;
        }

        this.logger.warn(
          `PNCP request network error on page ${page}, attempt ${attempt + 1}/${this.maxRetries + 1}. Retrying...`
        );
        await this.sleep(this.getRetryDelayMs(attempt));
      }
    }

    throw new Error(
      `PNCP request failed after retries on page ${page}: ${this.stringifyUnknown(lastError)}`
    );
  }

  private async upsertBatch(
    items: PncpCompraProposta[],
    fetchedAt: Date
  ): Promise<{ processed: number; skipped: number }> {
    let processed = 0;
    let skipped = 0;

    for (const item of items) {
      const mapped = this.mapItem(item, fetchedAt);
      if (!mapped) {
        skipped += 1;
        continue;
      }

      await this.prisma.pncpEdital.upsert({
        where: { pncpId: mapped.create.pncpId },
        create: mapped.create,
        update: mapped.update
      });

      processed += 1;
    }

    return { processed, skipped };
  }

  private mapItem(
    item: PncpCompraProposta,
    fetchedAt: Date
  ): {
    create: Prisma.PncpEditalCreateInput;
    update: Prisma.PncpEditalUpdateInput;
  } | null {
    const pncpId = this.cleanText(item.numeroControlePNCP);
    if (!pncpId) {
      return null;
    }

    const cnpjOrgao = this.cleanText(item.orgaoEntidade?.cnpj) ?? this.extractCnpjFromPncpId(pncpId);
    if (!cnpjOrgao) {
      return null;
    }

    const codigoModalidade =
      item.modalidadeId !== undefined && item.modalidadeId !== null
        ? String(item.modalidadeId)
        : "0";

    const valorTotalEstimado = this.numberOrNull(item.valorTotalEstimado);
    const valorTotalHomologado = this.numberOrNull(item.valorTotalHomologado);
    const anoCompra = this.intOrNull(item.anoCompra);
    const sequencialCompra = this.intOrNull(item.sequencialCompra);
    const portalUrl =
      anoCompra !== null && sequencialCompra !== null
        ? buildPncpPortalUrl({
            cnpjOrgao,
            anoCompra,
            sequencialCompra
          })
        : null;

    const create: Prisma.PncpEditalCreateInput = {
      pncpId,
      numeroControlePncp: pncpId,
      numeroCompra: this.cleanText(item.numeroCompra),
      anoCompra,
      sequencialCompra,
      cnpjOrgao,
      nomeOrgao: this.cleanText(item.orgaoEntidade?.razaoSocial),
      siglaOrgao: null,
      cnpjUnidade: null,
      nomeUnidade: this.cleanText(item.unidadeOrgao?.nomeUnidade),
      municipioNome: this.cleanText(item.unidadeOrgao?.municipioNome),
      municipioIbge: this.cleanText(item.unidadeOrgao?.codigoIbge),
      uf: this.cleanText(item.unidadeOrgao?.ufSigla),
      ufNome: this.cleanText(item.unidadeOrgao?.ufNome),
      codigoModalidade,
      modalidadeNome: this.cleanText(item.modalidadeNome),
      modoDisputaCodigo: this.intOrNull(item.modoDisputaId),
      modoDisputaNome: this.cleanText(item.modoDisputaNome),
      situacaoCodigo: this.intOrNull(item.situacaoCompraId),
      situacaoNome: this.cleanText(item.situacaoCompraNome),
      status: this.mapStatusToEnum(item.situacaoCompraNome),
      valorTotalEstimado,
      valorTotalHomologado,
      dataPublicacaoPncp: this.dateOrNull(item.dataPublicacaoPncp),
      dataAberturaProposta: this.dateOrNull(item.dataAberturaProposta),
      dataEncerramentoProposta: this.dateOrNull(item.dataEncerramentoProposta),
      dataUltimaAtualizacao: this.dateOrNull(item.dataAtualizacaoGlobal ?? item.dataAtualizacao),
      objetoCompra: this.cleanText(item.objetoCompra),
      informacaoComplementar: this.cleanText(item.informacaoComplementar),
      justificativa: this.cleanText(item.justificativaPresencial),
      linkSistemaOrigem: this.cleanText(item.linkSistemaOrigem),
      linkEdital: this.cleanText(item.linkEdital),
      portalUrl,
      isPublishedOnPncp: true,
      validatedAt: fetchedAt,
      rawPayload: item as unknown as Prisma.InputJsonValue,
      fetchedFromPncpAt: fetchedAt
    };

    const update: Prisma.PncpEditalUpdateInput = {
      numeroControlePncp: create.numeroControlePncp,
      numeroCompra: create.numeroCompra,
      anoCompra: create.anoCompra,
      sequencialCompra: create.sequencialCompra,
      cnpjOrgao: create.cnpjOrgao,
      nomeOrgao: create.nomeOrgao,
      siglaOrgao: create.siglaOrgao,
      cnpjUnidade: create.cnpjUnidade,
      nomeUnidade: create.nomeUnidade,
      municipioNome: create.municipioNome,
      municipioIbge: create.municipioIbge,
      uf: create.uf,
      ufNome: create.ufNome,
      codigoModalidade: create.codigoModalidade,
      modalidadeNome: create.modalidadeNome,
      modoDisputaCodigo: create.modoDisputaCodigo,
      modoDisputaNome: create.modoDisputaNome,
      situacaoCodigo: create.situacaoCodigo,
      situacaoNome: create.situacaoNome,
      status: create.status,
      valorTotalEstimado: create.valorTotalEstimado,
      valorTotalHomologado: create.valorTotalHomologado,
      dataPublicacaoPncp: create.dataPublicacaoPncp,
      dataAberturaProposta: create.dataAberturaProposta,
      dataEncerramentoProposta: create.dataEncerramentoProposta,
      dataUltimaAtualizacao: create.dataUltimaAtualizacao,
      objetoCompra: create.objetoCompra,
      informacaoComplementar: create.informacaoComplementar,
      justificativa: create.justificativa,
      linkSistemaOrigem: create.linkSistemaOrigem,
      linkEdital: create.linkEdital,
      portalUrl: create.portalUrl,
      isPublishedOnPncp: create.isPublishedOnPncp,
      validatedAt: create.validatedAt,
      rawPayload: create.rawPayload,
      fetchedFromPncpAt: create.fetchedFromPncpAt
    };

    return { create, update };
  }

  private async ensureSource() {
    return this.prisma.noticeSource.upsert({
      where: { key: "pncp" },
      create: {
        key: "pncp",
        name: "Portal Nacional de Contratacoes Publicas",
        baseUrl: this.baseUrl,
        isActive: true
      },
      update: {
        name: "Portal Nacional de Contratacoes Publicas",
        baseUrl: this.baseUrl,
        isActive: true
      }
    });
  }

  private resolveFinalDate(finalDate?: string): string {
    if (finalDate && /^\d{8}$/.test(finalDate)) {
      return finalDate;
    }

    if (finalDate) {
      const parsed = new Date(finalDate);
      if (!Number.isNaN(parsed.getTime())) {
        return this.formatDateYYYYMMDD(parsed);
      }
      throw new Error(`Invalid finalDate "${finalDate}". Use yyyymmdd or ISO date.`);
    }

    const now = new Date();
    const future = new Date(now);
    future.setMonth(future.getMonth() + 24);
    return this.formatDateYYYYMMDD(future);
  }

  private resolvePageSize(pageSize?: number): number {
    if (pageSize === undefined) {
      return this.defaultPageSize;
    }

    return this.clampNumber(pageSize, 10, 50);
  }

  private formatDateYYYYMMDD(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}${month}${day}`;
  }

  private dateOrNull(value?: string | null): Date | null {
    if (!value) {
      return null;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private numberOrNull(value?: number | null): number | null {
    if (value === undefined || value === null || Number.isNaN(value)) {
      return null;
    }
    return value;
  }

  private intOrNull(value?: number | string | null): number | null {
    if (value === undefined || value === null) {
      return null;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return Math.trunc(parsed);
  }

  private cleanText(value?: string | null): string | null {
    if (!value) {
      return null;
    }
    const cleaned = value.trim();
    return cleaned.length > 0 ? cleaned : null;
  }

  private extractCnpjFromPncpId(pncpId: string): string | null {
    const candidate = pncpId.split("-")[0] ?? "";
    const digits = candidate.replace(/\D/g, "");
    if (digits.length < 14) {
      return null;
    }
    return digits.slice(0, 14);
  }

  private mapStatusToEnum(value?: string | null): PncpEditalStatus | null {
    const normalized = this.cleanText(value)?.toLowerCase();
    if (!normalized) {
      return null;
    }

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

  private buildErrorDetail(payload: Record<string, unknown>): string {
    return JSON.stringify({
      ...payload,
      error: this.stringifyUnknown(payload.error)
    });
  }

  private stringifyUnknown(value: unknown): string {
    if (value instanceof Error) {
      return value.stack ?? value.message;
    }
    return String(value);
  }

  private getRetryDelayMs(attempt: number): number {
    return Math.min(1000 * 2 ** attempt, 8000);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private clampNumber(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) {
      return min;
    }
    return Math.max(min, Math.min(max, value));
  }
}
