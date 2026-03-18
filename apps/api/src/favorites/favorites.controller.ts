import { Controller, Delete, Param, Post } from "@nestjs/common";

@Controller("api/favorites")
export class FavoritesController {
  @Post(":id")
  favorite(@Param("id") id: string) {
    return { ok: true, id };
  }

  @Delete(":id")
  unfavorite(@Param("id") id: string) {
    return { ok: true, id };
  }
}
