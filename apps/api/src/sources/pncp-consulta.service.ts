import { Injectable, Logger } from "@nestjs/common";

export interface PncpConsultaCompra {
  numeroControlePNCP?: string | null;
  numeroCompra?: string | null;
  anoCompra?: number | null;
  sequencialCompra?: number | null;
  valorTotalEstimado?: number | null;
  valorTotalHomologado?: number | null;
  modalidadeNome?: string | null;
  modoDisputaNome?: string | null;
  situacaoCompraNome?: string | null;
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
  tipoInstrumentoConvocatorioNome?: string | null;
  orgaoEntidade?: {
    cnpj?: string | null;
    razaoSocial?: string | null;
  } | null;
  unidadeOrgao?: {
    ufNome?: string | null;
    ufSigla?: string | null;
    municipioNome?: string | null;
    codigoIbge?: string | null;
    nomeUnidade?: string | null;
  } | null;
  modalidadeId?: number | null;
  modoDisputaId?: number | null;
  situacaoCompraId?: number | string | null;
  [key: string]: unknown;
}

export interface PncpConsultaCompraParams {
  cnpjOrgao: string;
  anoCompra: number;
  sequencialCompra: number;
}

export interface PncpConsultaItemParams {
  cnpjOrgao: string;
  anoCompra: number;
  sequencialCompra: number;
}

export interface PncpConsultaItem {
  numeroItem: number;
  descricao: string;
  materialOuServico: string;
  materialOuServicoNome: string;
  valorUnitarioEstimado: number | null;
  valorTotal: number | null;
  quantidade: number | null;
  unidadeMedida: string | null;
  criterioJulgamentoNome: string | null;
  situacaoCompraItemNome: string | null;
  temResultado: boolean;
  [key: string]: unknown;
}

export interface PncpConsultaArquivo {
  sequencialDocumento: number;
  titulo: string;
  tipoDocumentoId: number;
  tipoDocumentoNome: string;
  statusAtivo: boolean;
  [key: string]: unknown;
}

export type PncpConsultaResult =
  | {
      kind: "ok";
      data: PncpConsultaCompra;
      status: number;
    }
  | {
      kind: "not_found";
      status: 404;
    }
  | {
      kind: "transient_failure";
      status?: number;
      message: string;
    }
  | {
      kind: "unexpected_response";
      status?: number;
      message: string;
    };

@Injectable()
export class PncpConsultaService {
  private static readonly ARRAY_PAGE_SIZE = 50;
  private static readonly MAX_ARRAY_PAGES = 100;
  private readonly logger = new Logger(PncpConsultaService.name);
  private readonly baseUrl = (process.env.PNCP_BASE_URL ?? "https://pncp.gov.br/api/consulta").replace(
    /\/+$/,
    ""
  );
  private readonly timeoutMs = this.resolveTimeoutMs();
  private readonly maxRetries = this.resolveMaxRetries();
  private readonly userAgent = "pncp-intelligence-platform/0.1";
  private readonly pncpApiBaseUrl = "https://pncp.gov.br/api/pncp";

  async getCompra(params: PncpConsultaCompraParams): Promise<PncpConsultaResult> {
    const url = `${this.baseUrl}/v1/orgaos/${params.cnpjOrgao}/compras/${params.anoCompra}/${params.sequencialCompra}`;

    return this.fetchCompraWithRetry(url);
  }

  async getItens(params: PncpConsultaItemParams): Promise<PncpConsultaItem[]> {
    return this.fetchPaginatedArrayWithRetry<PncpConsultaItem>(
      this.buildCompraSubresourceUrl(params, "itens")
    );
  }

  async getArquivos(params: PncpConsultaItemParams): Promise<PncpConsultaArquivo[]> {
    return this.fetchPaginatedArrayWithRetry<PncpConsultaArquivo>(
      this.buildCompraSubresourceUrl(params, "arquivos")
    );
  }

  private buildCompraSubresourceUrl(
    params: PncpConsultaItemParams,
    resource: "itens" | "arquivos"
  ): URL {
    return new URL(
      `${this.pncpApiBaseUrl}/v1/orgaos/${params.cnpjOrgao}/compras/${params.anoCompra}/${params.sequencialCompra}/${resource}`
    );
  }

  private async fetchCompraWithRetry(url: string): Promise<PncpConsultaResult> {
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(url, {
          method: "GET",
          headers: {
            Accept: "application/json",
            "User-Agent": this.userAgent
          },
          signal: controller.signal
        });

        clearTimeout(timeout);

        if (response.status === 404) {
          return {
            kind: "not_found",
            status: 404
          };
        }

        if (isRetryableStatus(response.status)) {
          if (attempt < this.maxRetries) {
            this.logger.debug(
              `PNCP consulta respondeu ${response.status} (tentativa ${attempt + 1}/${this.maxRetries + 1}).`
            );
            await this.sleep(this.getRetryDelayMs(attempt));
            continue;
          }

          this.logger.warn(
            `PNCP consulta falhou apos ${this.maxRetries + 1} tentativas com status ${response.status}.`
          );
          return {
            kind: "transient_failure",
            status: response.status,
            message: `PNCP consulta respondeu ${response.status}.`
          };
        }

        if (!response.ok) {
          return {
            kind: "unexpected_response",
            status: response.status,
            message: `PNCP consulta respondeu ${response.status}.`
          };
        }

        const payloadText = await response.text();
        let payload: unknown;

        try {
          payload = JSON.parse(payloadText);
        } catch {
          return {
            kind: "unexpected_response",
            status: response.status,
            message: "PNCP consulta retornou JSON invalido."
          };
        }

        if (!isJsonObject(payload)) {
          return {
            kind: "unexpected_response",
            status: response.status,
            message: "PNCP consulta retornou payload inesperado."
          };
        }

        return {
          kind: "ok",
          status: response.status,
          data: payload as PncpConsultaCompra
        };
      } catch (error) {
        clearTimeout(timeout);
        lastError = error;

        if (attempt < this.maxRetries) {
          this.logger.debug(
            `Falha de rede na consulta PNCP (tentativa ${attempt + 1}/${this.maxRetries + 1}).`
          );
          await this.sleep(this.getRetryDelayMs(attempt));
          continue;
        }

        this.logger.warn(
          `Falha de rede na consulta PNCP apos ${this.maxRetries + 1} tentativas: ${stringifyUnknown(error)}`
        );
      }
    }

    return {
      kind: "transient_failure",
      message: `PNCP consulta indisponivel: ${stringifyUnknown(lastError)}`
    };
  }

  private async fetchPaginatedArrayWithRetry<T>(baseUrl: URL): Promise<T[]> {
    const items: T[] = [];

    for (let page = 1; page <= PncpConsultaService.MAX_ARRAY_PAGES; page += 1) {
      const pageItems = await this.fetchArrayPageWithRetry<T>(
        baseUrl,
        page,
        PncpConsultaService.ARRAY_PAGE_SIZE
      );

      if (pageItems.length === 0) {
        break;
      }

      items.push(...pageItems);

      if (pageItems.length < PncpConsultaService.ARRAY_PAGE_SIZE) {
        return items;
      }
    }

    if (items.length > 0) {
      this.logger.warn(
        `PNCP array endpoint atingiu o limite de ${PncpConsultaService.MAX_ARRAY_PAGES} paginas em ${baseUrl.pathname}.`
      );
    }

    return items;
  }

  private async fetchArrayPageWithRetry<T>(
    baseUrl: URL,
    page: number,
    pageSize: number
  ): Promise<T[]> {
    const url = new URL(baseUrl.toString());
    url.searchParams.set("pagina", String(page));
    url.searchParams.set("tamanhoPagina", String(pageSize));

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(url.toString(), {
          method: "GET",
          headers: {
            Accept: "application/json",
            "User-Agent": this.userAgent
          },
          signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
          if (isRetryableStatus(response.status) && attempt < this.maxRetries) {
            await this.sleep(this.getRetryDelayMs(attempt));
            continue;
          }
          this.logger.debug(`PNCP array endpoint respondeu ${response.status} para ${url.toString()}`);
          return [];
        }

        const payloadText = await response.text();
        let payload: unknown;
        try {
          payload = JSON.parse(payloadText);
        } catch {
          this.logger.debug(`PNCP array endpoint retornou JSON invalido para ${url.toString()}`);
          return [];
        }

        if (!Array.isArray(payload)) {
          this.logger.debug(`PNCP array endpoint retornou payload inesperado para ${url.toString()}`);
          return [];
        }

        return payload as T[];
      } catch (error) {
        clearTimeout(timeout);
        if (attempt < this.maxRetries) {
          await this.sleep(this.getRetryDelayMs(attempt));
          continue;
        }
        this.logger.debug(`Falha de rede em ${url.toString()}: ${stringifyUnknown(error)}`);
        return [];
      }
    }
    return [];
  }

  private getRetryDelayMs(attempt: number): number {
    return 1_000 * 2 ** attempt;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private resolveTimeoutMs(): number {
    const fallback = 4_000;
    const parsed = Number(process.env.PNCP_CONSULTA_TIMEOUT_MS ?? fallback);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    return Math.max(1_000, Math.min(60_000, Math.trunc(parsed)));
  }

  private resolveMaxRetries(): number {
    const fallback = 1;
    const parsed = Number(process.env.PNCP_CONSULTA_MAX_RETRIES ?? fallback);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    return Math.max(0, Math.min(5, Math.trunc(parsed)));
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringifyUnknown(value: unknown): string {
  if (value instanceof Error) {
    return value.message;
  }

  return String(value);
}
