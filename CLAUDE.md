# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PNCP Intelligence Platform — a full-stack SaaS monorepo for Brazilian public procurement intelligence. It aggregates notices from PNCP (Plataforma Nacional de Contratações Públicas), provides AI-assisted interpretation via local LLM (Ollama), and supports saved searches, alerts, and document RAG.

**Status**: Greenfield scaffold. Database schema is defined in Prisma but migrations have not yet been applied to Supabase. The PNCP adapter is scaffolded but not yet wired to the official PNCP endpoint.

## Monorepo Structure

- `apps/api` — NestJS 11 backend (port 3001)
- `apps/web` — Next.js 15 frontend (port 3000)
- `packages/types` — Shared TypeScript domain contracts
- `packages/sdk` — Typed API client (used by web to call api)
- `packages/ui` — Shared shadcn/ui-compatible components
- `packages/config` — Shared Tailwind config
- `packages/eslint-config` / `packages/typescript-config` — Shared tooling presets

## Commands

### Root (run from repo root)
```bash
npm run setup        # First-time install
npm run dev          # Run all apps in parallel via Turbo
npm run dev:full     # Full dev setup script (starts infra + apps)
npm run build        # Build all packages
npm run lint         # Lint all packages
npm run typecheck    # Type check all packages
npm run test         # Run all tests
```

### Backend (`apps/api`)
```bash
npm run dev                # NestJS watch mode
npm run build              # Compile
npm run test               # Vitest
npm run prisma:generate    # Regenerate Prisma client after schema changes
npm run typecheck
```

### Frontend (`apps/web`)
```bash
npm run dev         # Next.js dev server
npm run build       # Production build
npm run test        # Vitest
npm run typecheck
```

### Infrastructure
```bash
docker-compose up   # Start PostgreSQL (Supabase), Redis, Ollama
```

## Architecture

```
Next.js (App Router) → NestJS REST API
                            ├── Procurement Adapter (PncpAdapter)
                            ├── BullMQ + Redis (job queues: sync, embedding)
                            ├── Prisma ORM → Supabase PostgreSQL + pgvector
                            └── Ollama (local LLM: generation + embeddings)
```

### Backend Module Layout (`apps/api/src/`)
Each feature is a NestJS module. Key modules:
- `notices/` — search, detail, document management
- `ai/` — RAG question-answering over notice documents
- `sources/` — procurement adapter interface; `pncp/` contains the PNCP adapter and sync service
- `jobs/` — BullMQ job processors (sync, embedding ingestion)
- `alerts/` — alert rules and notification dispatch
- `auth/` — Supabase Auth integration
- `common/` — `PrismaService`, config helpers shared across modules

### Frontend Layout (`apps/web/src/`)
- `app/(app)/dashboard/` — authenticated app routes (Next.js App Router)
- `components/ai/` — AI chat panel
- `lib/api-client.ts` — wraps `@pncp/sdk` for typed API calls
- `lib/query-client.ts` — React Query setup

### Data Flow for AI Q&A
1. Notice documents are chunked and stored as `NoticeChunk`
2. Embeddings generated via Ollama (`qwen3-embedding`) stored in `NoticeEmbedding` (pgvector)
3. At query time, relevant chunks are retrieved by cosine similarity and passed as context to Ollama (`qwen2.5:7b`)
4. Responses and citations stored in `AIConversation` / `AIMessage`

## Key Environment Variables

See `.env.example`. Critical ones:
- `DATABASE_URL` / `DIRECT_URL` — Supabase PostgreSQL connection strings
- `REDIS_URL` — BullMQ broker
- `OLLAMA_BASE_URL`, `OLLAMA_GENERATION_MODEL`, `OLLAMA_EMBEDDING_MODEL`
- `PNCP_BASE_URL` — PNCP public API base
- `PNCP_SYNC_ENABLED` — set `true` to activate periodic sync

## Shared Types & SDK

When adding a new API endpoint:
1. Add/update types in `packages/types/src/`
2. Update `packages/sdk/src/` with the new client method
3. Consume in `apps/web` via `lib/api-client.ts`

Turbo path aliases (`@pncp/*`) resolve these workspace packages — no relative `../../packages/` imports.

## PNCP API

`PncpConsultaService` usa **dois base URLs distintos**:
- `PNCP_BASE_URL` (env, default `https://pncp.gov.br/api/consulta`) — para `getCompra()`
- `https://pncp.gov.br/api/pncp` (hardcoded) — para `getItens()` e `getArquivos()`

URL de download de arquivo: `https://pncp.gov.br/api/pncp/v1/orgaos/{cnpj}/compras/{ano}/{seq}/arquivos/{sequencial}`

`PncpConsultaService` já está registrado em `app.module.ts` — nenhuma mudança de módulo necessária ao injetá-lo.

## Testing

`NoticesService` é testado via instanciação direta em `notices.service.search.test.ts`. Ao adicionar parâmetros ao construtor, atualizar o helper `buildService()` nesse arquivo — caso contrário o typecheck falha.

## Frontend

Usa **MUI v6** (`@mui/material`) como biblioteca de componentes, não shadcn/Tailwind diretamente.

## Prisma Schema

Antes de referenciar campos `edital.*` no código de serviço, verificar se o campo existe em `prisma/schema.prisma`. Alguns campos conceituais (ex: `razaoSocial`, `srp`) podem não estar no schema.
