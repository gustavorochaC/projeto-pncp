import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  AICitation,
  AnalyzerSectionResult,
  ParticipationRequirementsResult,
} from '@pncp/types';
import { PrismaService } from '../common/prisma.service';
import { PncpConsultaService } from '../sources/pncp-consulta.service';
import { fetchWithTimeout, isAbortError } from './ai-request.util';
import { DocumentProcessorService } from './rag/document-processor.service';
import { EmbeddingService } from './rag/embedding.service';
import {
  buildParticipationRequirementsChatAnswer,
  buildParticipationRequirementsCitations,
  coerceParticipationRequirementsResult,
  getParticipationRequirementsSkillInstructions,
  parseParticipationRequirementsResult,
} from './participation-requirements.util';

const GENERATION_TIMEOUT_MS = Number(
  process.env.OLLAMA_ANALYZER_TIMEOUT_MS ?? process.env.OLLAMA_GENERATION_TIMEOUT_MS ?? 120_000,
);
const PARTICIPATION_QUERY_TOP_K = 8;
const MAX_DOCUMENTS_IN_PROMPT = 12;
const MAX_CHUNKS_PER_DOCUMENT = 3;
const PARTICIPATION_SEARCH_QUERIES = [
  'habilitacao documentacao obrigatoria certidoes requisitos de participacao',
  'qualificacao tecnica atestado capacidade tecnica acervo tecnico CAT CREA CAU conselho profissional',
  'qualificacao economico-financeira balanco patrimonial patrimonio liquido capital social indices contabeis',
  'registro licenca alvara autorizacao credenciamento certificacao ISO declaracao obrigatoria SICAF',
  'visita tecnica amostra condicoes de participacao habilitacao juridica fiscal trabalhista',
];

type RelevantChunk = Awaited<
  ReturnType<EmbeddingService['searchSimilarChunks']>
>[number];

type ParticipationAnalysis = {
  sectionResult: AnalyzerSectionResult;
  structuredData: ParticipationRequirementsResult;
  citations: AICitation[];
  hasProcessedChunks: boolean;
  documentTextsCount: number;
};

type DocumentReadiness = {
  chunksCount: number;
  embeddingsCount: number;
  hasSearchableChunks: boolean;
};

@Injectable()
export class ParticipationRequirementsService {
  private readonly logger = new Logger(ParticipationRequirementsService.name);
  private readonly ollamaBaseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
  private readonly generationModel = process.env.OLLAMA_GENERATION_MODEL ?? 'qwen2.5:7b';

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: EmbeddingService,
    private readonly documentProcessorService: DocumentProcessorService,
    private readonly pncpConsultaService: PncpConsultaService,
  ) {}

  async getOrGenerateAnalysis(
    noticeId: string,
    userId: string,
    force = false,
  ): Promise<ParticipationAnalysis> {
    const report = await this.prisma.analyzerReport.upsert({
      where: { userId_noticeId: { userId, noticeId } },
      create: { userId, noticeId },
      update: {},
    });

    const documentReadiness = await this.loadDocumentReadiness(noticeId);

    if (report.requisitosParticipacao && !force) {
      const cached = this.readCachedAnalysis(report.requisitosParticipacao);
      if (cached && this.canReuseCachedAnalysis(cached, documentReadiness)) {
        return cached;
      }
    }

    const edital = await this.loadEdital(noticeId);
    const arquivos = await this.loadArquivos(edital);
    const { hasSearchableChunks, chunksCount } = documentReadiness;

    if (!hasSearchableChunks && arquivos.length > 0) {
      void this.documentProcessorService.processNoticeDocuments(noticeId).catch((error) => {
        this.logger.warn(`Processamento documental em background falhou para ${noticeId}: ${error}`);
      });
    }

    const semanticChunks = hasSearchableChunks
      ? await this.loadParticipationChunks(noticeId)
      : [];
    const relevantChunks =
      semanticChunks.length > 0
        ? semanticChunks
        : chunksCount > 0
          ? await this.loadFallbackChunks(noticeId)
          : [];
    const documentTextsCount = groupChunksByDocument(relevantChunks).length;

    const activeArquivos = arquivos.filter((arquivo) => arquivo.statusAtivo);
    const documentCatalog = activeArquivos.map((arquivo) => ({
      sourceDocument: arquivo.titulo || `Documento ${arquivo.sequencialDocumento}`,
      documentType: arquivo.tipoDocumentoNome ?? null,
      documentUrl: this.buildArquivoUrl(
        edital.cnpjOrgao,
        edital.anoCompra,
        edital.sequencialCompra,
        arquivo.sequencialDocumento,
      ),
    }));

    const prompt = this.buildPrompt({
      edital,
      documentCatalog,
      relevantChunks,
    });

    let structuredData: ParticipationRequirementsResult;
    try {
      const rawResponse = await this.generateWithOllama(prompt);
      structuredData = parseParticipationRequirementsResult(rawResponse);
    } catch (error) {
      if (error instanceof GatewayTimeoutException || error instanceof BadGatewayException) {
        throw error;
      }

      this.logger.error(`Falha ao interpretar requisitos de participacao: ${error}`);
      throw new BadGatewayException(
        'Nao foi possivel extrair os requisitos de participacao em formato valido. Tente novamente.',
      );
    }

    const documentUrlByName = new Map(
      documentCatalog
        .filter((document) => Boolean(document.documentUrl))
        .map((document) => [document.sourceDocument, document.documentUrl as string]),
    );
    const citations = buildParticipationRequirementsCitations(structuredData, documentUrlByName);

    const sectionResult: AnalyzerSectionResult = {
      content: buildParticipationRequirementsChatAnswer(structuredData),
      generatedAt: new Date().toISOString(),
      confidence: buildConfidence(structuredData, hasSearchableChunks),
      metadata: {
        structuredData,
        citations,
        hasProcessedChunks: hasSearchableChunks,
        documentTextsCount,
      },
    };

    await this.prisma.analyzerReport.update({
      where: { userId_noticeId: { userId, noticeId } },
      data: { requisitosParticipacao: sectionResult as unknown as Prisma.InputJsonValue },
    });

    return {
      sectionResult,
      structuredData,
      citations,
      hasProcessedChunks: hasSearchableChunks,
      documentTextsCount,
    };
  }

  private readCachedAnalysis(value: unknown): ParticipationAnalysis | null {
    const record = asRecord(value);
    const content = readString(record.content);
    const generatedAt = readString(record.generatedAt);
    const confidence = readConfidence(record.confidence);
    const metadata = asRecord(record.metadata);
    const structuredData = coerceParticipationRequirementsResult(metadata.structuredData);
    const citations = Array.isArray(metadata.citations)
      ? metadata.citations.filter(isCitation)
      : [];
    const documentTextsCount = readNumber(metadata.documentTextsCount) ?? 0;

    if (!content || !generatedAt || !confidence || !structuredData) {
      return null;
    }

    return {
      sectionResult: {
        content,
        generatedAt,
        confidence,
        metadata: {
          structuredData,
          citations,
          hasProcessedChunks: metadata.hasProcessedChunks === true,
          documentTextsCount,
        },
      },
      structuredData,
      citations,
      hasProcessedChunks: metadata.hasProcessedChunks === true,
      documentTextsCount,
    };
  }

  private async loadEdital(noticeId: string) {
    try {
      return await this.prisma.pncpEdital.findUniqueOrThrow({ where: { id: noticeId } });
    } catch (error) {
      this.logger.warn(`Edital ${noticeId} nao encontrado para requisitos de participacao: ${error}`);
      throw new NotFoundException('Edital nao encontrado.');
    }
  }

  private async loadArquivos(
    edital: Awaited<ReturnType<ParticipationRequirementsService['loadEdital']>>,
  ) {
    if (!edital.cnpjOrgao || !edital.anoCompra || !edital.sequencialCompra) {
      return [];
    }

    try {
      return await this.pncpConsultaService.getArquivos({
        cnpjOrgao: edital.cnpjOrgao,
        anoCompra: edital.anoCompra,
        sequencialCompra: edital.sequencialCompra,
      });
    } catch (error) {
      this.logger.warn(`Nao foi possivel carregar arquivos do PNCP: ${error}`);
      return [];
    }
  }

  private async loadDocumentReadiness(noticeId: string): Promise<DocumentReadiness> {
    const [chunksCount, embeddingsCount] = await Promise.all([
      this.prisma.noticeChunk.count({ where: { noticeId } }),
      this.prisma.noticeEmbedding.count({ where: { noticeId } }),
    ]);

    return {
      chunksCount,
      embeddingsCount,
      hasSearchableChunks: chunksCount > 0 && embeddingsCount > 0,
    };
  }

  private async loadParticipationChunks(noticeId: string): Promise<RelevantChunk[]> {
    const merged = new Map<string, RelevantChunk>();

    for (const query of PARTICIPATION_SEARCH_QUERIES) {
      try {
        const embedding = await this.embeddingService.generateEmbedding(query);
        const results = await this.embeddingService.searchSimilarChunks(
          noticeId,
          embedding,
          PARTICIPATION_QUERY_TOP_K,
        );

        for (const result of results) {
          const existing = merged.get(result.chunkId);
          if (!existing || result.similarity > existing.similarity) {
            merged.set(result.chunkId, result);
          }
        }
      } catch (error) {
        this.logger.warn(`Falha ao buscar chunks tematicos de participacao: ${error}`);
      }
    }

    return [...merged.values()]
      .sort((left, right) => right.similarity - left.similarity)
      .slice(0, MAX_DOCUMENTS_IN_PROMPT * MAX_CHUNKS_PER_DOCUMENT);
  }

  private async loadFallbackChunks(noticeId: string): Promise<RelevantChunk[]> {
    const chunks = await this.prisma.noticeChunk.findMany({
      where: { noticeId },
      orderBy: [
        { sourceDocumentName: 'asc' },
        { chunkIndex: 'asc' },
      ],
      take: MAX_DOCUMENTS_IN_PROMPT * MAX_CHUNKS_PER_DOCUMENT,
      select: {
        id: true,
        content: true,
        chunkIndex: true,
        attachmentId: true,
        sourceDocumentName: true,
        sourceDocumentType: true,
        sourceDocumentKey: true,
        sourceDocumentUrl: true,
      },
    });

    return chunks.map((chunk) => ({
      chunkId: chunk.id,
      content: chunk.content,
      chunkIndex: chunk.chunkIndex,
      attachmentId: chunk.attachmentId,
      sourceDocumentName: chunk.sourceDocumentName,
      sourceDocumentType: chunk.sourceDocumentType,
      sourceDocumentKey: chunk.sourceDocumentKey,
      sourceDocumentUrl: chunk.sourceDocumentUrl,
      similarity: 0,
    }));
  }

  private canReuseCachedAnalysis(
    cached: ParticipationAnalysis,
    documentReadiness: DocumentReadiness,
  ): boolean {
    if (cached.hasProcessedChunks !== documentReadiness.hasSearchableChunks) {
      return false;
    }

    const hasNoFindings =
      cached.structuredData.explicitRequirements.length === 0 &&
      cached.structuredData.possibleInferences.length === 0;

    if (hasNoFindings && cached.documentTextsCount === 0 && documentReadiness.chunksCount > 0) {
      return false;
    }

    return true;
  }

  private buildPrompt(input: {
    edital: Awaited<ReturnType<ParticipationRequirementsService['loadEdital']>>;
    documentCatalog: { sourceDocument: string; documentType: string | null; documentUrl: string | null }[];
    relevantChunks: RelevantChunk[];
  }): string {
    const { edital, documentCatalog, relevantChunks } = input;
    const groupedChunks = groupChunksByDocument(relevantChunks);

    const promptInput = {
      edital_structured: {
        pncp_id: edital.pncpId,
        numero_controle_pncp: edital.numeroControlePncp,
        objeto_compra: edital.objetoCompra,
        orgao: edital.nomeOrgao ?? edital.cnpjOrgao,
        modalidade: edital.modalidadeNome ?? edital.codigoModalidade,
        situacao: edital.situacaoNome ?? edital.status ?? null,
        municipio: edital.municipioNome,
        uf: edital.uf,
        valor_estimado: edital.valorTotalEstimado ? Number(edital.valorTotalEstimado) : null,
        data_abertura_proposta: edital.dataAberturaProposta?.toISOString() ?? null,
        data_encerramento_proposta: edital.dataEncerramentoProposta?.toISOString() ?? null,
        informacao_complementar: edital.informacaoComplementar,
        justificativa: edital.justificativa,
      },
      document_catalog: documentCatalog.map((document) => ({
        source_document: document.sourceDocument,
        document_type: document.documentType,
      })),
      document_texts: groupedChunks.map((document) => ({
        source_document: document.sourceDocument,
        content: document.content,
      })),
    };

    return [
      '[SISTEMA]',
      'Voce e um analista especializado em licitacoes publicas brasileiras.',
      'Siga a skill abaixo com rigor e retorne somente JSON valido.',
      '',
      '[SKILL]',
      getParticipationRequirementsSkillInstructions(),
      '',
      '[TASK]',
      'Extrair somente requisitos de participacao e habilitacao com base no edital estruturado e nos trechos documentais fornecidos.',
      '',
      '[INPUT]',
      JSON.stringify(promptInput, null, 2),
      '',
      '[OUTPUT]',
      'Retorne somente o objeto JSON final.',
    ].join('\n');
  }

  private async generateWithOllama(prompt: string): Promise<string> {
    try {
      const response = await fetchWithTimeout(
        `${this.ollamaBaseUrl}/api/generate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.generationModel,
            prompt,
            stream: false,
          }),
        },
        GENERATION_TIMEOUT_MS,
      );

      if (!response.ok) {
        this.logger.error(`Ollama generation failed with status ${response.status}.`);
        throw new BadGatewayException('Nao foi possivel extrair os requisitos de participacao.');
      }

      const data = await response.json() as { response?: string };
      if (typeof data.response === 'string' && data.response.trim()) {
        return data.response.trim();
      }

      throw new BadGatewayException('A IA retornou uma resposta vazia ao extrair os requisitos.');
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }

      if (isAbortError(error)) {
        this.logger.error(`Ollama generation timed out after ${GENERATION_TIMEOUT_MS}ms.`);
        throw new GatewayTimeoutException(
          'A IA demorou mais do que o esperado para extrair os requisitos de participacao.',
        );
      }

      this.logger.error(`Ollama generation failed: ${error}`);
      throw new BadGatewayException('Nao foi possivel extrair os requisitos de participacao.');
    }
  }

  private buildArquivoUrl(
    cnpjOrgao: string | null,
    anoCompra: number | null,
    sequencialCompra: number | null,
    sequencialDocumento: number,
  ): string | null {
    if (!cnpjOrgao || !anoCompra || !sequencialCompra) {
      return null;
    }

    return `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpjOrgao}/compras/${anoCompra}/${sequencialCompra}/arquivos/${sequencialDocumento}`;
  }
}

function groupChunksByDocument(chunks: RelevantChunk[]) {
  const grouped = new Map<string, RelevantChunk[]>();

  for (const chunk of chunks) {
    const documentName = chunk.sourceDocumentName ?? 'Documento sem identificacao';
    const items = grouped.get(documentName) ?? [];
    items.push(chunk);
    grouped.set(documentName, items);
  }

  return [...grouped.entries()]
    .slice(0, MAX_DOCUMENTS_IN_PROMPT)
    .map(([sourceDocument, items]) => {
      const selectedItems = items
        .sort((left, right) => right.similarity - left.similarity)
        .slice(0, MAX_CHUNKS_PER_DOCUMENT)
        .sort((left, right) => left.chunkIndex - right.chunkIndex);

      return {
        sourceDocument,
        content: selectedItems.map((item) => item.content.trim()).join('\n\n---\n\n'),
      };
    });
}

function buildConfidence(
  result: ParticipationRequirementsResult,
  hasProcessedChunks: boolean,
): AnalyzerSectionResult['confidence'] {
  if (result.explicitRequirements.length >= 2 && hasProcessedChunks) {
    return 'high';
  }

  if (result.explicitRequirements.length >= 1 || result.possibleInferences.length >= 1) {
    return hasProcessedChunks ? 'medium' : 'low';
  }

  return 'low';
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function readConfidence(value: unknown): AnalyzerSectionResult['confidence'] | null {
  switch (value) {
    case 'high':
    case 'medium':
    case 'low':
      return value;
    default:
      return null;
  }
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : null;
}

function isCitation(value: unknown): value is AICitation {
  const record = asRecord(value);
  return typeof record.title === 'string' && typeof record.excerpt === 'string';
}
