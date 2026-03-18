import { PncpEditalStatus, type Prisma } from "@prisma/client";
import type { NoticeListItem } from "@pncp/types";
import type { PncpSearchItem } from "../sources/pncp-search.service";

export const noticeListSelect = {
  id: true,
  pncpId: true,
  nomeOrgao: true,
  objetoCompra: true,
  modalidadeNome: true,
  status: true,
  situacaoNome: true,
  uf: true,
  municipioNome: true,
  dataPublicacaoPncp: true,
  dataAberturaProposta: true,
  dataEncerramentoProposta: true,
  valorTotalEstimado: true,
  linkEdital: true,
  portalUrl: true,
  isPublishedOnPncp: true,
  validatedAt: true,
  numeroCompra: true,
  anoCompra: true,
  dataUltimaAtualizacao: true
} satisfies Prisma.PncpEditalSelect;

export type NoticeListRow = Prisma.PncpEditalGetPayload<{
  select: typeof noticeListSelect;
}>;

interface PersistableEdital {
  create: Prisma.PncpEditalCreateInput;
  update: Prisma.PncpEditalUpdateInput;
}

export function mapPncpSearchItemToPersistableEdital(
  item: PncpSearchItem,
  fetchedAt: Date
): PersistableEdital | null {
  const pncpId = cleanText(item.numero_controle_pncp);
  if (!pncpId) {
    return null;
  }

  const cnpjOrgao = cleanText(item.orgao_cnpj) ?? extractCnpjFromPncpId(pncpId);
  if (!cnpjOrgao) {
    return null;
  }

  const codigoModalidade = cleanText(String(item.modalidade_licitacao_id ?? "")) ?? "0";
  const valorTotalEstimado = numberOrNull(item.valor_global);

  const create: Prisma.PncpEditalCreateInput = {
    pncpId,
    numeroControlePncp: pncpId,
    numeroCompra: cleanText(item.numero) ?? cleanText(String(item.numero_sequencial ?? "")),
    anoCompra: intOrNull(item.ano),
    sequencialCompra: intOrNull(item.numero_sequencial),
    cnpjOrgao,
    nomeOrgao: cleanText(item.orgao_nome),
    siglaOrgao: null,
    cnpjUnidade: null,
    nomeUnidade: cleanText(item.unidade_nome),
    municipioNome: cleanText(item.municipio_nome),
    municipioIbge: cleanText(String(item.municipio_id ?? "")),
    uf: normalizeUf(item.uf),
    ufNome: null,
    codigoModalidade,
    modalidadeNome: cleanText(item.modalidade_licitacao_nome),
    modoDisputaCodigo: null,
    modoDisputaNome: null,
    situacaoCodigo: intOrNull(item.situacao_id),
    situacaoNome: cleanText(item.situacao_nome),
    status: mapStatusToEnum(item.situacao_nome),
    valorTotalEstimado,
    valorTotalHomologado: null,
    dataPublicacaoPncp: dateOrNull(item.data_publicacao_pncp),
    dataAberturaProposta: dateOrNull(item.data_inicio_vigencia),
    dataEncerramentoProposta: dateOrNull(item.data_fim_vigencia),
    dataUltimaAtualizacao: dateOrNull(item.data_atualizacao_pncp),
    objetoCompra: cleanText(item.description),
    informacaoComplementar: cleanText(item.title),
    justificativa: null,
    linkSistemaOrigem: null,
    linkEdital: null,
    portalUrl: null,
    isPublishedOnPncp: null,
    validatedAt: null,
    rawPayload: toPrismaJsonValue(item),
    fetchedFromPncpAt: fetchedAt
  };

  const update: Prisma.PncpEditalUpdateInput = {
    rawPayload: create.rawPayload,
    fetchedFromPncpAt: create.fetchedFromPncpAt
  };

  if (create.numeroControlePncp) {
    update.numeroControlePncp = create.numeroControlePncp;
  }
  if (create.numeroCompra) {
    update.numeroCompra = create.numeroCompra;
  }
  if (create.anoCompra !== null) {
    update.anoCompra = create.anoCompra;
  }
  if (create.sequencialCompra !== null) {
    update.sequencialCompra = create.sequencialCompra;
  }
  if (create.cnpjOrgao) {
    update.cnpjOrgao = create.cnpjOrgao;
  }
  if (create.nomeOrgao) {
    update.nomeOrgao = create.nomeOrgao;
  }
  if (create.nomeUnidade) {
    update.nomeUnidade = create.nomeUnidade;
  }
  if (create.municipioNome) {
    update.municipioNome = create.municipioNome;
  }
  if (create.municipioIbge) {
    update.municipioIbge = create.municipioIbge;
  }
  if (create.uf) {
    update.uf = create.uf;
  }
  if (create.codigoModalidade) {
    update.codigoModalidade = create.codigoModalidade;
  }
  if (create.modalidadeNome) {
    update.modalidadeNome = create.modalidadeNome;
  }
  if (create.situacaoCodigo !== null) {
    update.situacaoCodigo = create.situacaoCodigo;
  }
  if (create.situacaoNome) {
    update.situacaoNome = create.situacaoNome;
  }
  if (create.status !== null) {
    update.status = create.status;
  }
  if (create.valorTotalEstimado !== null) {
    update.valorTotalEstimado = create.valorTotalEstimado;
  }
  if (create.dataPublicacaoPncp) {
    update.dataPublicacaoPncp = create.dataPublicacaoPncp;
  }
  if (create.dataAberturaProposta) {
    update.dataAberturaProposta = create.dataAberturaProposta;
  }
  if (create.dataEncerramentoProposta) {
    update.dataEncerramentoProposta = create.dataEncerramentoProposta;
  }
  if (create.dataUltimaAtualizacao) {
    update.dataUltimaAtualizacao = create.dataUltimaAtualizacao;
  }
  if (create.objetoCompra) {
    update.objetoCompra = create.objetoCompra;
  }
  if (create.informacaoComplementar) {
    update.informacaoComplementar = create.informacaoComplementar;
  }

  return { create, update };
}

export function mapPncpEditalRowToNoticeListItem(item: NoticeListRow): NoticeListItem {
  return {
    id: item.id,
    externalId: item.pncpId,
    source: "pncp",
    agency: item.nomeOrgao ?? "Orgao nao informado",
    object: item.objetoCompra ?? "Objeto nao informado",
    modality: item.modalidadeNome ?? "Modalidade nao informada",
    status: item.situacaoNome ?? mapPersistedStatus(item.status) ?? "Nao informado",
    state: item.uf,
    city: item.municipioNome,
    publishedAt: item.dataPublicacaoPncp?.toISOString() ?? null,
    openingAt: item.dataAberturaProposta?.toISOString() ?? null,
    closingAt: item.dataEncerramentoProposta?.toISOString() ?? null,
    estimatedValue: item.valorTotalEstimado ? Number(item.valorTotalEstimado) : null,
    hasAttachments: Boolean(item.linkEdital),
    noticeNumber:
      item.numeroCompra && item.anoCompra ? `${item.numeroCompra}/${item.anoCompra}` : null,
    updatedAt: item.dataUltimaAtualizacao?.toISOString() ?? null
  };
}

function normalizeUf(value?: string | null): string | null {
  const normalized = cleanText(value)?.toUpperCase();
  if (!normalized) {
    return null;
  }
  return normalized.slice(0, 2);
}

function cleanText(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : null;
}

function dateOrNull(value?: string | null): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function numberOrNull(value?: number | null): number | null {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return null;
  }
  return value;
}

function intOrNull(value?: string | number | null): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.trunc(parsed);
}

function extractCnpjFromPncpId(pncpId: string): string | null {
  const candidate = pncpId.split("-")[0] ?? "";
  const digits = candidate.replace(/\D/g, "");
  if (digits.length < 14) {
    return null;
  }
  return digits.slice(0, 14);
}

function mapStatusToEnum(value?: string | null): PncpEditalStatus | null {
  const normalized = cleanText(value)?.toLowerCase();
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

function mapPersistedStatus(status?: PncpEditalStatus | null): string | null {
  if (!status) {
    return null;
  }

  switch (status) {
    case PncpEditalStatus.PUBLICADO:
      return "publicado";
    case PncpEditalStatus.ABERTO:
      return "aberto";
    case PncpEditalStatus.ENCERRADO:
      return "encerrado";
    case PncpEditalStatus.REVOGADO:
      return "revogado";
    case PncpEditalStatus.ANULADO:
      return "anulado";
    case PncpEditalStatus.SUSPENSO:
      return "suspenso";
    default:
      return null;
  }
}

function toPrismaJsonValue(item: PncpSearchItem): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(item)) as Prisma.InputJsonValue;
}
