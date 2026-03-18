import { GatewayTimeoutException, ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { PrismaService } from "../common/prisma.service";
import type { EmbeddingService } from "./rag/embedding.service";
import { AIService } from "./ai.service";

const mockFindUniqueOrThrow = vi.fn();
const mockChunkCount = vi.fn();
const mockTrainingRulesFindMany = vi.fn();
const mockMessagesFindMany = vi.fn();
const mockConversationCreate = vi.fn();
const mockMessageCreateMany = vi.fn();
const mockUserFindUnique = vi.fn();
const mockUserFindFirst = vi.fn();

const mockGenerateEmbedding = vi.fn();
const mockSearchSimilarChunks = vi.fn();

const prisma = {
  pncpEdital: {
    findUniqueOrThrow: mockFindUniqueOrThrow,
  },
  noticeChunk: {
    count: mockChunkCount,
  },
  aITrainingRule: {
    findMany: mockTrainingRulesFindMany,
  },
  aIMessage: {
    findMany: mockMessagesFindMany,
    createMany: mockMessageCreateMany,
  },
  aIConversation: {
    create: mockConversationCreate,
  },
  user: {
    findUnique: mockUserFindUnique,
    findFirst: mockUserFindFirst,
  },
} as unknown as PrismaService;

const embeddingService = {
  generateEmbedding: mockGenerateEmbedding,
  searchSimilarChunks: mockSearchSimilarChunks,
} as unknown as EmbeddingService;

function buildService() {
  return new AIService(prisma, embeddingService);
}

beforeEach(() => {
  vi.restoreAllMocks();
  mockFindUniqueOrThrow.mockResolvedValue({
    id: "11111111-1111-4111-8111-111111111111",
    pncpId: "pncp-1",
    objetoCompra: "Contratacao de servicos",
    nomeOrgao: "Orgao Teste",
    cnpjOrgao: "12345678000199",
    modalidadeNome: "Pregao",
    codigoModalidade: "05",
    situacaoNome: "Ativo",
    status: "ABERTO",
    municipioNome: "Sao Paulo",
    uf: "SP",
    valorTotalEstimado: "1234.56",
    dataEncerramentoProposta: new Date("2026-12-01T12:00:00.000Z"),
    linkEdital: "https://example.com/edital.pdf",
    linkSistemaOrigem: "https://example.com/origem",
    rawPayload: {},
  });
  mockChunkCount.mockResolvedValue(0);
  mockTrainingRulesFindMany.mockResolvedValue([]);
  mockMessagesFindMany.mockResolvedValue([]);
  mockConversationCreate.mockResolvedValue({
    id: "22222222-2222-4222-8222-222222222222",
  });
  mockMessageCreateMany.mockResolvedValue({ count: 2 });
  mockUserFindUnique.mockResolvedValue(null);
  mockUserFindFirst.mockResolvedValue({
    id: "33333333-3333-4333-8333-333333333333",
  });
  mockGenerateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
  mockSearchSimilarChunks.mockResolvedValue([]);

  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ response: "Resposta base da IA" }),
    }),
  );
});

describe("AIService.answerNoticeQuestion", () => {
  it("responde perguntas gerais com resumo estruturado sem depender do modelo", async () => {
    const service = buildService();

    const result = await service.answerNoticeQuestion(
      "11111111-1111-4111-8111-111111111111",
      {
        question: "Esse edital fala sobre o que?",
      },
    );

    expect(mockGenerateEmbedding).not.toHaveBeenCalled();
    expect(mockSearchSimilarChunks).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(result.answer).toContain("Com os dados oficiais que ja tenho deste edital");
    expect(result.answer).toContain("Objeto: Contratacao de servicos");
    expect(result.missingInformation).toEqual([
      "A resposta atual usa os dados estruturados do edital enquanto os documentos sao enriquecidos em segundo plano.",
    ]);
    expect(mockConversationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "33333333-3333-4333-8333-333333333333",
        }),
      }),
    );
    expect(result.conversationId).toBe("22222222-2222-4222-8222-222222222222");
  });

  it("retorna erro explicito quando nao consegue persistir a conversa", async () => {
    mockConversationCreate.mockRejectedValueOnce(new Error("db down"));
    const service = buildService();

    await expect(
      service.answerNoticeQuestion(
        "11111111-1111-4111-8111-111111111111",
        {
          question: "Resumo do edital",
        },
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("faz fallback para resumo estruturado quando o Ollama demora demais", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" })),
    );

    const service = buildService();

    const result = await service.answerNoticeQuestion(
      "11111111-1111-4111-8111-111111111111",
      {
        question: "Quais exigencias principais esse edital traz?",
      },
    );

    expect(result.answer).toContain("Nao consegui consultar o modelo de IA dentro do tempo esperado");
    expect(result.answer).toContain("Orgao responsavel: Orgao Teste");
  });

  it("usa o userId do payload quando ele existe no banco", async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      id: "44444444-4444-4444-8444-444444444444",
    });
    const service = buildService();

    await service.answerNoticeQuestion(
      "11111111-1111-4111-8111-111111111111",
      {
        question: "Quais informações vc tem desse edital?",
        userId: "44444444-4444-4444-8444-444444444444",
      },
    );

    expect(mockConversationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "44444444-4444-4444-8444-444444444444",
        }),
      }),
    );
  });
});
