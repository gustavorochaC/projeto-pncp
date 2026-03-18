import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { AnalyzerController } from "./analyzer/analyzer.controller";
import { AnalyzerService } from "./analyzer/analyzer.service";
import { AIService } from "./ai/ai.service";
import { AIController } from "./ai/ai.controller";
import { AIConversationController } from "./ai/ai-conversation.controller";
import { AIConversationService } from "./ai/ai-conversation.service";
import { AITrainingController } from "./ai/ai-training.controller";
import { AITrainingService } from "./ai/ai-training.service";
import { EmbeddingService } from "./ai/rag/embedding.service";
import { DocumentProcessorService } from "./ai/rag/document-processor.service";
import { AdminController } from "./admin/admin.controller";
import { AlertsController } from "./alerts/alerts.controller";
import { PrismaService } from "./common/prisma.service";
import { FavoritesController } from "./favorites/favorites.controller";
import { HistoryController } from "./history/history.controller";
import { NoticesController } from "./notices/notices.controller";
import { NoticesService } from "./notices/notices.service";
import { SearchesController } from "./searches/searches.controller";
import { PncpAdapter } from "./sources/pncp.adapter";
import { PncpConsultaService } from "./sources/pncp-consulta.service";
import { PncpSearchService } from "./sources/pncp-search.service";
import { PncpSyncService } from "./sources/pncp-sync.service";

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [
    NoticesController,
    SearchesController,
    FavoritesController,
    AlertsController,
    AdminController,
    AIController,
    AIConversationController,
    AITrainingController,
    HistoryController,
    AnalyzerController,
  ],
  providers: [
    NoticesService,
    PncpAdapter,
    PncpSearchService,
    PncpConsultaService,
    PncpSyncService,
    AIService,
    AIConversationService,
    AITrainingService,
    EmbeddingService,
    DocumentProcessorService,
    PrismaService,
    AnalyzerService,
  ]
})
export class AppModule {}
