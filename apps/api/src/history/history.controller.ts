import { Controller, Get } from "@nestjs/common";

@Controller("api/history")
export class HistoryController {
  @Get()
  getHistory() {
    return [];
  }
}
