import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AskAIResponse, AICitation } from '@pncp/types';
import type { AskAIDto } from '../notices/dto/ask-ai.dto';
import { PrismaService } from '../common/prisma.service';
import { fetchWithTimeout, isAbortError, isUuid } from './ai-request.util';
import {
  buildStructuredNoticeAnswer,
  shouldUseStructuredNoticeAnswer,
} from './ai-structured-response.util';
import { ParticipationRequirementsService } from './participation-requirements.service';
import { PARTICIPATION_REQUIREMENTS_MODE } from './participation-requirements.util';
import { EmbeddingService } from './rag/embedding.service';

const PLACEHOLDER_USER_ID = '00000000-0000-0000-0000-000000000001';
const GENERATION_TIMEOUT_MS = Number(process.env.OLLAMA_GENERATION_TIMEOUT_MS ?? 12_000);
const RELEVANT_CHUNK_LIMIT = 5;
type ConversationHistoryItem = {
  role: string;
  content: string;
};

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private readonly ollamaBaseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
  private readonly generationModel = process.env.OLLAMA_GENERATION_MODEL ?? 'qwen2.5:7b';

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: EmbeddingService,
    private readonly participationRequirementsService: ParticipationRequirementsService,
  ) {}

  async answerNoticeQuestion(
    noticeId: string,
    payload: AskAIDto,
  ): Promise<AskAIResponse> {
    const mode = payload.mode ?? 'default';
    const chatUserId = await this.resolveChatUserId(payload.userId);

    if (mode === PARTICIPATION_REQUIREMENTS_MODE) {
      const analysis = await this.participationRequirementsService.getOrGenerateAnalysis(
        noticeId,
        chatUserId,
      );
      const conversationId = await this.persistConversation({
        conversationId: payload.conversationId,
        userId: chatUserId,
        noticeId,
        question: payload.question,
        answer: analysis.sectionResult.content,
        citations: analysis.citations,
        confidence: analysis.sectionResult.confidence,
        structuredData: analysis.structuredData,
      });

      return {
        conversationId,
        answer: analysis.sectionResult.content,
        citations: analysis.citations,
        confidence: analysis.sectionResult.confidence,
        structuredData: analysis.structuredData,
        missingInformation: analysis.hasProcessedChunks
          ? []
          : ['Os documentos ainda nao estavam totalmente processados no momento da analise.'],
      };
    }

    const [edital, hasProcessedChunks] = await Promise.all([
      this.loadEdital(noticeId),
      this.hasProcessedChunks(noticeId),
    ]);

    const shouldUseStructuredAnswer = shouldUseStructuredNoticeAnswer(payload.question);
    let relevantChunks: Awaited<ReturnType<AIService['loadRelevantChunks']>> = [];
    let citations: AICitation[] = [];
    let confidence: 'high' | 'medium' | 'low' = 'medium';
    let answer: string;

    if (shouldUseStructuredAnswer) {
      answer = buildStructuredNoticeAnswer(edital, {
        documentsProcessed: hasProcessedChunks,
        reason: 'summary',
      });
    } else {
      const [trainingRules, conversationHistory] = await Promise.all([
        this.loadTrainingRules(chatUserId),
        this.loadConversationHistory(payload.conversationId),
      ]);

      relevantChunks = hasProcessedChunks
        ? await this.loadRelevantChunks(noticeId, payload.question)
        : [];

      const prompt = this.buildPrompt({
        edital,
        question: payload.question,
        trainingRules,
        conversationHistory,
        relevantChunks,
        hasProcessedChunks,
      });

      try {
        answer = await this.generateAnswer(prompt);
        citations = buildCitations(relevantChunks);
        confidence = relevantChunks.length > 0 ? buildConfidence(relevantChunks) : 'medium';
      } catch (error) {
        if (error instanceof GatewayTimeoutException || error instanceof BadGatewayException) {
          this.logger.warn(`Falling back to structured answer for notice ${noticeId}: ${error.message}`);
          answer = buildStructuredNoticeAnswer(edital, {
            documentsProcessed: hasProcessedChunks,
            reason: error instanceof GatewayTimeoutException ? 'timeout' : 'generation_error',
          });
        } else {
          throw error;
        }
      }
    }

    const conversationId = await this.persistConversation({
      conversationId: payload.conversationId,
      userId: chatUserId,
      noticeId,
      question: payload.question,
      answer,
      citations,
      confidence,
    });

    return {
      conversationId,
      answer,
      citations,
      confidence,
      missingInformation: hasProcessedChunks
        ? []
        : ['A resposta atual usa os dados estruturados do edital enquanto os documentos sao enriquecidos em segundo plano.'],
    };
  }

  private async loadEdital(noticeId: string) {
    try {
      return await this.prisma.pncpEdital.findUniqueOrThrow({ where: { id: noticeId } });
    } catch (error) {
      this.logger.warn(`Edital ${noticeId} nao encontrado para o chat: ${error}`);
      throw new NotFoundException('Edital nao encontrado.');
    }
  }

  private async loadTrainingRules(userId: string): Promise<{ name: string; content: string }[]> {
    try {
      return await this.prisma.aITrainingRule.findMany({
        where: { userId, isActive: true },
        orderBy: { priority: 'asc' },
        select: { name: true, content: true },
      });
    } catch {
      return [];
    }
  }

  private async resolveChatUserId(preferredUserId?: string): Promise<string> {
    if (preferredUserId && isUuid(preferredUserId)) {
      const user = await this.prisma.user.findUnique({
        where: { id: preferredUserId },
        select: { id: true },
      });

      if (user) {
        return user.id;
      }

      this.logger.warn(`Preferred chat user ${preferredUserId} was not found in profiles.`);
    }

    const fallbackUser = await this.prisma.user.findFirst({
      where: {
        id: {
          not: PLACEHOLDER_USER_ID,
        },
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    if (fallbackUser) {
      return fallbackUser.id;
    }

    throw new ServiceUnavailableException('Nao foi possivel identificar um usuario valido para a conversa da IA.');
  }

  private async loadConversationHistory(
    conversationId?: string,
  ): Promise<ConversationHistoryItem[]> {
    if (!conversationId) {
      return [];
    }

    if (!isUuid(conversationId)) {
      this.logger.warn(`Ignoring invalid conversationId on chat request: ${conversationId}`);
      return [];
    }

    return this.prisma.aIMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 10,
      select: { role: true, content: true },
    });
  }

  private async hasProcessedChunks(noticeId: string): Promise<boolean> {
    const count = await this.prisma.noticeEmbedding.count({ where: { noticeId } });
    return count > 0;
  }

  private async loadRelevantChunks(noticeId: string, question: string) {
    try {
      const queryEmbedding = await this.embeddingService.generateEmbedding(question);
      return await this.embeddingService.searchSimilarChunks(
        noticeId,
        queryEmbedding,
        RELEVANT_CHUNK_LIMIT,
      );
    } catch (error) {
      this.logger.warn(`RAG embedding unavailable: ${error}`);
      return [];
    }
  }

  private buildPrompt(input: {
    edital: Awaited<ReturnType<AIService['loadEdital']>>;
    question: string;
    trainingRules: { name: string; content: string }[];
    conversationHistory: ConversationHistoryItem[];
    relevantChunks: Awaited<ReturnType<AIService['loadRelevantChunks']>>;
    hasProcessedChunks: boolean;
  }): string {
    const { edital, question, trainingRules, conversationHistory, relevantChunks, hasProcessedChunks } = input;
    const promptParts: string[] = [
      '[SISTEMA]',
      'Voce e um analista especializado em licitacoes publicas brasileiras.',
      'Responda sempre em portugues do Brasil.',
      'Use apenas as evidencias disponiveis e diga com clareza quando algum detalhe nao estiver presente.',
      'Priorize uma resposta objetiva para ajudar o usuario a entender rapidamente sobre o que trata o edital e o que ele exige.',
    ];

    if (trainingRules.length > 0) {
      promptParts.push('\n[INSTRUCOES DO USUARIO]');
      trainingRules.forEach((rule) => {
        promptParts.push(`- ${rule.content}`);
      });
    }

    promptParts.push('\n[CONTEXTO ESTRUTURADO DO EDITAL]');
    promptParts.push(`Objeto: ${edital.objetoCompra ?? 'nao informado'}`);
    promptParts.push(`Orgao: ${edital.nomeOrgao ?? edital.cnpjOrgao}`);
    promptParts.push(`Modalidade: ${edital.modalidadeNome ?? edital.codigoModalidade}`);
    promptParts.push(`Situacao: ${edital.situacaoNome ?? edital.status ?? 'nao informada'}`);
    promptParts.push(`Municipio: ${edital.municipioNome ?? 'nao informado'}${edital.uf ? ` - ${edital.uf}` : ''}`);
    promptParts.push(`Numero PNCP: ${edital.numeroControlePncp ?? edital.pncpId}`);
    if (edital.valorTotalEstimado) {
      promptParts.push(`Valor estimado: R$ ${Number(edital.valorTotalEstimado).toLocaleString('pt-BR')}`);
    }
    if (edital.dataAberturaProposta) {
      promptParts.push(`Abertura de proposta: ${edital.dataAberturaProposta.toISOString()}`);
    }
    if (edital.dataEncerramentoProposta) {
      promptParts.push(`Prazo final: ${edital.dataEncerramentoProposta.toISOString()}`);
    }
    if (edital.informacaoComplementar) {
      promptParts.push(`Informacao complementar: ${edital.informacaoComplementar}`);
    }
    if (edital.justificativa) {
      promptParts.push(`Justificativa: ${edital.justificativa}`);
    }
    if (edital.linkEdital) {
      promptParts.push(`Link do edital: ${edital.linkEdital}`);
    }
    if (edital.linkSistemaOrigem) {
      promptParts.push(`Link do sistema de origem: ${edital.linkSistemaOrigem}`);
    }

    if (relevantChunks.length > 0) {
      promptParts.push('\n[TRECHOS RELEVANTES DOS DOCUMENTOS]');
      relevantChunks.forEach((chunk, index) => {
        promptParts.push(`--- Trecho ${index + 1} (relevancia: ${chunk.similarity.toFixed(2)}) ---`);
        promptParts.push(chunk.content);
      });
    } else if (!hasProcessedChunks) {
      promptParts.push('\n[STATUS DOCUMENTAL]');
      promptParts.push('Os documentos completos ainda nao foram processados. Responda usando somente os dados estruturados acima e deixe isso claro quando a pergunta exigir leitura integral do edital.');
    }

    if (conversationHistory.length > 0) {
      promptParts.push('\n[HISTORICO DA CONVERSA]');
      conversationHistory.forEach((message) => {
        const role = message.role === 'user' ? 'Usuario' : 'Assistente';
        promptParts.push(`${role}: ${message.content}`);
      });
    }

    promptParts.push('\n[PERGUNTA ATUAL]');
    promptParts.push(`Usuario: ${question}`);

    return promptParts.join('\n');
  }

  private async generateAnswer(prompt: string): Promise<string> {
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

  private async persistConversation(input: {
    conversationId?: string;
    userId: string;
    noticeId: string;
    question: string;
    answer: string;
    citations: AICitation[];
    confidence?: AskAIResponse['confidence'];
    structuredData?: AskAIResponse['structuredData'];
  }): Promise<string> {
    const { noticeId, question, answer, citations, userId, confidence, structuredData } = input;
    let { conversationId } = input;

    try {
      if (!conversationId) {
        const conversation = await this.prisma.aIConversation.create({
          data: {
            userId,
            noticeId,
            title: question.substring(0, 80),
          },
        });
        conversationId = conversation.id;
      }

      await this.prisma.aIMessage.createMany({
        data: [
          { conversationId, role: 'user', content: question },
          {
            conversationId,
            role: 'assistant',
            content: answer,
            citationsJson: citations.length > 0 ? (citations as unknown as Prisma.InputJsonValue) : undefined,
            metadataJson: buildAssistantMetadata(confidence, structuredData),
          },
        ],
      });

      return conversationId;
    } catch (error) {
      this.logger.error(`Failed to persist conversation: ${error}`);
      throw new ServiceUnavailableException('Nao foi possivel salvar a conversa da IA agora. Tente novamente.');
    }
  }
}

function buildConfidence(
  relevantChunks: Awaited<ReturnType<AIService['loadRelevantChunks']>>,
): 'high' | 'medium' | 'low' {
  const highConfidenceChunks = relevantChunks.filter((chunk) => chunk.similarity >= 0.7);
  const mediumConfidenceChunks = relevantChunks.filter((chunk) => chunk.similarity >= 0.5);

  if (highConfidenceChunks.length >= 3) {
    return 'high';
  }
  if (mediumConfidenceChunks.length >= 1) {
    return 'medium';
  }
  return 'low';
}

function buildCitations(
  relevantChunks: Awaited<ReturnType<AIService['loadRelevantChunks']>>,
): AICitation[] {
  return relevantChunks.map((chunk) => ({
    title: chunk.sourceDocumentName ?? 'Trecho do documento',
    excerpt: chunk.content.substring(0, 200) + (chunk.content.length > 200 ? '...' : ''),
    sourceUrl: chunk.sourceDocumentUrl ?? undefined,
    chunkIndex: chunk.chunkIndex,
    similarity: chunk.similarity,
  }));
}

function buildAssistantMetadata(
  confidence?: AskAIResponse['confidence'],
  structuredData?: AskAIResponse['structuredData'],
): Prisma.InputJsonValue | undefined {
  if (!confidence && !structuredData) {
    return undefined;
  }

  const metadata: Record<string, unknown> = {};

  if (confidence) {
    metadata.confidence = confidence;
  }

  if (structuredData) {
    metadata.structuredData = structuredData;
  }

  return metadata as Prisma.InputJsonValue;
}
