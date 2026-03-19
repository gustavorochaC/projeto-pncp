import { BadGatewayException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../common/prisma.service";
import type { PncpConsultaService } from "../sources/pncp-consulta.service";
import type { DocumentProcessorService } from "./rag/document-processor.service";
import type { EmbeddingService } from "./rag/embedding.service";
import { ParticipationRequirementsService } from "./participation-requirements.service";

const mockAnalyzerReportUpsert = vi.fn();
const mockAnalyzerReportUpdate = vi.fn();
const mockFindUniqueOrThrow = vi.fn();
const mockNoticeChunkCount = vi.fn();
const mockNoticeChunkFindMany = vi.fn();
const mockNoticeEmbeddingCount = vi.fn();
const mockGenerateEmbedding = vi.fn();
const mockSearchSimilarChunks = vi.fn();
const mockProcessNoticeDocuments = vi.fn();
const mockGetArquivos = vi.fn();
const fetchMock = vi.fn();

const prisma = {
  analyzerReport: {
    upsert: mockAnalyzerReportUpsert,
    update: mockAnalyzerReportUpdate,
  },
  pncpEdital: {
    findUniqueOrThrow: mockFindUniqueOrThrow,
  },
  noticeChunk: {
    count: mockNoticeChunkCount,
    findMany: mockNoticeChunkFindMany,
  },
  noticeEmbedding: {
    count: mockNoticeEmbeddingCount,
  },
} as unknown as PrismaService;

const embeddingService = {
  generateEmbedding: mockGenerateEmbedding,
  searchSimilarChunks: mockSearchSimilarChunks,
} as unknown as EmbeddingService;

const documentProcessorService = {
  processNoticeDocuments: mockProcessNoticeDocuments,
} as unknown as DocumentProcessorService;

const pncpConsultaService = {
  getArquivos: mockGetArquivos,
} as unknown as PncpConsultaService;

function buildService() {
  return new ParticipationRequirementsService(
    prisma,
    embeddingService,
    documentProcessorService,
    pncpConsultaService,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  fetchMock.mockReset();

  mockAnalyzerReportUpsert.mockResolvedValue({
    id: "report-1",
    requisitosParticipacao: null,
  });
  mockAnalyzerReportUpdate.mockResolvedValue({});
  mockFindUniqueOrThrow.mockResolvedValue({
    id: "11111111-1111-4111-8111-111111111111",
    pncpId: "pncp-1",
    numeroControlePncp: "13891536000196-1-000011/2026",
    objetoCompra: "Contratacao de servicos de tecnologia",
    nomeOrgao: "Orgao Teste",
    cnpjOrgao: "12345678000199",
    modalidadeNome: "Pregao",
    codigoModalidade: "05",
    situacaoNome: "Aberto",
    status: "ABERTO",
    municipioNome: "Sao Paulo",
    uf: "SP",
    valorTotalEstimado: "12000.00",
    dataAberturaProposta: new Date("2026-03-20T10:00:00.000Z"),
    dataEncerramentoProposta: new Date("2026-03-25T10:00:00.000Z"),
    informacaoComplementar: null,
    justificativa: null,
    anoCompra: 2026,
    sequencialCompra: 11,
  });
  mockNoticeChunkCount.mockResolvedValue(3);
  mockNoticeChunkFindMany.mockResolvedValue([
    {
      id: "chunk-1",
      content: "A licitante devera apresentar atestado de capacidade tecnica compativel com o objeto.",
      chunkIndex: 7,
      attachmentId: null,
      sourceDocumentName: "Edital Principal.pdf",
      sourceDocumentType: "Edital",
      sourceDocumentKey: "1",
      sourceDocumentUrl: "https://example.com/edital.pdf",
    },
  ]);
  mockNoticeEmbeddingCount.mockResolvedValue(3);
  mockGenerateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
  mockSearchSimilarChunks.mockResolvedValue([
    {
      chunkId: "chunk-1",
      content: "A licitante devera apresentar atestado de capacidade tecnica compativel com o objeto.",
      chunkIndex: 7,
      attachmentId: null,
      sourceDocumentName: "Edital Principal.pdf",
      sourceDocumentType: "Edital",
      sourceDocumentKey: "1",
      sourceDocumentUrl: "https://example.com/edital.pdf",
      similarity: 0.91,
    },
  ]);
  mockProcessNoticeDocuments.mockResolvedValue({
    noticeId: "11111111-1111-4111-8111-111111111111",
    status: "done",
    chunksCount: 3,
    embeddingsCount: 3,
  });
  mockGetArquivos.mockResolvedValue([
    {
      sequencialDocumento: 1,
      titulo: "Edital Principal.pdf",
      tipoDocumentoNome: "Edital",
      statusAtivo: true,
    },
  ]);

  vi.stubGlobal(
    "fetch",
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        response: JSON.stringify({
          explicit_requirements: [
            {
              category: "qualificacao_tecnica",
              subcategory: "atestado_capacidade_tecnica",
              requirement: "Apresentar atestado de capacidade tecnica compativel com o objeto.",
              normalized_term: "atestado_capacidade_tecnica",
              mandatory_level: "mandatory",
              applies_to: "todos_licitantes",
              source_document: "Edital Principal.pdf",
              evidence_excerpt: "A licitante devera apresentar atestado de capacidade tecnica compativel com o objeto.",
              confidence: "high",
            },
          ],
          possible_inferences: [],
          missing_evidence: [],
          documents_reviewed: ["Edital Principal.pdf"],
          analysis_notes: ["Leitura consolidada do edital principal."],
        }),
      }),
    }),
  );
});

describe("ParticipationRequirementsService", () => {
  it("reaproveita o cache do analyzer report quando a analise ja existe", async () => {
    mockAnalyzerReportUpsert.mockResolvedValueOnce({
      id: "report-1",
      requisitosParticipacao: {
        content: "Encontrei 1 requisito explicito de participacao.",
        generatedAt: "2026-03-19T10:00:00.000Z",
        confidence: "high",
        metadata: {
          hasProcessedChunks: true,
          citations: [
            {
              title: "Edital Principal.pdf",
              excerpt: "A licitante devera apresentar atestado de capacidade tecnica compativel com o objeto.",
            },
          ],
          structuredData: {
            kind: "participation_requirements",
            explicitRequirements: [
              {
                category: "qualificacao_tecnica",
                subcategory: "atestado_capacidade_tecnica",
                requirement: "Apresentar atestado de capacidade tecnica compativel com o objeto.",
                normalizedTerm: "atestado_capacidade_tecnica",
                mandatoryLevel: "mandatory",
                appliesTo: "todos_licitantes",
                sourceDocument: "Edital Principal.pdf",
                evidenceExcerpt: "A licitante devera apresentar atestado de capacidade tecnica compativel com o objeto.",
                confidence: "high",
              },
            ],
            possibleInferences: [],
            missingEvidence: [],
            documentsReviewed: ["Edital Principal.pdf"],
            analysisNotes: [],
          },
        },
      },
    });

    const service = buildService();
    const result = await service.getOrGenerateAnalysis(
      "11111111-1111-4111-8111-111111111111",
      "33333333-3333-4333-8333-333333333333",
    );

    expect(result.structuredData.explicitRequirements).toHaveLength(1);
    expect(result.citations[0]?.title).toBe("Edital Principal.pdf");
    expect(fetch).not.toHaveBeenCalled();
    expect(mockSearchSimilarChunks).not.toHaveBeenCalled();
  });

  it("ignora cache vazio legado quando ja existem chunks locais para reler", async () => {
    mockAnalyzerReportUpsert.mockResolvedValueOnce({
      id: "report-1",
      requisitosParticipacao: {
        content: "Encontrei 0 requisitos explicitos de participacao com base em 1 documento.",
        generatedAt: "2026-03-19T10:00:00.000Z",
        confidence: "low",
        metadata: {
          hasProcessedChunks: true,
          citations: [],
          structuredData: {
            kind: "participation_requirements",
            explicitRequirements: [],
            possibleInferences: [],
            missingEvidence: [],
            documentsReviewed: ["Edital Principal.pdf"],
            analysisNotes: [],
          },
        },
      },
    });
    mockNoticeEmbeddingCount.mockResolvedValueOnce(0);

    const service = buildService();
    const result = await service.getOrGenerateAnalysis(
      "11111111-1111-4111-8111-111111111111",
      "33333333-3333-4333-8333-333333333333",
    );

    expect(fetch).toHaveBeenCalled();
    expect(mockProcessNoticeDocuments).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111");
    expect(result.documentTextsCount).toBe(1);
  });

  it("falha com mensagem amigavel quando o Ollama retorna JSON invalido", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ response: "nao sou json" }),
      }),
    );

    const service = buildService();

    await expect(
      service.getOrGenerateAnalysis(
        "11111111-1111-4111-8111-111111111111",
        "33333333-3333-4333-8333-333333333333",
      ),
    ).rejects.toBeInstanceOf(BadGatewayException);

    expect(mockAnalyzerReportUpdate).not.toHaveBeenCalled();
  });

  it("gera citacoes com o nome real do documento de origem", async () => {
    const service = buildService();
    const result = await service.getOrGenerateAnalysis(
      "11111111-1111-4111-8111-111111111111",
      "33333333-3333-4333-8333-333333333333",
    );

    expect(result.citations[0]).toEqual(
      expect.objectContaining({
        title: "Edital Principal.pdf",
        sourceUrl: "https://pncp.gov.br/api/pncp/v1/orgaos/12345678000199/compras/2026/11/arquivos/1",
      }),
    );
    expect(mockAnalyzerReportUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          requisitosParticipacao: expect.any(Object),
        }),
      }),
    );
  });

  it("usa chunks brutos como fallback quando a indexacao semantica ainda nao existe", async () => {
    mockNoticeEmbeddingCount.mockResolvedValueOnce(0);

    const service = buildService();
    await service.getOrGenerateAnalysis(
      "11111111-1111-4111-8111-111111111111",
      "33333333-3333-4333-8333-333333333333",
    );

    expect(mockSearchSimilarChunks).not.toHaveBeenCalled();
    expect(mockNoticeChunkFindMany).toHaveBeenCalled();

    const requestBody = JSON.parse(fetchMock.mock.calls.at(-1)?.[1]?.body as string) as { prompt: string };
    expect(requestBody.prompt).toContain('"document_texts": [');
    expect(requestBody.prompt).toContain("A licitante devera apresentar atestado de capacidade tecnica");
  });
});
