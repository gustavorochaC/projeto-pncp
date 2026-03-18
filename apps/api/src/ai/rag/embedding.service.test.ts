import { describe, expect, it, vi, beforeEach } from "vitest";
import { EmbeddingService } from "./embedding.service";
import type { PrismaService } from "../../common/prisma.service";

const mockExecuteRaw = vi.fn().mockResolvedValue(1);
const mockQueryRaw = vi.fn();

const prisma = {
  $executeRawUnsafe: mockExecuteRaw,
  $queryRawUnsafe: mockQueryRaw,
} as unknown as PrismaService;

function buildService() {
  return new EmbeddingService(prisma);
}

describe("EmbeddingService.generateEmbedding", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockExecuteRaw.mockResolvedValue(1);
    mockQueryRaw.mockResolvedValue([]);
  });

  it("retorna array de números quando Ollama responde com sucesso", async () => {
    const embedding = [0.1, 0.2, 0.3];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ embeddings: [embedding] }),
      })
    );

    const service = buildService();
    const result = await service.generateEmbedding("texto de teste");
    expect(result).toEqual(embedding);
  });

  it("lança erro quando Ollama retorna status não-ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      })
    );

    const service = buildService();
    await expect(service.generateEmbedding("texto")).rejects.toThrow("Ollama embed failed");
  });

  it("lança erro quando embeddings retornados estão vazios", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ embeddings: [[]] }),
      })
    );

    const service = buildService();
    await expect(service.generateEmbedding("texto")).rejects.toThrow("empty embedding");
  });

  it("lança erro quando fetch falha (rede indisponível)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));

    const service = buildService();
    await expect(service.generateEmbedding("texto")).rejects.toThrow("network error");
  });

  it("lança timeout dedicado quando a chamada ao Ollama expira", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" }))
    );

    const service = buildService();
    await expect(service.generateEmbedding("texto")).rejects.toThrow("timed out");
  });
});

describe("EmbeddingService.storeEmbeddings", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockExecuteRaw.mockResolvedValue(1);
  });

  it("chama $executeRawUnsafe uma vez por chunk", async () => {
    const service = buildService();
    await service.storeEmbeddings("notice-uuid", [
      { chunkId: "chunk-1", embedding: [0.1, 0.2] },
      { chunkId: "chunk-2", embedding: [0.3, 0.4] },
    ]);
    expect(mockExecuteRaw).toHaveBeenCalledTimes(2);
  });

  it("formata embedding como string [n,n,...] no SQL", async () => {
    const service = buildService();
    await service.storeEmbeddings("notice-uuid", [
      { chunkId: "chunk-1", embedding: [0.5, 0.6, 0.7] },
    ]);
    const sqlArgs = mockExecuteRaw.mock.calls[0];
    expect(sqlArgs).toContain("[0.5,0.6,0.7]");
  });

  it("não chama $executeRawUnsafe se lista de chunks for vazia", async () => {
    const service = buildService();
    await service.storeEmbeddings("notice-uuid", []);
    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });
});

describe("EmbeddingService.searchSimilarChunks", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockQueryRaw.mockResolvedValue([]);
  });

  it("retorna array vazio quando banco não retorna resultados", async () => {
    mockQueryRaw.mockResolvedValue([]);
    const service = buildService();
    const result = await service.searchSimilarChunks("notice-uuid", [0.1, 0.2], 5);
    expect(result).toEqual([]);
  });

  it("mapeia snake_case do banco para camelCase correto", async () => {
    mockQueryRaw.mockResolvedValue([
      {
        chunk_id: "abc",
        content: "trecho relevante",
        chunk_index: 3,
        attachment_id: null,
        similarity: 0.85,
      },
    ]);

    const service = buildService();
    const result = await service.searchSimilarChunks("notice-uuid", [0.1, 0.2], 5);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      chunkId: "abc",
      content: "trecho relevante",
      chunkIndex: 3,
      attachmentId: null,
      similarity: 0.85,
    });
  });

  it("converte similarity para Number (evita BigInt ou string do postgres)", async () => {
    mockQueryRaw.mockResolvedValue([
      {
        chunk_id: "x",
        content: "c",
        chunk_index: 0,
        attachment_id: null,
        similarity: "0.72", // postgres pode retornar string
      },
    ]);

    const service = buildService();
    const result = await service.searchSimilarChunks("notice-uuid", [0.1], 5);
    expect(typeof result[0].similarity).toBe("number");
    expect(result[0].similarity).toBeCloseTo(0.72);
  });

  it("passa topK como parâmetro para a query", async () => {
    mockQueryRaw.mockResolvedValue([]);
    const service = buildService();
    await service.searchSimilarChunks("notice-uuid", [0.1, 0.2], 3);
    const callArgs = mockQueryRaw.mock.calls[0];
    expect(callArgs).toContain(3);
  });
});
