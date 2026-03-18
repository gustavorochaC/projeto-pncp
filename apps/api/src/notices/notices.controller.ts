import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { NoticesService } from "./notices.service";
import { NoticeQueryDto } from "./dto/notice-query.dto";
import { AskAIDto } from "./dto/ask-ai.dto";

@ApiTags("notices")
@Controller("api/notices")
export class NoticesController {
  constructor(private readonly noticesService: NoticesService) {}

  @Get()
  search(@Query() query: NoticeQueryDto) {
    return this.noticesService.search(query);
  }

  @Get(":id")
  getDetail(@Param("id") id: string) {
    return this.noticesService.getDetail(id);
  }

  @Get(":id/documents")
  getDocuments(@Param("id") id: string) {
    return this.noticesService.getDocuments(id);
  }

  @Get(":id/itens")
  getItens(@Param("id") id: string) {
    return this.noticesService.getNoticeItems(id);
  }

  @Get(":id/arquivos")
  getArquivos(@Param("id") id: string) {
    return this.noticesService.getNoticeArchives(id);
  }

  @Post(":id/ask-ai")
  askAI(@Param("id") id: string, @Body() payload: AskAIDto) {
    return this.noticesService.askAI(id, payload);
  }

  @Post(":id/process-documents")
  processDocuments(@Param("id") id: string) {
    return this.noticesService.processDocuments(id);
  }

  @Get(":id/processing-status")
  getProcessingStatus(@Param("id") id: string) {
    return this.noticesService.getProcessingStatus(id);
  }
}
