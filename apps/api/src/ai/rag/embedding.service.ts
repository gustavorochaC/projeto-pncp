import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { fetchWithTimeout, isAbortError } from '../ai-request.util';

const OLLAMA_EMBED_TIMEOUT_MS = 8000;

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly ollamaBaseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
  private readonly embeddingModel = process.env.OLLAMA_EMBEDDING_MODEL ?? 'qwen3-embedding';

  constructor(private readonly prisma: PrismaService) {}

  async generateEmbedding(text: string): Promise<number[]> {
    let response: Response;

    try {
      response = await fetchWithTimeout(
        `${this.ollamaBaseUrl}/api/embed`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.embeddingModel,
            input: text,
          }),
        },
        OLLAMA_EMBED_TIMEOUT_MS,
      );
    } catch (error) {
      if (isAbortError(error)) {
        throw new Error('Ollama embed timed out');
      }

      throw error;
    }

    if (!response.ok) {
      throw new Error(`Ollama embed failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as { embeddings: number[][] };
    const embedding = data.embeddings?.[0];

    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error('Ollama returned empty embedding');
    }

    return embedding;
  }

  async storeEmbeddings(
    noticeId: string,
    chunks: { chunkId: string; embedding: number[] }[],
  ): Promise<void> {
    for (const chunk of chunks) {
      const embeddingStr = `[${chunk.embedding.join(',')}]`;
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO notice_embeddings (id, notice_id, chunk_id, model, dimensions, embedding, created_at)
         VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3, $4, $5::vector, NOW())
         ON CONFLICT DO NOTHING`,
        noticeId,
        chunk.chunkId,
        this.embeddingModel,
        chunk.embedding.length,
        embeddingStr,
      );
    }
  }

  async searchSimilarChunks(
    noticeId: string,
    queryEmbedding: number[],
    topK = 5,
  ): Promise<{
    chunkId: string;
    content: string;
    chunkIndex: number;
    attachmentId: string | null;
    similarity: number;
  }[]> {
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    const results = await this.prisma.$queryRawUnsafe<{
      chunk_id: string;
      content: string;
      chunk_index: number;
      attachment_id: string | null;
      similarity: number;
    }[]>(
      `SELECT
         ne.chunk_id,
         nc.content,
         nc.chunk_index,
         nc.attachment_id,
         1 - (ne.embedding <=> $2::vector) AS similarity
       FROM notice_embeddings ne
       JOIN notice_chunks nc ON nc.id = ne.chunk_id
       WHERE ne.notice_id = $1::uuid
         AND (1 - (ne.embedding <=> $2::vector)) > 0.3
       ORDER BY ne.embedding <=> $2::vector ASC
       LIMIT $3`,
      noticeId,
      embeddingStr,
      topK,
    );

    return results.map(r => ({
      chunkId: r.chunk_id,
      content: r.content,
      chunkIndex: r.chunk_index,
      attachmentId: r.attachment_id,
      similarity: Number(r.similarity),
    }));
  }
}
