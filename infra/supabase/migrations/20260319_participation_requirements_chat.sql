create table if not exists public.analyzer_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  notice_id uuid not null references public.pncp_editais(id) on delete cascade,
  resumo jsonb,
  riscos jsonb,
  precos jsonb,
  documentos jsonb,
  requisitos_participacao jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, notice_id)
);

alter table if exists public.ai_messages
  add column if not exists metadata_json jsonb;

alter table if exists public.analyzer_reports
  add column if not exists requisitos_participacao jsonb;

alter table if exists public.notice_chunks
  add column if not exists source_document_name text,
  add column if not exists source_document_type text,
  add column if not exists source_document_key text,
  add column if not exists source_document_url text;

create index if not exists analyzer_reports_notice_idx
  on public.analyzer_reports (notice_id);
