# Favorites Feature Design

**Date:** 2026-03-19
**Status:** Approved

## Overview

Allow users to favorite (star) PNCP editais from the notice card list. Favorited editais appear in the `/favorites` page. State persists per-user in the database via a new `PncpEditalFavorite` model.

## Schema

New Prisma model `PncpEditalFavorite`:

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

`User` and `PncpEdital` models gain the inverse relation `pncpEditalFavorites PncpEditalFavorite[]`.

A Supabase migration file is created at `infra/supabase/migrations/20260319_pncp_edital_favorites.sql`.

## Backend

### Auth

Both new endpoints require authentication. The Supabase JWT is extracted from the `Authorization` header by a NestJS guard. The resolved `userId` is passed down to the service.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/notices/:id/favorite` | Toggle favorite state for a notice. Returns `{ isFavorited: boolean }`. |
| `GET` | `/api/favorites` | List favorited notices for the current user. Accepts `page` and `pageSize` query params. Returns `PaginatedResponse<NoticeListItem>`. |

**Toggle logic (`toggleFavorite`):**
Attempt `upsert` → if it already exists, delete it and return `{ isFavorited: false }`. If it does not exist, create it and return `{ isFavorited: true }`.

**List logic (`getFavorites`):**
Query `PncpEditalFavorite` for the user, join `PncpEdital`, map rows through the existing `mapPncpEditalRowToNoticeListItem` mapper. Return paginated result with `isFavorited: true` on all items.

### Service method signatures

```ts
toggleFavorite(userId: string, noticeId: string): Promise<{ isFavorited: boolean }>
getFavorites(userId: string, page: number, pageSize: number): Promise<PaginatedResponse<NoticeListItem>>
```

Both methods live in `NoticesService`.

## Shared Types (`packages/types`)

`NoticeListItem` gains an optional field:

```ts
isFavorited?: boolean;
```

This allows the search list to render the correct star state when the server enriches results (future) or when the frontend derives state from a separate favorites query.

## SDK (`packages/sdk`)

Two new methods on `ApiClient`:

```ts
toggleFavorite(noticeId: string): Promise<{ isFavorited: boolean }>
getFavorites(page?: number): Promise<PaginatedResponse<NoticeListItem>>
```

## Frontend

### Hook: `useToggleFavorite`

`apps/web/src/hooks/use-toggle-favorite.ts`

- Uses `useMutation` from React Query
- On success, invalidates `["favorites"]` query key
- Performs optimistic update on the local `isFavorited` state via `onMutate`

### Hook: `useFavorites`

`apps/web/src/hooks/use-favorites.ts`

- Uses `useQuery` with key `["favorites", page]`
- Calls `apiClient.getFavorites(page)`

### `NoticeCard` changes

`apps/web/src/components/notices/notice-card-list.tsx`

- Receives optional `onToggleFavorite?: (id: string) => void` and `isFavorited?: boolean` props
- Renders MUI `IconButton` with `StarIcon` (filled, `warning` color) or `StarBorderIcon` (outlined) in the card footer, left of the status badge
- Button shows a loading spinner while the mutation is in flight
- `NoticeCardList` receives optional `favoritedIds?: Set<string>` and `onToggleFavorite` callback

### Favorites page

`apps/web/src/app/(app)/favorites/page.tsx`

- Replaces placeholder with `useFavorites()` data
- Renders `NoticeCardList` with `favoritedIds` and `onToggleFavorite`
- Shows empty state when no favorites exist
- Shows loading skeleton while fetching

### Dashboard integration

`search-dashboard.tsx` does **not** need changes in this iteration. The star button is rendered by `NoticeCardList` regardless of context; the toggle mutation is self-contained.

## Error Handling

- Toggle: if the request fails, the optimistic update is rolled back via React Query's `onError`
- Favorites list: shows an error alert on failure (same pattern as notice search)

## Out of Scope

- Enriching search results with `isFavorited` state (requires JOIN or second query per page load — deferred)
- Notifications or alerts based on favorited editais
- Sorting/filtering within the favorites list beyond pagination
