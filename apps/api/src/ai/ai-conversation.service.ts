import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import type { AIConversationSummary, AIMessageItem, AICitation } from '@pncp/types';
import { isUuid } from './ai-request.util';
import { coerceParticipationRequirementsResult } from './participation-requirements.util';

@Injectable()
export class AIConversationService {
  constructor(private readonly prisma: PrismaService) {}

  async getConversations(noticeId: string): Promise<AIConversationSummary[]> {
    this.assertUuid(noticeId, 'noticeId');

    const conversations = await this.prisma.aIConversation.findMany({
      where: { noticeId },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { messages: true } } },
    });

    return conversations.map(c => ({
      id: c.id,
      noticeId: c.noticeId,
      title: c.title,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      messageCount: c._count.messages,
    }));
  }

  async getMessages(conversationId: string): Promise<AIMessageItem[]> {
    this.assertUuid(conversationId, 'conversationId');

    const messages = await this.prisma.aIMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });

    return messages.map(m => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content,
      citations: Array.isArray(m.citationsJson) ? (m.citationsJson as unknown as AICitation[]) : [],
      confidence: readConfidenceFromMetadata(m.metadataJson),
      structuredData: readStructuredDataFromMetadata(m.metadataJson),
      createdAt: m.createdAt.toISOString(),
    }));
  }

  async deleteConversation(conversationId: string): Promise<void> {
    this.assertUuid(conversationId, 'conversationId');

    await this.prisma.aIConversation.delete({ where: { id: conversationId } });
  }

  private assertUuid(value: string, field: string): void {
    if (!isUuid(value)) {
      throw new BadRequestException(`${field} must be a valid UUID`);
    }
  }
}

function readConfidenceFromMetadata(value: unknown): AIMessageItem['confidence'] | undefined {
  if (!isObject(value)) {
    return undefined;
  }

  const confidence = value.confidence;
  return confidence === 'high' || confidence === 'medium' || confidence === 'low'
    ? confidence
    : undefined;
}

function readStructuredDataFromMetadata(value: unknown): AIMessageItem['structuredData'] | undefined {
  if (!isObject(value)) {
    return undefined;
  }

  return coerceParticipationRequirementsResult(value.structuredData) ?? undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
