import { Body, Controller, Post } from "@nestjs/common";
import type { AlertRulePayload } from "@pncp/types";

@Controller("api/alerts")
export class AlertsController {
  @Post()
  createAlert(@Body() payload: AlertRulePayload) {
    return { ok: true, payload };
  }
}
