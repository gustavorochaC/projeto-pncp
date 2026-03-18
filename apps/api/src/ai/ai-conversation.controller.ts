import { Controller, Delete, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { AIConversationService } from './ai-conversation.service';

@Controller('api/ai/conversations')
export class AIConversationController {
  constructor(private readonly aiConversationService: AIConversationService) {}

  @Get()
  getConversations(@Query('noticeId', new ParseUUIDPipe({ version: '4' })) noticeId: string) {
    return this.aiConversationService.getConversations(noticeId);
  }

  @Get(':id/messages')
  getMessages(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.aiConversationService.getMessages(id);
  }

  @Delete(':id')
  deleteConversation(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.aiConversationService.deleteConversation(id);
  }
}
