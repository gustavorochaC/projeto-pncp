import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import type { AIConversationSummary, AIMessageItem, AICitation } from '@pncp/types';
import { isUuid } from './ai-request.util';

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
