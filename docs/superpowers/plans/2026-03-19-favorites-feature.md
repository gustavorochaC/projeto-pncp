# Favorites Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to star/unstar PNCP editais from the notice card list and view all starred editais in the `/favorites` page.

**Architecture:** New `PncpEditalFavorite` Prisma model stores per-user favorites. A `FavoritesService` (injected into the existing `FavoritesController` stub) exposes a toggle endpoint and a paginated list endpoint. The frontend adds a star `IconButton` to each `NoticeCard` and replaces the `/favorites` placeholder page with a real list.

**Tech Stack:** NestJS 11, Prisma + Supabase PostgreSQL, `@prisma/client`, Vitest (backend tests), Next.js 15 App Router, MUI v6, React Query (`@tanstack/react-query`), TypeScript.

---

## File Map

| Action | File |
|--------|------|
| Modify | `apps/api/prisma/schema.prisma` |
| Create | `infra/supabase/migrations/20260319_pncp_edital_favorites.sql` |
| Create | `apps/api/src/favorites/favorites.service.ts` |
| Create | `apps/api/src/favorites/favorites.service.test.ts` |
| Modify | `apps/api/src/favorites/favorites.controller.ts` |
| Modify | `apps/api/src/app.module.ts` |
| Modify | `packages/types/src/index.ts` |
| Modify | `packages/sdk/src/client.ts` |
| Create | `apps/web/src/hooks/use-toggle-favorite.ts` |
| Create | `apps/web/src/hooks/use-favorites.ts` |
| Modify | `apps/web/src/components/notices/notice-card-list.tsx` |
| Modify | `apps/web/src/app/(app)/favorites/page.tsx` |

---

## Task 1: Update Prisma schema

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add `PncpEditalFavorite` model and back-relations**

In `apps/api/prisma/schema.prisma`, make three edits:

**(a) Add back-relation to `User` model** (after the existing `favoriteNotices FavoriteNotice[]` line):
```prisma
pncpEditalFavorites PncpEditalFavorite[]
```

**(b) Add back-relation to `PncpEdital` model** (after `analyzerReports AnalyzerReport[]`):
```prisma
favorites           PncpEditalFavorite[]
```

**(c) Add the new model** at the end of the file (before the closing):
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

- [ ] **Step 2: Regenerate Prisma client**

```bash
cd apps/api
npm run prisma:generate
```

Expected: `✔ Generated Prisma Client` with no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat: add PncpEditalFavorite schema model"
```

---

## Task 2: Create Supabase migration

**Files:**
- Create: `infra/supabase/migrations/20260319_pncp_edital_favorites.sql`

- [ ] **Step 1: Create the SQL migration file**

```sql
-- Migration: pncp_edital_favorites
-- Creates the pncp_edital_favorites table for per-user favoriting of PNCP editais.

CREATE TABLE IF NOT EXISTS pncp_edital_favorites (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pncp_edital_id UUID NOT NULL REFERENCES pncp_editais(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT pncp_edital_favorites_unique UNIQUE (user_id, pncp_edital_id)
);

CREATE INDEX IF NOT EXISTS pncp_edital_favorites_user_created_idx
  ON pncp_edital_favorites (user_id, created_at DESC);
```

- [ ] **Step 2: Commit**

```bash
git add infra/supabase/migrations/20260319_pncp_edital_favorites.sql
git commit -m "feat: add pncp_edital_favorites migration"
```

---

## Task 3: Write `FavoritesService` (TDD)

**Files:**
- Create: `apps/api/src/favorites/favorites.service.ts`
- Create: `apps/api/src/favorites/favorites.service.test.ts`

The test file instantiates the service with a mocked `PrismaService` — same pattern as `apps/api/src/notices/notices.service.search.test.ts`. Read that file to understand the `vi.fn()` mocking pattern before writing the tests.

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/favorites/favorites.service.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../common/prisma.service";
import { FavoritesService } from "./favorites.service";

const STUB_USER_ID = "00000000-0000-0000-0000-000000000001";
const STUB_NOTICE_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

function buildService(overrides: {
  findUnique?: ReturnType<typeof vi.fn>;
  delete?: ReturnType<typeof vi.fn>;
  create?: ReturnType<typeof vi.fn>;
  findMany?: ReturnType<typeof vi.fn>;
  count?: ReturnType<typeof vi.fn>;
} = {}) {
  const prisma = {
    pncpEditalFavorite: {
      findUnique: overrides.findUnique ?? vi.fn().mockResolvedValue(null),
      delete: overrides.delete ?? vi.fn().mockResolvedValue({}),
      create: overrides.create ?? vi.fn().mockResolvedValue({}),
      findMany: overrides.findMany ?? vi.fn().mockResolvedValue([]),
      count: overrides.count ?? vi.fn().mockResolvedValue(0),
    },
  } as unknown as PrismaService;

  return new FavoritesService(prisma);
}

describe("FavoritesService.toggleFavorite", () => {
  it("creates a favorite when it does not exist", async () => {
    const createMock = vi.fn().mockResolvedValue({});
    // findUnique returns null by default → no existing favorite
    const svc = buildService({ create: createMock });
    const result = await svc.toggleFavorite(STUB_USER_ID, STUB_NOTICE_ID);

    expect(result).toEqual({ isFavorited: true });
    expect(createMock).toHaveBeenCalledWith({
      data: { userId: STUB_USER_ID, pncpEditalId: STUB_NOTICE_ID },
    });
  });

  it("deletes the favorite when it already exists", async () => {
    const existingRow = { id: "existing-id", userId: STUB_USER_ID, pncpEditalId: STUB_NOTICE_ID };
    const deleteMock = vi.fn().mockResolvedValue({});
    const svc = buildService({
      findUnique: vi.fn().mockResolvedValue(existingRow),
      delete: deleteMock,
    });

    const result = await svc.toggleFavorite(STUB_USER_ID, STUB_NOTICE_ID);

    expect(result).toEqual({ isFavorited: false });
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: existingRow.id } });
  });
});

describe("FavoritesService.getFavorites", () => {
  it("returns empty paginated list when user has no favorites", async () => {
    const svc = buildService();
    const result = await svc.getFavorites(STUB_USER_ID, 1, 10);

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
    expect(result.totalPages).toBe(0);
  });

  it("maps edital rows to NoticeListItem and sets isFavorited true", async () => {
    const fakeEdital = {
      id: STUB_NOTICE_ID,
      pncpId: "123-2024",
      nomeOrgao: "Orgao Teste",
      objetoCompra: "Objeto Teste",
      modalidadeNome: "Pregão Eletrônico",
      situacaoNome: "Aberto",
      status: null,
      uf: "SP",
      municipioNome: "São Paulo",
      dataPublicacaoPncp: null,
      dataAberturaProposta: null,
      dataEncerramentoProposta: null,
      valorTotalEstimado: null,
      linkEdital: null,
      portalUrl: null,
      isPublishedOnPncp: null,
      validatedAt: null,
      numeroCompra: "001",
      anoCompra: 2024,
      dataUltimaAtualizacao: null,
    };

    const svc = buildService({
      findMany: vi.fn().mockResolvedValue([{ edital: fakeEdital }]),
      count: vi.fn().mockResolvedValue(1),
    });

    const result = await svc.getFavorites(STUB_USER_ID, 1, 10);

    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(result.items[0].id).toBe(STUB_NOTICE_ID);
    expect(result.items[0].isFavorited).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd apps/api
npx vitest run src/favorites/favorites.service.test.ts
```

Expected: FAIL — `Cannot find module './favorites.service'`

- [ ] **Step 3: Implement `FavoritesService`**

Create `apps/api/src/favorites/favorites.service.ts`:

```typescript
import { Injectable } from "@nestjs/common";
import type { NoticeListItem, PaginatedResponse } from "@pncp/types";
import { PrismaService } from "../common/prisma.service";
import {
  mapPncpEditalRowToNoticeListItem,
  noticeListSelect,
  type NoticeListRow,
} from "../notices/notice-search.mapper";

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async toggleFavorite(
    userId: string,
    noticeId: string,
  ): Promise<{ isFavorited: boolean }> {
    const existing = await this.prisma.pncpEditalFavorite.findUnique({
      where: { userId_pncpEditalId: { userId, pncpEditalId: noticeId } },
    });

    if (existing) {
      await this.prisma.pncpEditalFavorite.delete({ where: { id: existing.id } });
      return { isFavorited: false };
    }

    await this.prisma.pncpEditalFavorite.create({
      data: { userId, pncpEditalId: noticeId },
    });
    return { isFavorited: true };
  }

  async getFavorites(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<PaginatedResponse<NoticeListItem>> {
    const [rows, total] = await Promise.all([
      this.prisma.pncpEditalFavorite.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { edital: { select: noticeListSelect } },
      }),
      this.prisma.pncpEditalFavorite.count({ where: { userId } }),
    ]);

    const items: NoticeListItem[] = rows.map((fav) => ({
      ...mapPncpEditalRowToNoticeListItem(fav.edital as NoticeListRow),
      isFavorited: true,
    }));

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd apps/api
npx vitest run src/favorites/favorites.service.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/favorites/favorites.service.ts apps/api/src/favorites/favorites.service.test.ts
git commit -m "feat: implement FavoritesService with toggle and list"
```

---

## Task 4: Wire `FavoritesController` and `app.module.ts`

**Files:**
- Modify: `apps/api/src/favorites/favorites.controller.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Replace the controller stub**

Overwrite `apps/api/src/favorites/favorites.controller.ts` with:

```typescript
import { Controller, Get, Post, Param, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { NoticeListItem, PaginatedResponse } from "@pncp/types";
import { PNCP_PORTAL_PAGE_SIZE } from "@pncp/types";
import { FavoritesService } from "./favorites.service";

const STUB_USER_ID = "00000000-0000-0000-0000-000000000001";

@ApiTags("favorites")
@Controller("api/favorites")
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Post(":id")
  toggle(@Param("id") id: string): Promise<{ isFavorited: boolean }> {
    return this.favoritesService.toggleFavorite(STUB_USER_ID, id);
  }

  @Get()
  list(
    @Query("page") page = "1",
    @Query("pageSize") pageSize = String(PNCP_PORTAL_PAGE_SIZE),
  ): Promise<PaginatedResponse<NoticeListItem>> {
    return this.favoritesService.getFavorites(
      STUB_USER_ID,
      Math.max(1, parseInt(page, 10) || 1),
      Math.min(100, Math.max(1, parseInt(pageSize, 10) || PNCP_PORTAL_PAGE_SIZE)),
    );
  }
}
```

- [ ] **Step 2: Add `FavoritesService` to `app.module.ts`**

In `apps/api/src/app.module.ts`, add the import:
```typescript
import { FavoritesService } from "./favorites/favorites.service";
```

Then add `FavoritesService` to the `providers` array (after `AnalyzerService`):
```typescript
FavoritesService,
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/api
npm run typecheck
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/favorites/favorites.controller.ts apps/api/src/app.module.ts
git commit -m "feat: wire FavoritesController with FavoritesService"
```

---

## Task 5: Add `isFavorited` to shared types

**Files:**
- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: Add field to `NoticeListItem`**

In `packages/types/src/index.ts`, find the `NoticeListItem` interface and add `isFavorited` as the last optional field:

```typescript
export interface NoticeListItem {
  id: string;
  externalId: string;
  source: string;
  agency: string;
  object: string;
  modality: string;
  status: string;
  state?: string | null;
  city?: string | null;
  publishedAt?: string | null;
  openingAt?: string | null;
  closingAt?: string | null;
  estimatedValue?: number | null;
  hasAttachments: boolean;
  noticeNumber?: string | null;
  updatedAt?: string | null;
  isFavorited?: boolean;   // ← add this line
}
```

- [ ] **Step 2: Typecheck across all packages**

```bash
cd <repo-root>
npm run typecheck
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add packages/types/src/index.ts
git commit -m "feat: add isFavorited field to NoticeListItem type"
```

---

## Task 6: Add SDK methods

**Files:**
- Modify: `packages/sdk/src/client.ts`

- [ ] **Step 1: Add `toggleFavorite` and `getFavorites` to `ApiClient`**

In `packages/sdk/src/client.ts`, add these two methods inside the `ApiClient` class (e.g. after `getProcessingStatus`):

```typescript
async toggleFavorite(noticeId: string): Promise<{ isFavorited: boolean }> {
  const response = await fetch(`${this.baseUrl}/favorites/${noticeId}`, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Não foi possível atualizar o favorito."));
  }

  return response.json();
}

async getFavorites(
  page = 1,
  pageSize?: number,
): Promise<PaginatedResponse<NoticeListItem>> {
  const search = new URLSearchParams({ page: String(page) });
  if (pageSize) search.set("pageSize", String(pageSize));

  const response = await fetch(`${this.baseUrl}/favorites?${search.toString()}`, {
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Não foi possível carregar os favoritos."));
  }

  return response.json();
}
```

Make sure `PaginatedResponse` is imported at the top of the file alongside the existing type imports from `@pncp/types`.

- [ ] **Step 2: Typecheck**

```bash
cd <repo-root>
npm run typecheck
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add packages/sdk/src/client.ts
git commit -m "feat: add toggleFavorite and getFavorites to SDK client"
```

---

## Task 7: Frontend hooks

**Files:**
- Create: `apps/web/src/hooks/use-toggle-favorite.ts`
- Create: `apps/web/src/hooks/use-favorites.ts`

- [ ] **Step 1: Create `useToggleFavorite`**

Create `apps/web/src/hooks/use-toggle-favorite.ts`:

```typescript
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (noticeId: string) => apiClient.toggleFavorite(noticeId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["favorites"] });
    },
  });
}
```

- [ ] **Step 2: Create `useFavorites`**

Create `apps/web/src/hooks/use-favorites.ts`:

```typescript
"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export function useFavorites(page = 1) {
  return useQuery({
    queryKey: ["favorites", { page }],
    queryFn: () => apiClient.getFavorites(page),
  });
}
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/web
npm run typecheck
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/hooks/use-toggle-favorite.ts apps/web/src/hooks/use-favorites.ts
git commit -m "feat: add useToggleFavorite and useFavorites hooks"
```

---

## Task 8: Add star button to `NoticeCard`

**Files:**
- Modify: `apps/web/src/components/notices/notice-card-list.tsx`

This task modifies the existing `NoticeCard` and `NoticeCardList` components.

Read the current file before editing: `apps/web/src/components/notices/notice-card-list.tsx`.

- [ ] **Step 1: Add new imports**

At the top of the file, add these MUI icon imports alongside the existing imports:

```typescript
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import { useToggleFavorite } from "@/hooks/use-toggle-favorite";
import { useState, useEffect } from "react";
```

Note: `useState` and `useEffect` may already be imported — only add what is missing.

- [ ] **Step 2: Update `NoticeCard` props and add star button**

Change the `NoticeCard` function signature to accept two new optional props:

```typescript
function NoticeCard({
  notice,
  href,
  isHighlighted,
  isFavorited: isFavoritedProp = false,
  onToggleFavorite,
}: {
  notice: NoticeListItem;
  href: string;
  isHighlighted: boolean;
  isFavorited?: boolean;
  onToggleFavorite?: (id: string) => void;
})
```

Inside the component body, add:

```typescript
const [isFavorited, setIsFavorited] = useState(isFavoritedProp);
const { mutate, isPending, isError } = useToggleFavorite();

useEffect(() => {
  if (isError) {
    setIsFavorited((prev) => !prev); // revert on error
  }
}, [isError]);

function handleToggle() {
  if (isPending) return;
  setIsFavorited((prev) => !prev);
  mutate(notice.id);
  onToggleFavorite?.(notice.id);
}
```

In the card footer (the `Box` with `display: "flex"` that contains `NoticeStatusBadge` and the "Abrir detalhes" button), add the star `IconButton` as the **first child**, before `NoticeStatusBadge`:

```typescript
{onToggleFavorite !== undefined && (
  <IconButton
    size="small"
    onClick={handleToggle}
    disabled={isPending}
    aria-label={isFavorited ? "Remover dos favoritos" : "Adicionar aos favoritos"}
    color={isFavorited ? "warning" : "default"}
  >
    {isPending ? (
      <CircularProgress size={16} />
    ) : isFavorited ? (
      <StarIcon fontSize="small" />
    ) : (
      <StarBorderIcon fontSize="small" />
    )}
  </IconButton>
)}
```

The star only renders when `onToggleFavorite` is passed — this keeps the dashboard unchanged.

- [ ] **Step 3: Update `NoticeCardList` props**

Change the `NoticeCardList` function signature to accept two new optional props:

```typescript
export function NoticeCardList({
  items,
  highlightedNoticeId,
  favoritedIds,
  onToggleFavorite,
}: {
  items: NoticeListItem[];
  highlightedNoticeId?: string | null;
  favoritedIds?: Set<string>;
  onToggleFavorite?: (id: string) => void;
})
```

Pass them through to each `NoticeCard`:

```typescript
<NoticeCard
  key={notice.id}
  notice={notice}
  href={buildNoticeDetailHref(notice.id, returnTo)}
  isHighlighted={notice.id === highlightedNoticeId}
  isFavorited={favoritedIds?.has(notice.id) ?? notice.isFavorited}
  onToggleFavorite={onToggleFavorite}
/>
```

- [ ] **Step 4: Typecheck**

```bash
cd apps/web
npm run typecheck
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/notices/notice-card-list.tsx
git commit -m "feat: add favorite star button to NoticeCard"
```

---

## Task 9: Replace favorites page

**Files:**
- Modify: `apps/web/src/app/(app)/favorites/page.tsx`

- [ ] **Step 1: Rewrite the favorites page**

Replace the entire content of `apps/web/src/app/(app)/favorites/page.tsx` with:

```typescript
"use client";

import { useMemo } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useFavorites } from "@/hooks/use-favorites";
import { useToggleFavorite } from "@/hooks/use-toggle-favorite";
import { NoticeCardList } from "@/components/notices/notice-card-list";

export default function FavoritesPage() {
  const { data, isLoading, isError } = useFavorites();
  const { mutate } = useToggleFavorite();

  const favoritedIds = useMemo(
    () => new Set(data?.items.map((i) => i.id) ?? []),
    [data],
  );

  return (
    <Paper sx={{ p: 3, borderTop: "3px solid", borderColor: "primary.main" }}>
      <Stack spacing={2}>
        <Typography component="h2" variant="h5" fontWeight={700} color="text.primary">
          Favoritos
        </Typography>

        {isError && (
          <Alert severity="error">Não foi possível carregar os favoritos.</Alert>
        )}

        {isLoading && (
          <Stack spacing={2}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} variant="rounded" height={140} />
            ))}
          </Stack>
        )}

        {!isLoading && !isError && data?.items.length === 0 && (
          <Box
            sx={{
              py: 4,
              px: 2,
              textAlign: "center",
              bgcolor: "action.hover",
              borderRadius: 2,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Nenhum favorito salvo ainda.
            </Typography>
          </Box>
        )}

        {!isLoading && !isError && data && data.items.length > 0 && (
          <NoticeCardList
            items={data.items}
            favoritedIds={favoritedIds}
            onToggleFavorite={(id) => mutate(id)}
          />
        )}
      </Stack>
    </Paper>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/web
npm run typecheck
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/(app)/favorites/page.tsx
git commit -m "feat: implement favorites page with list and toggle"
```

---

## Task 10: Final verification

- [ ] **Step 1: Run all backend tests**

```bash
cd apps/api
npm run test
```

Expected: All tests pass including the new `favorites.service.test.ts`.

- [ ] **Step 2: Run full typecheck**

```bash
cd <repo-root>
npm run typecheck
```

Expected: No errors across all packages.

- [ ] **Step 3: Manual smoke test (if the dev server is available)**

Start the dev server:
```bash
npm run dev
```

Verify:
1. Open the dashboard — notice cards show no star button (expected: `onToggleFavorite` not passed)
2. Open `/favorites` — empty state shows "Nenhum favorito salvo ainda."
3. Directly call `POST /api/favorites/<any-valid-pncp-edital-id>` — returns `{ isFavorited: true }`
4. Call `GET /api/favorites` — returns the favorited edital
5. Call `POST /api/favorites/<same-id>` again — returns `{ isFavorited: false }` (toggle removes it)

- [ ] **Step 4: Final commit tag**

```bash
git tag favorites-feature-complete
```
