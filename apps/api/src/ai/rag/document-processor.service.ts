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

    // Check if already processed
    if (!force) {
      const existingCount = await this.prisma.noticeChunk.count({ where: { noticeId } });
      if (existingCount > 0) {
        const embeddingsCount = await this.prisma.noticeEmbedding.count({ where: { noticeId } });
        return { noticeId, status: 'done', chunksCount: existingCount, embeddingsCount };
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

    let totalChunks = 0;
    let totalEmbeddings = 0;

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

        // Delete existing chunks for this notice before re-processing (if force)
        if (force && totalChunks === 0) {
          await this.prisma.noticeChunk.deleteMany({ where: { noticeId } });
        }

        // Save chunks
        const chunkRecords = chunks.map((chunk, idx) => ({
          noticeId,
          chunkIndex: idx,
          content: chunk.content,
          tokens: chunk.tokens,
        }));

        await this.prisma.noticeChunk.createMany({
          data: chunkRecords,
          skipDuplicates: true,
        });

        totalChunks += chunks.length;

        // Generate and store embeddings
        const savedChunks = await this.prisma.noticeChunk.findMany({
          where: { noticeId, chunkIndex: { in: chunks.map((_, idx) => idx) } },
          select: { id: true, chunkIndex: true },
        });

        for (const saved of savedChunks) {
          const chunk = chunks[saved.chunkIndex];
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
      status: totalChunks > 0 ? 'done' : 'error',
      chunksCount: totalChunks,
      embeddingsCount: totalEmbeddings,
    };
  }

  async getProcessingStatus(noticeId: string): Promise<DocumentProcessingStatus> {
    const [chunksCount, embeddingsCount] = await Promise.all([
      this.prisma.noticeChunk.count({ where: { noticeId } }),
      this.prisma.noticeEmbedding.count({ where: { noticeId } }),
    ]);

    return {
      noticeId,
      status: chunksCount > 0 ? 'done' : 'idle',
      chunksCount,
      embeddingsCount,
    };
  }
}
