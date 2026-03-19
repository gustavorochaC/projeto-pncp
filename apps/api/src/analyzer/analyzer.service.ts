import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { AnalyzerSectionResult } from '@pncp/types';
import { PrismaService } from '../common/prisma.service';
import { EmbeddingService } from '../ai/rag/embedding.service';
import { DocumentProcessorService } from '../ai/rag/document-processor.service';
import { ParticipationRequirementsService } from '../ai/participation-requirements.service';
import { PncpConsultaService } from '../sources/pncp-consulta.service';
import { fetchWithTimeout, isAbortError } from '../ai/ai-request.util';

const GENERATION_TIMEOUT_MS = Number(process.env.OLLAMA_ANALYZER_TIMEOUT_MS ?? process.env.OLLAMA_GENERATION_TIMEOUT_MS ?? 120_000);
const PLACEHOLDER_USER_ID = '00000000-0000-0000-0000-000000000001';

@Injectable()
export class AnalyzerService {
  private readonly logger = new Logger(AnalyzerService.name);
  private readonly ollamaBaseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
  private readonly generationModel = process.env.OLLAMA_GENERATION_MODEL ?? 'qwen2.5:7b';

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: EmbeddingService,
    private readonly documentProcessorService: DocumentProcessorService,
    private readonly pncpConsultaService: PncpConsultaService,
    private readonly participationRequirementsService: ParticipationRequirementsService,
  ) {}

  async getOrCreateReport(userId: string, noticeId: string) {
    return this.prisma.analyzerReport.upsert({
      where: { userId_noticeId: { userId, noticeId } },
      create: { userId, noticeId },
      update: {},
    });
  }

  async getReport(userId: string, noticeId: string) {
    return this.prisma.analyzerReport.findUnique({
      where: { userId_noticeId: { userId, noticeId } },
    });
  }

  async generateResumo(noticeId: string, userId: string, force = false): Promise<AnalyzerSectionResult> {
    const resolvedUserId = await this.resolveUserId(userId);
    const report = await this.getOrCreateReport(resolvedUserId, noticeId);

    if (report.resumo && !force) {
      return report.resumo as unknown as AnalyzerSectionResult;
    }

    const edital = await this.loadEdital(noticeId);
    const editalContext = this.buildEditalContext(edital);

    const prompt = [
      '[SISTEMA]',
      'Voce e um analista especializado em licitacoes publicas brasileiras.',
      'Gere um resumo executivo conciso desta licitacao.',
      '',
      '[INSTRUCAO]',
      'Inclua obrigatoriamente: objeto da contratacao, orgao responsavel,',
      'modalidade, valores estimados, datas criticas (abertura, encerramento),',
      'situacao atual. Formate com bullet points claros.',
      '',
      '[CONTEXTO DO EDITAL]',
      editalContext,
    ].join('\n');

    const content = await this.generateWithOllama(prompt);
    const result: AnalyzerSectionResult = {
      content,
      generatedAt: new Date().toISOString(),
      confidence: 'medium',
    };

    await this.prisma.analyzerReport.update({
      where: { userId_noticeId: { userId: resolvedUserId, noticeId } },
      data: { resumo: result as object },
    });

    return result;
  }

  async generateRiscos(noticeId: string, userId: string, force = false): Promise<AnalyzerSectionResult> {
    const resolvedUserId = await this.resolveUserId(userId);
    const report = await this.getOrCreateReport(resolvedUserId, noticeId);

    if (report.riscos && !force) {
      return report.riscos as unknown as AnalyzerSectionResult;
    }

    const edital = await this.loadEdital(noticeId);
    const editalContext = this.buildEditalContext(edital);

    const hasChunks = await this.hasProcessedChunks(noticeId);
    const ragChunks = hasChunks
      ? await this.loadRelevantChunks(noticeId, 'riscos clausulas habilitacao prazo obrigacoes')
      : [];

    const promptParts = [
      '[SISTEMA]',
      'Voce e um analista especializado em licitacoes publicas brasileiras.',
      '',
      '[INSTRUCAO]',
      'Identifique riscos e pontos de atencao nesta licitacao. Analise:',
      '- Clausulas restritivas ou incomuns',
      '- Prazos criticos e possiveis problemas de cumprimento',
      '- Requisitos de habilitacao (tecnica, economica, juridica)',
      '- Condicoes que podem limitar a competitividade',
      '- Obrigacoes pos-contratuais relevantes',
      'Classifique cada risco como ALTO, MEDIO ou BAIXO.',
      '',
      '[CONTEXTO DO EDITAL]',
      editalContext,
    ];

    if (ragChunks.length > 0) {
      promptParts.push('', '[TRECHOS DOS DOCUMENTOS]');
      ragChunks.forEach((chunk, i) => {
        promptParts.push(`--- Trecho ${i + 1} (relevancia: ${chunk.similarity.toFixed(2)}) ---`);
        promptParts.push(chunk.content);
      });
    }

    const content = await this.generateWithOllama(promptParts.join('\n'));
    const result: AnalyzerSectionResult = {
      content,
      generatedAt: new Date().toISOString(),
      confidence: ragChunks.length > 0 ? 'high' : 'medium',
    };

    await this.prisma.analyzerReport.update({
      where: { userId_noticeId: { userId: resolvedUserId, noticeId } },
      data: { riscos: result as object },
    });

    return result;
  }

  async generatePrecos(noticeId: string, userId: string, force = false): Promise<AnalyzerSectionResult> {
    const resolvedUserId = await this.resolveUserId(userId);
    const report = await this.getOrCreateReport(resolvedUserId, noticeId);

    if (report.precos && !force) {
      return report.precos as unknown as AnalyzerSectionResult;
    }

    const edital = await this.loadEdital(noticeId);
    const editalContext = this.buildEditalContext(edital);

    let itens: Awaited<ReturnType<PncpConsultaService['getItens']>> = [];
    if (edital.cnpjOrgao && edital.anoCompra && edital.sequencialCompra) {
      try {
        itens = await this.pncpConsultaService.getItens({
          cnpjOrgao: edital.cnpjOrgao,
          anoCompra: edital.anoCompra,
          sequencialCompra: edital.sequencialCompra,
        });
      } catch (err) {
        this.logger.warn(`Nao foi possivel carregar itens do PNCP: ${err}`);
      }
    }

    const itensFormatted = itens.length > 0
      ? itens.map(item =>
          `Item ${item.numeroItem}: ${item.descricao} | Qtd: ${item.quantidade ?? '-'} ${item.unidadeMedida ?? ''} | Valor unit.: R$ ${item.valorUnitarioEstimado?.toLocaleString('pt-BR') ?? '-'} | Total: R$ ${item.valorTotal?.toLocaleString('pt-BR') ?? '-'} | Situacao: ${item.situacaoCompraItemNome ?? '-'}`
        ).join('\n')
      : 'Nenhum item disponivel via API.';

    const prompt = [
      '[SISTEMA]',
      'Voce e um analista especializado em licitacoes publicas brasileiras.',
      '',
      '[INSTRUCAO]',
      'Analise os itens e precos desta licitacao. Para cada item relevante:',
      '- Descricao e quantidade',
      '- Valor unitario estimado e valor total',
      '- Criterio de julgamento',
      '- Situacao do item',
      'Destaque itens com valores significativos e analise a razoabilidade dos precos estimados.',
      '',
      '[CONTEXTO DO EDITAL]',
      editalContext,
      '',
      '[ITENS DA LICITACAO]',
      itensFormatted,
    ].join('\n');

    const content = await this.generateWithOllama(prompt);
    const result: AnalyzerSectionResult = {
      content,
      generatedAt: new Date().toISOString(),
      confidence: itens.length > 0 ? 'high' : 'low',
      metadata: { itens: itens as unknown[] },
    };

    await this.prisma.analyzerReport.update({
      where: { userId_noticeId: { userId: resolvedUserId, noticeId } },
      data: { precos: result as object },
    });

    return result;
  }

  async generateDocumentos(noticeId: string, userId: string, force = false): Promise<AnalyzerSectionResult> {
    const resolvedUserId = await this.resolveUserId(userId);
    const report = await this.getOrCreateReport(resolvedUserId, noticeId);

    if (report.documentos && !force) {
      return report.documentos as unknown as AnalyzerSectionResult;
    }

    const edital = await this.loadEdital(noticeId);

    let arquivos: Awaited<ReturnType<PncpConsultaService['getArquivos']>> = [];
    if (edital.cnpjOrgao && edital.anoCompra && edital.sequencialCompra) {
      try {
        arquivos = await this.pncpConsultaService.getArquivos({
          cnpjOrgao: edital.cnpjOrgao,
          anoCompra: edital.anoCompra,
          sequencialCompra: edital.sequencialCompra,
        });
      } catch (err) {
        this.logger.warn(`Nao foi possivel carregar arquivos do PNCP: ${err}`);
      }
    }

    const hasChunks = await this.hasProcessedChunks(noticeId);

    if (!hasChunks && arquivos.length > 0) {
      // Trigger processing in background
      void this.documentProcessorService.processNoticeDocuments(noticeId).catch((err) => {
        this.logger.warn(`Processamento de documentos em background falhou: ${err}`);
      });
    }

    const arquivosFormatted = arquivos.length > 0
      ? arquivos.map(a => `- ${a.titulo} (${a.tipoDocumentoNome}) [seq: ${a.sequencialDocumento}]`).join('\n')
      : 'Nenhum arquivo disponivel via API.';

    let promptParts: string[];

    if (hasChunks) {
      const ragChunks = await this.loadRelevantChunks(noticeId, 'documentos edital anexos clausulas');
      promptParts = [
        '[SISTEMA]',
        'Voce e um analista especializado em licitacoes publicas brasileiras.',
        '',
        '[INSTRUCAO]',
        'Para cada documento listado, faca um resumo do conteudo principal em 2-3 frases.',
        '',
        '[LISTA DE ARQUIVOS]',
        arquivosFormatted,
        '',
        '[TRECHOS DOS DOCUMENTOS]',
        ...ragChunks.map((chunk, i) => [
          `--- Trecho ${i + 1} ---`,
          chunk.content,
        ]).flat(),
      ];
    } else {
      promptParts = [
        '[SISTEMA]',
        'Voce e um analista especializado em licitacoes publicas brasileiras.',
        '',
        '[INSTRUCAO]',
        'Liste e descreva brevemente os documentos disponíveis nesta licitacao com base nas informacoes fornecidas.',
        'Nota: Os documentos ainda nao foram processados para analise completa. O processamento foi iniciado em background.',
        '',
        '[LISTA DE ARQUIVOS]',
        arquivosFormatted,
      ];
    }

    const content = await this.generateWithOllama(promptParts.join('\n'));
    const result: AnalyzerSectionResult = {
      content,
      generatedAt: new Date().toISOString(),
      confidence: hasChunks ? 'high' : 'low',
      metadata: { arquivos: arquivos as unknown[] },
    };

    await this.prisma.analyzerReport.update({
      where: { userId_noticeId: { userId: resolvedUserId, noticeId } },
      data: { documentos: result as object },
    });

    return result;
  }

  async generateRequisitosParticipacao(
    noticeId: string,
    userId: string,
    force = false,
  ): Promise<AnalyzerSectionResult> {
    const resolvedUserId = await this.resolveUserId(userId);
    const analysis = await this.participationRequirementsService.getOrGenerateAnalysis(
      noticeId,
      resolvedUserId,
      force,
    );

    return analysis.sectionResult;
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
        throw new BadGatewayException('Nao foi possivel obter resposta do modelo de IA.');
      }

      const data = await response.json() as { response?: string };
      if (typeof data.response === 'string' && data.response.trim()) {
        return data.response.trim();
      }

      throw new BadGatewayException('A IA retornou uma resposta vazia.');
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }

      if (isAbortError(error)) {
        this.logger.error(`Ollama generation timed out after ${GENERATION_TIMEOUT_MS}ms.`);
        throw new GatewayTimeoutException('A IA demorou mais do que o esperado para responder. Tente novamente.');
      }

      this.logger.error(`Ollama generation failed: ${error}`);
      throw new BadGatewayException('Nao foi possivel obter resposta do modelo de IA.');
    }
  }

  private buildEditalContext(edital: Awaited<ReturnType<typeof this.loadEdital>>): string {
    const parts: string[] = [];
    parts.push(`Objeto: ${edital.objetoCompra ?? 'nao informado'}`);
    parts.push(`Orgao: ${edital.nomeOrgao ?? edital.cnpjOrgao}`);
    parts.push(`Modalidade: ${edital.modalidadeNome ?? edital.codigoModalidade}`);
    parts.push(`Situacao: ${edital.situacaoNome ?? edital.status ?? 'nao informada'}`);
    parts.push(`Municipio: ${edital.municipioNome ?? 'nao informado'}${edital.uf ? ` - ${edital.uf}` : ''}`);
    parts.push(`Numero PNCP: ${edital.numeroControlePncp ?? edital.pncpId}`);
    if (edital.valorTotalEstimado) {
      parts.push(`Valor estimado: R$ ${Number(edital.valorTotalEstimado).toLocaleString('pt-BR')}`);
    }
    if (edital.dataAberturaProposta) {
      parts.push(`Abertura de proposta: ${edital.dataAberturaProposta.toISOString()}`);
    }
    if (edital.dataEncerramentoProposta) {
      parts.push(`Prazo final: ${edital.dataEncerramentoProposta.toISOString()}`);
    }
    if (edital.informacaoComplementar) {
      parts.push(`Informacao complementar: ${edital.informacaoComplementar}`);
    }
    if (edital.justificativa) {
      parts.push(`Justificativa: ${edital.justificativa}`);
    }
    return parts.join('\n');
  }

  private async loadEdital(noticeId: string) {
    const edital = await this.prisma.pncpEdital.findUnique({ where: { id: noticeId } });
    if (!edital) {
      throw new NotFoundException(`Edital ${noticeId} nao encontrado.`);
    }
    return edital;
  }

  private async hasProcessedChunks(noticeId: string): Promise<boolean> {
    const count = await this.prisma.noticeChunk.count({ where: { noticeId } });
    return count > 0;
  }

  private async loadRelevantChunks(noticeId: string, query: string) {
    try {
      const queryEmbedding = await this.embeddingService.generateEmbedding(query);
      return this.embeddingService.searchSimilarChunks(noticeId, queryEmbedding, 5);
    } catch {
      return [];
    }
  }

  private async resolveUserId(userId?: string): Promise<string> {
    if (!userId) return PLACEHOLDER_USER_ID;
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    return user ? userId : PLACEHOLDER_USER_ID;
  }
}
