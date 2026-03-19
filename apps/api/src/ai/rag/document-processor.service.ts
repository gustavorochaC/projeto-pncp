import { Injectable, Logger } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import type { DocumentProcessingStatus } from '@pncp/types';
import { PrismaService } from '../../common/prisma.service';
import { PncpConsultaService } from '../../sources/pncp-consulta.service';
import { EmbeddingService } from './embedding.service';
import { chunkText } from './chunk.util';

@Injectable()
export class DocumentProcessorService {
  private readonly logger = new Logger(DocumentProcessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: EmbeddingService,
    private readonly pncpConsultaService: PncpConsultaService,
  ) {}

  async processNoticeDocuments(noticeId: string, force = false): Promise<DocumentProcessingStatus> {
    const edital = await this.prisma.pncpEdital.findUniqueOrThrow({ where: { id: noticeId } });

    if (!force) {
      const existingStatus = await this.loadStoredStatus(noticeId);
      if (existingStatus.chunksCount > 0 && existingStatus.embeddingsCount >= existingStatus.chunksCount) {
        return existingStatus;
      }

      if (existingStatus.chunksCount > 0) {
        await this.backfillMissingEmbeddings(noticeId);
        return this.loadStoredStatus(noticeId);
      }
    }

    if (!edital.cnpjOrgao || !edital.anoCompra || !edital.sequencialCompra) {
      return { noticeId, status: 'error', chunksCount: 0, embeddingsCount: 0, message: 'Edital sem dados PNCP suficientes' };
    }

    let arquivos: Awaited<ReturnType<PncpConsultaService['getArquivos']>> = [];
    try {
      arquivos = await this.pncpConsultaService.getArquivos({
        cnpjOrgao: edital.cnpjOrgao,
        anoCompra: edital.anoCompra,
        sequencialCompra: edital.sequencialCompra,
      });
    } catch (err) {
      this.logger.warn(`Falha ao buscar arquivos do edital ${noticeId}: ${err}`);
      return { noticeId, status: 'error', chunksCount: 0, embeddingsCount: 0, message: 'Erro ao buscar arquivos' };
    }

    const activeArquivos = arquivos.filter(a => a.statusAtivo);
    if (activeArquivos.length === 0) {
      return { noticeId, status: 'idle', chunksCount: 0, embeddingsCount: 0, message: 'Nenhum arquivo ativo encontrado' };
    }

    if (force) {
      await Promise.all([
        this.prisma.noticeEmbedding.deleteMany({ where: { noticeId } }),
        this.prisma.noticeChunk.deleteMany({ where: { noticeId } }),
      ]);
    }

    let totalChunks = 0;
    let totalEmbeddings = 0;
    let nextChunkIndex = 0;

    for (const arq of activeArquivos) {
      const url = `https://pncp.gov.br/api/pncp/v1/orgaos/${edital.cnpjOrgao}/compras/${edital.anoCompra}/${edital.sequencialCompra}/arquivos/${arq.sequencialDocumento}`;
      try {
        // Download PDF
        const res = await fetch(url);
        if (!res.ok) {
          this.logger.warn(`Falha ao baixar arquivo ${arq.titulo}: ${res.status}`);
          continue;
        }

        const buffer = Buffer.from(await res.arrayBuffer());
        const parser = new PDFParse({ data: buffer });
        const parsed = await parser.getText();
        const text = parsed.text;
        await parser.destroy();

        if (!text || text.trim().length === 0) {
          this.logger.warn(`PDF sem texto extraível: ${arq.titulo}`);
          continue;
        }

        const chunks = chunkText(text);
        if (chunks.length === 0) continue;

        const startChunkIndex = nextChunkIndex;

        // Save chunks
        const chunkRecords = chunks.map((chunk, idx) => ({
          noticeId,
          chunkIndex: startChunkIndex + idx,
          content: chunk.content,
          tokens: chunk.tokens,
          sourceDocumentName: arq.titulo,
          sourceDocumentType: arq.tipoDocumentoNome,
          sourceDocumentKey: String(arq.sequencialDocumento),
          sourceDocumentUrl: url,
        }));

        await this.prisma.noticeChunk.createMany({
          data: chunkRecords,
          skipDuplicates: true,
        });

        totalChunks += chunks.length;
        nextChunkIndex += chunks.length;

        // Generate and store embeddings
        const savedChunks = await this.prisma.noticeChunk.findMany({
          where: {
            noticeId,
            chunkIndex: {
              gte: startChunkIndex,
              lt: startChunkIndex + chunks.length,
            },
          },
          select: { id: true, chunkIndex: true },
        });

        for (const saved of savedChunks) {
          const chunk = chunks[saved.chunkIndex - startChunkIndex];
          if (!chunk) continue;
          try {
            const embedding = await this.embeddingService.generateEmbedding(chunk.content);
            await this.embeddingService.storeEmbeddings(noticeId, [{ chunkId: saved.id, embedding }]);
            totalEmbeddings++;
          } catch (embErr) {
            this.logger.warn(`Falha ao gerar embedding para chunk ${saved.id}: ${embErr}`);
          }
        }
      } catch (err) {
        this.logger.error(`Erro ao processar arquivo ${arq.titulo}: ${err}`);
        // Continue with next file
      }
    }

    return {
      noticeId,
      status: totalEmbeddings > 0 ? 'done' : 'error',
      chunksCount: totalChunks,
      embeddingsCount: totalEmbeddings,
      message: totalEmbeddings > 0 ? undefined : 'Os textos foram extraidos, mas a indexacao semantica falhou.',
    };
  }

  async getProcessingStatus(noticeId: string): Promise<DocumentProcessingStatus> {
    return this.loadStoredStatus(noticeId);
  }

  private async backfillMissingEmbeddings(noticeId: string): Promise<void> {
    const [chunks, storedEmbeddings] = await Promise.all([
      this.prisma.noticeChunk.findMany({
        where: { noticeId },
        select: { id: true, content: true },
        orderBy: { chunkIndex: 'asc' },
      }),
      this.prisma.noticeEmbedding.findMany({
        where: { noticeId },
        select: { chunkId: true },
      }),
    ]);

    const embeddedChunkIds = new Set(
      storedEmbeddings
        .map((item) => item.chunkId)
        .filter((item): item is string => typeof item === 'string' && item.length > 0),
    );

    for (const chunk of chunks) {
      if (embeddedChunkIds.has(chunk.id)) {
        continue;
      }

      try {
        const embedding = await this.embeddingService.generateEmbedding(chunk.content);
        await this.embeddingService.storeEmbeddings(noticeId, [{ chunkId: chunk.id, embedding }]);
      } catch (error) {
        this.logger.warn(`Falha ao regenerar embedding para chunk ${chunk.id}: ${error}`);
      }
    }
  }

  private async loadStoredStatus(noticeId: string): Promise<DocumentProcessingStatus> {
    const [chunksCount, embeddingsCount] = await Promise.all([
      this.prisma.noticeChunk.count({ where: { noticeId } }),
      this.prisma.noticeEmbedding.count({ where: { noticeId } }),
    ]);

    if (embeddingsCount > 0) {
      return {
        noticeId,
        status: 'done',
        chunksCount,
        embeddingsCount,
      };
    }

    if (chunksCount > 0) {
      return {
        noticeId,
        status: 'idle',
        chunksCount,
        embeddingsCount,
        message: 'Os textos foram extraidos, mas ainda faltam embeddings para a busca semantica.',
      };
    }

    return {
      noticeId,
      status: 'idle',
      chunksCount,
      embeddingsCount,
    };
  }
}
