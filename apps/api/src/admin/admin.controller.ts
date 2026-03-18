import { Body, Controller, Get, Post } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { PncpSyncService } from "../sources/pncp-sync.service";
import { PncpRevalidateDto } from "./dto/pncp-revalidate.dto";
import { PncpSyncDto } from "./dto/pncp-sync.dto";

@Controller("api/admin")
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pncpSyncService: PncpSyncService
  ) {}

  @Post("pncp-sync")
  runPncpSync(@Body() payload: PncpSyncDto) {
    return this.pncpSyncService.syncActiveProposals({
      finalDate: payload.finalDate,
      maxPages: payload.maxPages,
      pageSize: payload.pageSize,
      reason: "manual"
    });
  }

  @Post("pncp-revalidate")
  runPncpRevalidation(@Body() payload: PncpRevalidateDto) {
    return this.pncpSyncService.revalidateLegacyPublicationStatus(payload.limit);
  }

  @Get("sync-logs")
  async getSyncLogs() {
    return this.prisma.noticeSyncLog.findMany({
      where: {
        source: {
          key: "pncp"
        }
      },
      orderBy: {
        startedAt: "desc"
      },
      take: 20
    });
  }
}
