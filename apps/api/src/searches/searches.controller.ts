import { Body, Controller, Get, Post } from "@nestjs/common";
import type { SavedSearchPayload } from "@pncp/types";

@Controller("api/searches")
export class SearchesController {
  @Post("save")
  saveSearch(@Body() payload: SavedSearchPayload) {
    return {
      ok: true,
      message: "Saved search scaffolded",
      payload
    };
  }

  @Get("saved")
  getSavedSearches() {
    return [];
  }
}
