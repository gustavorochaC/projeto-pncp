import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { AnalyzerReportResponse, GenerateSectionRequest } from '@pncp/types';
import { AnalyzerService } from './analyzer.service';

@Controller('api/analyzer')
export class AnalyzerController {
  constructor(private readonly analyzerService: AnalyzerService) {}

  @Get(':noticeId')
  async getReport(@Param('noticeId') noticeId: string): Promise<AnalyzerReportResponse | null> {
    const userId = '00000000-0000-0000-0000-000000000001';
    const report = await this.analyzerService.getReport(userId, noticeId);

    if (!report) {
      return null;
    }

    return {
      id: report.id,
      noticeId: report.noticeId,
      resumo: report.resumo as AnalyzerReportResponse['resumo'],
      riscos: report.riscos as AnalyzerReportResponse['riscos'],
      precos: report.precos as AnalyzerReportResponse['precos'],
      documentos: report.documentos as AnalyzerReportResponse['documentos'],
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
    };
  }

  @Post(':noticeId/resumo')
  async generateResumo(
    @Param('noticeId') noticeId: string,
    @Body() body: GenerateSectionRequest,
  ) {
    return this.analyzerService.generateResumo(noticeId, body.userId ?? '', body.force);
  }

  @Post(':noticeId/riscos')
  async generateRiscos(
    @Param('noticeId') noticeId: string,
    @Body() body: GenerateSectionRequest,
  ) {
    return this.analyzerService.generateRiscos(noticeId, body.userId ?? '', body.force);
  }

  @Post(':noticeId/precos')
  async generatePrecos(
    @Param('noticeId') noticeId: string,
    @Body() body: GenerateSectionRequest,
  ) {
    return this.analyzerService.generatePrecos(noticeId, body.userId ?? '', body.force);
  }

  @Post(':noticeId/documentos')
  async generateDocumentos(
    @Param('noticeId') noticeId: string,
    @Body() body: GenerateSectionRequest,
  ) {
    return this.analyzerService.generateDocumentos(noticeId, body.userId ?? '', body.force);
  }
}
