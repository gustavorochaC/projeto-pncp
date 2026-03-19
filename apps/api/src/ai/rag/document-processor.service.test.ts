import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../common/prisma.service";
import type { PncpConsultaService } from "../../sources/pncp-consulta.service";
import type { EmbeddingService } from "./embedding.service";
import { DocumentProcessorService } from "./document-processor.service";

const mockFindUniqueOrThrow = vi.fn();
const mockNoticeChunkCount = vi.fn();
const mockNoticeChunkFindMany = vi.fn();
const mockNoticeEmbeddingCount = vi.fn();
const mockNoticeEmbeddingFindMany = vi.fn();
const mockNoticeEmbeddingDeleteMany = vi.fn();
const mockNoticeChunkDeleteMany = vi.fn();
const mockGetArquivos = vi.fn();
const mockGenerateEmbedding = vi.fn();
const mockStoreEmbeddings = vi.fn();

const prisma = {
  pncpEdital: {
    findUniqueOrThrow: mockFindUniqueOrThrow,
  },
  noticeChunk: {
    count: mockNoticeChunkCount,
    findMany: mockNoticeChunkFindMany,
    deleteMany: mockNoticeChunkDeleteMany,
  },
  noticeEmbedding: {
    count: mockNoticeEmbeddingCount,
    findMany: mockNoticeEmbeddingFindMany,
    deleteMany: mockNoticeEmbeddingDeleteMany,
  },
} as unknown as PrismaService;

const embeddingService = {
  generateEmbedding: mockGenerateEmbedding,
  storeEmbeddings: mockStoreEmbeddings,
} as unknown as EmbeddingService;

const pncpConsultaService = {
  getArquivos: mockGetArquivos,
} as unknown as PncpConsultaService;

function buildService() {
  return new DocumentProcessorService(prisma, embeddingService, pncpConsultaService);
}

beforeEach(() => {
  vi.restoreAllMocks();

  mockFindUniqueOrThrow.mockResolvedValue({
    id: "11111111-1111-4111-8111-111111111111",
    cnpjOrgao: "12345678000199",
    anoCompra: 2026,
    sequencialCompra: 11,
  });
  mockNoticeChunkDeleteMany.mockResolvedValue({ count: 0 });
  mockNoticeEmbeddingDeleteMany.mockResolvedValue({ count: 0 });
  mockGetArquivos.mockResolvedValue([]);
  mockGenerateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
  mockStoreEmbeddings.mockResolvedValue(undefined);
});

describe("DocumentProcessorService", () => {
  it("regera embeddings faltantes quando ja existem chunks salvos", async () => {
    mockNoticeChunkCount.mockResolvedValueOnce(2).mockResolvedValueOnce(2);
    mockNoticeEmbeddingCount.mockResolvedValueOnce(0).mockResolvedValueOnce(2);
    mockNoticeChunkFindMany.mockResolvedValue([
      { id: "chunk-1", content: "primeiro trecho" },
      { id: "chunk-2", content: "segundo trecho" },
    ]);
    mockNoticeEmbeddingFindMany.mockResolvedValue([]);

    const service = buildService();
    const result = await service.processNoticeDocuments("11111111-1111-4111-8111-111111111111");

    expect(mockGenerateEmbedding).toHaveBeenCalledTimes(2);
    expect(mockStoreEmbeddings).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      noticeId: "11111111-1111-4111-8111-111111111111",
      status: "done",
      chunksCount: 2,
      embeddingsCount: 2,
    });
    expect(mockGetArquivos).not.toHaveBeenCalled();
  });

  it("expoe status idle quando o texto foi extraido mas ainda nao ha embeddings", async () => {
    mockNoticeChunkCount.mockResolvedValueOnce(2);
    mockNoticeEmbeddingCount.mockResolvedValueOnce(0);

    const service = buildService();
    const result = await service.getProcessingStatus("11111111-1111-4111-8111-111111111111");

    expect(result).toEqual({
      noticeId: "11111111-1111-4111-8111-111111111111",
      status: "idle",
      chunksCount: 2,
      embeddingsCount: 0,
      message: "Os textos foram extraidos, mas ainda faltam embeddings para a busca semantica.",
    });
  });
});
