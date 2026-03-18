import { describe, expect, it, vi } from "vitest";
import { PncpEditalStatus } from "@prisma/client";
import { AIService } from "../ai/ai.service";
import { DocumentProcessorService } from "../ai/rag/document-processor.service";
import { PrismaService } from "../common/prisma.service";
import { PncpAdapter } from "../sources/pncp.adapter";
import { PncpSearchService } from "../sources/pncp-search.service";
import type { NoticeQueryDto } from "./dto/notice-query.dto";
import { NoticesService } from "./notices.service";

function buildService(options?: {
  countResult?: number;
  rowsResult?: unknown[];
  detailResult?: Record<string, unknown>;
  normalizeNoticeImpl?: (payload: Record<string, unknown>) => Promise<unknown>;
  searchResult?: {
    total: number;
    types: unknown[];
    items: Record<string, unknown>[];
  };
  searchError?: Error;
}) {
  const countMock = vi.fn().mockResolvedValue(options?.countResult ?? 0);
  const findManyMock = vi.fn();
  if (options?.rowsResult) {
    for (const rows of [options.rowsResult]) {
      findManyMock.mockResolvedValueOnce(rows);
    }
  } else {
    findManyMock.mockResolvedValue([]);
  }
  const findUniqueOrThrowMock = vi.fn().mockResolvedValue(options?.detailResult ?? null);
  const transactionMock = vi.fn(async (queries: Promise<unknown>[]) => Promise.all(queries));
  const normalizeNoticeMock = vi.fn(
    options?.normalizeNoticeImpl ?? (async (payload: Record<string, unknown>) => payload)
  );
  const upsertMock = vi.fn().mockResolvedValue(null);
  const searchEditaisMock = options?.searchError
    ? vi.fn().mockRejectedValue(options.searchError)
    : vi.fn().mockResolvedValue(
        options?.searchResult ?? {
          total: 0,
          types: [],
          items: []
        }
      );

  const service = new NoticesService(
    {} as AIService,
    { normalizeNotice: normalizeNoticeMock } as unknown as PncpAdapter,
    { getItens: vi.fn().mockResolvedValue([]), getArquivos: vi.fn().mockResolvedValue([]) } as any,
    { searchEditais: searchEditaisMock } as unknown as PncpSearchService,
    {
      $transaction: transactionMock,
      pncpEdital: {
        count: countMock,
        findMany: findManyMock,
        findUniqueOrThrow: findUniqueOrThrowMock,
        upsert: upsertMock
      }
    } as unknown as PrismaService,
    {} as DocumentProcessorService
  );

  return {
    service,
    countMock,
    findManyMock,
    findUniqueOrThrowMock,
    transactionMock,
    normalizeNoticeMock,
    upsertMock,
    searchEditaisMock
  };
}

describe("NoticesService.search", () => {
  it("returns paginated results from remote PNCP search while persisting current page locally", async () => {
    const { service, findManyMock, upsertMock, searchEditaisMock, countMock } = buildService({
      searchResult: {
        total: 36891,
        types: [{ name: "edital", total: 36891 }],
        items: [
          {
            numero_controle_pncp: "13891536000196-1-000011/2026",
            orgao_cnpj: "13891536000196",
            orgao_nome: "MUNICIPIO DE AMERICA DOURADA",
            modalidade_licitacao_id: "6",
            modalidade_licitacao_nome: "Pregao - Eletronico",
            situacao_nome: "Divulgada no PNCP",
            data_publicacao_pncp: "2026-03-16T16:29:07.577355416",
            data_fim_vigencia: "2026-03-26T14:00:00",
            description: "Descricao do edital",
            ano: "2026",
            numero_sequencial: "11"
          }
        ]
      },
      rowsResult: [
        {
          id: "d6f6ca29-bcfd-4ea7-a2dc-c4f2acc0e99e",
          pncpId: "13891536000196-1-000011/2026",
          nomeOrgao: "MUNICIPIO DE AMERICA DOURADA",
          objetoCompra: "Descricao do edital",
          modalidadeNome: "Pregao - Eletronico",
          status: PncpEditalStatus.PUBLICADO,
          situacaoNome: "Divulgada no PNCP",
          uf: "BA",
          municipioNome: "America Dourada",
          dataPublicacaoPncp: new Date("2026-03-16T16:29:07.577Z"),
          dataAberturaProposta: null,
          dataEncerramentoProposta: new Date("2026-03-26T14:00:00.000Z"),
          valorTotalEstimado: null,
          linkEdital: null,
          portalUrl: "https://pncp.gov.br/app/compras/13891536000196/2026/11",
          isPublishedOnPncp: true,
          validatedAt: new Date("2026-03-16T18:00:00.000Z"),
          numeroCompra: "11",
          anoCompra: 2026,
          dataUltimaAtualizacao: null
        }
      ]
    });

    const query = {
      query: "cadeiras",
      page: 1,
      pageSize: 20,
      sort: "publishedAt:desc"
    } as NoticeQueryDto;

    const result = await service.search(query);

    expect(searchEditaisMock).toHaveBeenCalledTimes(1);
    expect(findManyMock).toHaveBeenCalledTimes(1);
    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(countMock).not.toHaveBeenCalled();
    expect(result.total).toBe(36891);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.externalId).toBe("13891536000196-1-000011/2026");
  });

  it("falls back to local cache when remote PNCP search fails", async () => {
    const { service, countMock, findManyMock, transactionMock, searchEditaisMock } = buildService({
      searchError: new Error("pncp offline"),
      countResult: 0,
      rowsResult: []
    });

    await service.search({
      page: 1,
      pageSize: 20,
      onlyOpen: true
    } as NoticeQueryDto);

    expect(searchEditaisMock).toHaveBeenCalledTimes(1);
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(countMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            {
              OR: [
                { isPublishedOnPncp: true },
                { isPublishedOnPncp: null }
              ]
            },
            expect.objectContaining({
              OR: expect.arrayContaining([
                { status: null },
                expect.objectContaining({
                  status: expect.objectContaining({
                    notIn: expect.arrayContaining([
                      PncpEditalStatus.ENCERRADO,
                      PncpEditalStatus.REVOGADO,
                      PncpEditalStatus.ANULADO,
                      PncpEditalStatus.SUSPENSO
                    ])
                  })
                })
              ])
            })
          ])
        })
      })
    );
    expect(findManyMock).toHaveBeenCalledTimes(1);
  });
});

describe("NoticesService.getDetail", () => {
  it("uses source system fallback when official document link is missing", async () => {
    const { service, normalizeNoticeMock } = buildService({
      detailResult: {
        id: "notice-1",
        pncpId: "13323274000163-1-000154/2026",
        linkEdital: null,
        linkSistemaOrigem: "https://compras.exemplo.gov.br/processo/154",
        portalUrl: "https://pncp.gov.br/app/compras/13323274000163/2026/154",
        nomeOrgao: "Orgao A",
        objetoCompra: "Objeto A",
        modalidadeNome: "Pregao",
        situacaoNome: "Divulgada no PNCP",
        municipioNome: "Sao Paulo",
        dataPublicacaoPncp: null,
        dataAberturaProposta: null,
        dataEncerramentoProposta: null,
        dataUltimaAtualizacao: null,
        valorTotalEstimado: null,
        informacaoComplementar: null,
        numeroControlePncp: "13323274000163-1-000154/2026",
        modoDisputaNome: null,
        rawPayload: {}
      }
    });

    await service.getDetail("notice-1");

    expect(normalizeNoticeMock).toHaveBeenCalledTimes(1);
    expect(normalizeNoticeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        link_edital: null,
        official_links: [
          {
            id: "notice-1-source-system",
            label: "Sistema de origem",
            url: "https://compras.exemplo.gov.br/processo/154",
            kind: "source_system"
          }
        ],
        documents: []
      })
    );
  });

  it("prioritizes official document link when available", async () => {
    const { service, normalizeNoticeMock } = buildService({
      detailResult: {
        id: "notice-2",
        pncpId: "13323274000163-1-000155/2026",
        linkEdital: "https://docs.exemplo.gov.br/edital-155.pdf",
        linkSistemaOrigem: "https://compras.exemplo.gov.br/processo/155",
        portalUrl: "https://pncp.gov.br/app/compras/13323274000163/2026/155",
        nomeOrgao: "Orgao B",
        objetoCompra: "Objeto B",
        modalidadeNome: "Concorrencia",
        situacaoNome: "Divulgada no PNCP",
        municipioNome: "Campinas",
        dataPublicacaoPncp: null,
        dataAberturaProposta: null,
        dataEncerramentoProposta: null,
        dataUltimaAtualizacao: null,
        valorTotalEstimado: null,
        informacaoComplementar: null,
        numeroControlePncp: "13323274000163-1-000155/2026",
        modoDisputaNome: null,
        rawPayload: {}
      }
    });

    await service.getDetail("notice-2");

    expect(normalizeNoticeMock).toHaveBeenCalledTimes(1);
    expect(normalizeNoticeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        link_edital: "https://docs.exemplo.gov.br/edital-155.pdf",
        official_links: [
          {
            id: "notice-2-official-document",
            label: "Documento oficial",
            url: "https://docs.exemplo.gov.br/edital-155.pdf",
            kind: "document"
          }
        ],
        documents: [
          expect.objectContaining({
            sourceUrl: "https://docs.exemplo.gov.br/edital-155.pdf"
          })
        ]
      })
    );
  });
});
