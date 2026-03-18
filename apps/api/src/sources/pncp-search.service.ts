import { BadGatewayException, GatewayTimeoutException, Injectable, Logger } from "@nestjs/common";
import type { NoticeQueryDto } from "../notices/dto/notice-query.dto";

export interface PncpSearchTypeSummary {
  name?: string;
  total?: number;
}

export interface PncpSearchItem {
  title?: string | null;
  description?: string | null;
  item_url?: string | null;
  document_type?: string | null;
  numero?: string | null;
  ano?: string | number | null;
  numero_sequencial?: string | number | null;
  numero_controle_pncp?: string | null;
  orgao_cnpj?: string | null;
  orgao_nome?: string | null;
  unidade_nome?: string | null;
  municipio_nome?: string | null;
  municipio_id?: string | number | null;
  uf?: string | null;
  modalidade_licitacao_id?: string | number | null;
  modalidade_licitacao_nome?: string | null;
  situacao_id?: string | number | null;
  situacao_nome?: string | null;
  data_publicacao_pncp?: string | null;
  data_atualizacao_pncp?: string | null;
  data_inicio_vigencia?: string | null;
  data_fim_vigencia?: string | null;
  valor_global?: number | null;
  [key: string]: unknown;
}

export interface PncpSearchResponse {
  items: PncpSearchItem[];
  total: number;
  types: PncpSearchTypeSummary[];
}

type NoticeQuerySubset = Pick<
  NoticeQueryDto,
  | "query"
  | "state"
  | "city"
  | "agency"
  | "modality"
  | "status"
  | "page"
  | "pageSize"
  | "sort"
  | "agencyId"
  | "municipioId"
  | "modalityId"
>;

const DEFAULT_STATUS = "recebendo_proposta";

export function mapNoticeSortToPncp(sort: NoticeQueryDto["sort"] | undefined): string {
  if (sort === "relevance") {
    return "relevancia";
  }
  if (sort === "estimatedValue:desc") {
    return "valor";
  }
  if (sort === "estimatedValue:asc") {
    return "-valor";
  }
  if (sort === "closingAt:asc") {
    return "data";
  }

  return "-data";
}

export function mapNoticeQueryToPncpSearchParams(query: NoticeQuerySubset): URLSearchParams {
  const params = new URLSearchParams();
  params.set("tipos_documento", "edital");
  params.set("pagina", String(query.page ?? 1));
  params.set("tam_pagina", String(query.pageSize ?? 20));
  params.set("ordenacao", mapNoticeSortToPncp(query.sort));

  const normalizedStatus = normalizeStatus(query.status);
  params.set("status", normalizedStatus ?? DEFAULT_STATUS);

  const uf = cleanText(query.state)?.toUpperCase();
  if (uf) {
    params.set("ufs", uf);
  }

  const orgaos = normalizeIdFilter(query.agencyId ?? query.agency);
  if (orgaos) {
    params.set("orgaos", orgaos);
  }

  const municipios = normalizeIdFilter(query.municipioId ?? query.city);
  if (municipios) {
    params.set("municipios", municipios);
  }

  const modalidades = normalizeIdFilter(query.modalityId ?? query.modality);
  if (modalidades) {
    params.set("modalidades", modalidades);
  }

  const normalizedQuery = buildTextQueryForCompatibility(query, {
    hasAgencyIdFilter: Boolean(orgaos),
    hasMunicipioIdFilter: Boolean(municipios),
    hasModalityIdFilter: Boolean(modalidades)
  });

  if (normalizedQuery) {
    params.set("q", normalizedQuery);
  }

  return params;
}

@Injectable()
export class PncpSearchService {
  private readonly logger = new Logger(PncpSearchService.name);
  private readonly baseUrl = (process.env.PNCP_SEARCH_URL ?? "https://pncp.gov.br/api/search").replace(
    /\/+$/,
    ""
  );
  private readonly timeoutMs = 15_000;
  private readonly maxRetries = 3;

  async searchEditais(query: NoticeQueryDto): Promise<PncpSearchResponse> {
    const params = mapNoticeQueryToPncpSearchParams(query);
    const url = `${this.baseUrl}/?${params.toString()}`;

    const response = await this.fetchWithRetry(url);

    if (response.status === 204) {
      return {
        items: [],
        total: 0,
        types: []
      };
    }

    const payloadText = await response.text();
    if (!response.ok) {
      throw new BadGatewayException(
        `PNCP search request failed: ${response.status} ${payloadText.slice(0, 300)}`
      );
    }

    let payload: unknown;
    try {
      payload = JSON.parse(payloadText);
    } catch {
      throw new BadGatewayException("PNCP search returned invalid JSON payload.");
    }

    const typedPayload = isSearchPayload(payload)
      ? payload
      : {
          items: [],
          total: 0,
          types: []
        };

    return {
      items: Array.isArray(typedPayload.items) ? typedPayload.items : [],
      total: Number.isFinite(typedPayload.total) ? typedPayload.total : 0,
      types: Array.isArray(typedPayload.types) ? typedPayload.types : []
    };
  }

  private async fetchWithRetry(url: string): Promise<Response> {
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(url, {
          method: "GET",
          headers: {
            Accept: "application/json"
          },
          signal: controller.signal
        });

        clearTimeout(timeout);

        if ((response.status === 429 || response.status >= 500) && attempt < this.maxRetries) {
          await this.sleep(this.getRetryDelayMs(attempt));
          continue;
        }

        return response;
      } catch (error) {
        clearTimeout(timeout);
        lastError = error;

        if (attempt < this.maxRetries) {
          this.logger.warn(`PNCP search network error on attempt ${attempt + 1}. Retrying...`);
          await this.sleep(this.getRetryDelayMs(attempt));
          continue;
        }
      }
    }

    throw new GatewayTimeoutException(
      `PNCP search request timed out or failed after retries: ${String(lastError)}`
    );
  }

  private getRetryDelayMs(attempt: number): number {
    return Math.min(1_000 * 2 ** attempt, 8_000);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}

function normalizeStatus(value?: string): string | null {
  const normalized = cleanText(value);
  return normalized ? normalized.toLowerCase() : null;
}

function normalizeIdFilter(value?: string | null): string | null {
  const normalized = cleanText(value);
  if (!normalized) {
    return null;
  }

  const parts = normalized
    .split("|")
    .map((part) => part.trim())
    .filter((part) => /^\d+$/.test(part));

  if (parts.length === 0) {
    return null;
  }

  return parts.join("|");
}

function buildTextQueryForCompatibility(
  query: NoticeQuerySubset,
  flags: {
    hasAgencyIdFilter: boolean;
    hasMunicipioIdFilter: boolean;
    hasModalityIdFilter: boolean;
  }
): string | null {
  const parts: string[] = [];
  const baseQuery = cleanText(query.query);

  if (baseQuery) {
    parts.push(baseQuery);
  }

  if (!flags.hasAgencyIdFilter) {
    const agencyText = cleanText(query.agency);
    if (agencyText) {
      parts.push(agencyText);
    }
  }

  if (!flags.hasMunicipioIdFilter) {
    const cityText = cleanText(query.city);
    if (cityText) {
      parts.push(cityText);
    }
  }

  if (!flags.hasModalityIdFilter) {
    const modalityText = cleanText(query.modality);
    if (modalityText) {
      parts.push(modalityText);
    }
  }

  if (parts.length === 0) {
    return null;
  }

  return parts.join(" ");
}

function cleanText(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : null;
}

function isSearchPayload(
  payload: unknown
): payload is { items: PncpSearchItem[]; total: number; types: PncpSearchTypeSummary[] } {
  return typeof payload === "object" && payload !== null;
}
