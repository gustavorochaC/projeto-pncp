# Favorites Feature Design

**Date:** 2026-03-19
**Status:** Approved

## Overview

Allow users to favorite (star) PNCP editais from the notice card list. Favorited editais appear in the `/favorites` page. State persists per-user in the database via a new `PncpEditalFavorite` model.

## Schema

### New model: `PncpEditalFavorite`

```prisma
model PncpEditalFavorite {
  id           String     @id @default(uuid()) @db.Uuid
  userId       String     @map("user_id") @db.Uuid
  pncpEditalId String     @map("pncp_edital_id") @db.Uuid
  createdAt    DateTime   @default(now()) @map("created_at")
  user         User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  edital       PncpEdital @relation(fields: [pncpEditalId], references: [id], onDelete: Cascade)

  @@unique([userId, pncpEditalId])
  @@index([userId, createdAt(sort: Desc)])
  @@map("pncp_edital_favorites")
}
```

### Changes to existing models

`User` gains the back-relation field:
```prisma
pncpEditalFavorites PncpEditalFavorite[]
```

`PncpEdital` gains the back-relation field:
```prisma
favorites PncpEditalFavorite[]
```

Without these additions the Prisma schema is invalid.

### Relationship to existing `FavoriteNotice`

The schema already has a `FavoriteNotice` model referencing the `Notice` model (generic/legacy entity). This feature does **not** use or remove `FavoriteNotice` — it is left in place. `PncpEditalFavorite` is a new, separate model scoped exclusively to `PncpEdital`.

A Supabase migration is created at `infra/supabase/migrations/20260319_pncp_edital_favorites.sql`.

## Backend

### Auth / userId

Following the existing project pattern (same as `AnalyzerController`), `userId` is a hardcoded stub:

```ts
const userId = '00000000-0000-0000-0000-000000000001';
```

A full Supabase Auth guard is out of scope for this feature.

### `app.module.ts`

`FavoritesController` is already registered. Add `FavoritesService` to the `providers` array.

### Controller: `FavoritesController`

The stub at `apps/api/src/favorites/favorites.controller.ts` is replaced in full. The existing `@Post(':id')` and `@Delete(':id')` stubs are both removed. The new contract:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/favorites/:id` | Toggle favorite. Returns `{ isFavorited: boolean }`. |
| `GET` | `/api/favorites` | List favorites for current user. Accepts `page`/`pageSize`. Returns `PaginatedResponse<NoticeListItem>`. |

### Service: `FavoritesService`

New file: `apps/api/src/favorites/favorites.service.ts`. Injected into `FavoritesController`.

```ts
toggleFavorite(userId: string, noticeId: string): Promise<{ isFavorited: boolean }>
getFavorites(userId: string, page: number, pageSize: number): Promise<PaginatedResponse<NoticeListItem>>
```

**`toggleFavorite` — find-then-delete-or-create:**

```ts
const existing = await this.prisma.pncpEditalFavorite.findUnique({
  where: { userId_pncpEditalId: { userId, pncpEditalId: noticeId } }
});
if (existing) {
  await this.prisma.pncpEditalFavorite.delete({ where: { id: existing.id } });
  return { isFavorited: false };
}
await this.prisma.pncpEditalFavorite.create({ data: { userId, pncpEditalId: noticeId } });
return { isFavorited: true };
```

**`getFavorites` — query with select matching `NoticeListRow`:**

```ts
const [rows, total] = await Promise.all([
  this.prisma.pncpEditalFavorite.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: { edital: { select: noticeListSelect } },
  }),
  this.prisma.pncpEditalFavorite.count({ where: { userId } }),
]);

const items = rows.map(fav => ({
  ...mapPncpEditalRowToNoticeListItem(fav.edital as NoticeListRow),
  isFavorited: true,
}));

return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
```

The `select: { edital: { select: noticeListSelect } }` pattern ensures the edital shape matches `NoticeListRow` (the type expected by the existing mapper). The `isFavorited: true` is spread onto each item after mapping — the mapper itself is not modified.

## Shared Types (`packages/types`)

`NoticeListItem` gains:

```ts
isFavorited?: boolean;
```

Note: `NoticeDetail extends NoticeListItem`, so `NoticeDetail` also inherits this field. The notice-detail mapper does not need to populate it — it remains `undefined` unless explicitly set.

## SDK (`packages/sdk`)

Two new methods on `ApiClient`:

```ts
async toggleFavorite(noticeId: string): Promise<{ isFavorited: boolean }>
async getFavorites(page?: number, pageSize?: number): Promise<PaginatedResponse<NoticeListItem>>
```

## Frontend

### Hook: `useToggleFavorite`

`apps/web/src/hooks/use-toggle-favorite.ts`

- `useMutation` calling `apiClient.toggleFavorite(noticeId)`
- `onSuccess`: invalidates `["favorites"]` query key so the favorites page list refreshes

### Hook: `useFavorites`

`apps/web/src/hooks/use-favorites.ts`

- `useQuery` with key `["favorites", { page, pageSize }]`
- Calls `apiClient.getFavorites(page, pageSize)`

### `NoticeCard` optimistic state

`useToggleFavorite` is instantiated **per card** (one hook instance per `NoticeCard`). The hook exposes `mutate`, `isPending`, and `isError`. The card:

1. Holds `useState<boolean>` initialized from the `isFavorited` prop
2. On button click: flip local state immediately, call `mutate(noticeId)`
3. Watches `isError` via `useEffect`: if it becomes `true`, flip local state back

This pattern works because each card owns its mutation instance and can observe `isError` directly — no ref threading or callback indirection needed.

### `NoticeCard` / `NoticeCardList` changes

`apps/web/src/components/notices/notice-card-list.tsx`

- `NoticeCard` receives optional props: `isFavorited?: boolean`, `onToggleFavorite?: (id: string) => void`
- Renders MUI `IconButton` in the card footer (left of status badge):
  - `StarIcon` (filled, `color="warning"`) when favorited
  - `StarBorderIcon` when not favorited
  - `CircularProgress` (size 16) while mutation is in flight
- `NoticeCardList` receives optional `favoritedIds?: Set<string>` and `onToggleFavorite` callback, threading them to each `NoticeCard`

### Favorites page

`apps/web/src/app/(app)/favorites/page.tsx`

- Replaces the current placeholder
- Uses `useFavorites()` + `useToggleFavorite()`
- Renders `NoticeCardList` with `favoritedIds` (all items) and `onToggleFavorite`
- Empty state: MUI centered message "Nenhum favorito salvo ainda."
- Loading state: MUI `Skeleton` repeating 3 times

### Dashboard

`search-dashboard.tsx` does not change in this iteration. When `NoticeCardList` is rendered from the dashboard, `onToggleFavorite` and `favoritedIds` are not passed — the star button is not shown.

## Error Handling

- Toggle failure: local `isPending` resets, star reverts to previous optimistic state
- Favorites list failure: error alert rendered in the favorites page (same pattern as notice search)

## Out of Scope

- Enriching search results with `isFavorited` per-item (requires extra join — deferred)
- Supabase Auth guard for real user identity (deferred — using stub userId)
- Sorting/filtering within favorites beyond pagination
