import { Injectable, Logger } from "@nestjs/common";
import type { NoticeDetail, NoticeOfficialLink, NoticeSearchFilters } from "@pncp/types";
import type { ProcurementSourceAdapter } from "./procurement-source-adapter.interface";

@Injectable()
export class PncpAdapter implements ProcurementSourceAdapter {
  readonly key = "pncp";
  private readonly logger = new Logger(PncpAdapter.name);

  async searchNotices(_filters: NoticeSearchFilters): Promise<unknown[]> {
    this.logger.log(
      "PNCP adapter scaffolded. Search sync should be wired to the official PNCP endpoint before production enablement."
    );

    return [];
  }

  async getNoticeDetails(id: string): Promise<unknown> {
    return { id };
  }

  async getNoticeDocuments(_id: string): Promise<unknown[]> {
    return [];
  }

  async normalizeNotice(payload: any): Promise<NoticeDetail> {
    const documents = Array.isArray(payload.documents) ? payload.documents : [];
    const officialLinks = normalizeOfficialLinks(payload.official_links);

    return {
      id: payload.id ?? payload.pncp_id ?? "",
      externalId: payload.pncp_id ?? payload.id ?? "",
      source: "pncp",
      agency: payload.nome_orgao ?? "Órgão não informado",
      object: payload.objeto_compra ?? "Objeto não informado",
      modality: payload.modalidade_nome ?? "Modalidade não informada",
      status: payload.situacao_nome ?? payload.status ?? "Não informado",
      state: payload.uf ?? null,
      city: payload.municipio_nome ?? null,
      publishedAt: payload.data_publicacao_pncp ?? null,
      openingAt: payload.data_abertura_proposta ?? null,
      closingAt: payload.data_encerramento_proposta ?? null,
      estimatedValue: payload.valor_total_estimado ?? null,
      hasAttachments: documents.length > 0,
      complementaryInfo: payload.informacao_complementar ?? null,
      justification: payload.justificativa ?? null,
      processNumber: payload.numero_controle_pncp ?? null,
      procurementType: payload.modo_disputa_nome ?? null,
      instrumentType: payload.tipo_nome ?? null,
      portalUrl: payload.portal_url ?? null,
      valorTotalHomologado: payload.valor_total_homologado ?? null,
      amparoLegal: payload.amparo_legal ?? null,
      processo: payload.numero_processo ?? null,
      srp: typeof payload.srp === "boolean" ? payload.srp : null,
      linkSistemaOrigem: payload.link_sistema_origem ?? null,
      linkProcessoEletronico: payload.link_processo_eletronico ?? null,
      orgaoEntidade: payload.razao_social ?? null,
      unidadeOrgao: payload.nome_unidade ?? null,
      cnpjOrgao: payload.cnpj_orgao ?? null,
      officialLinks,
      documents,
      items: Array.isArray(payload.items) ? payload.items : [],
      archives: Array.isArray(payload.archives) ? payload.archives : [],
      timeline: [
        {
          kind: "published",
          label: "Publicado em",
          value: payload.data_publicacao_pncp ?? null
        },
        {
          kind: "opening",
          label: "Abertura da proposta",
          value: payload.data_abertura_proposta ?? null
        },
        {
          kind: "closing",
          label: "Encerramento",
          value: payload.data_encerramento_proposta ?? null
        },
        {
          kind: "updated",
          label: "Última atualização",
          value: payload.data_ultima_atualizacao_pncp ?? null
        }
      ]
    };
  }

  async syncNotice(id: string): Promise<void> {
    this.logger.log(`Sync requested for PNCP notice ${id}`);
  }

  async syncSearchWindow(_filters: NoticeSearchFilters): Promise<number> {
    this.logger.log("Sync window requested for PNCP");
    return 0;
  }
}

function normalizeOfficialLinks(value: unknown): NoticeOfficialLink[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const items: NoticeOfficialLink[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const current = value[index];
    if (!isObject(current)) {
      continue;
    }

    const url = cleanText(current.url);
    const label = cleanText(current.label);
    const kind = current.kind === "document" || current.kind === "source_system"
      ? current.kind
      : null;

    if (!url || !label || !kind) {
      continue;
    }

    items.push({
      id: cleanText(current.id) ?? `official-link-${index + 1}`,
      label,
      url,
      kind
    });
  }

  return items;
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
