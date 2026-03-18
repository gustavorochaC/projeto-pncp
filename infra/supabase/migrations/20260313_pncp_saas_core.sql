create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notice_sources (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  base_url text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.notice_sources(id) on delete restrict,
  external_id text not null,
  identifier text,
  process_number text,
  agency text not null,
  state text,
  city text,
  object text not null,
  modality text not null,
  status text not null,
  procurement_type text,
  published_at timestamptz,
  opening_at timestamptz,
  closing_at timestamptz,
  estimated_value numeric(18,2),
  complementary_info text,
  justification text,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_id, external_id)
);

create table if not exists public.notice_attachments (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references public.notices(id) on delete cascade,
  external_id text,
  file_name text not null,
  mime_type text,
  file_size_bytes integer,
  source_url text not null,
  storage_path text,
  extracted_text_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  filters_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.search_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  query text,
  filters_json jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.favorite_notices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  notice_id uuid not null references public.notices(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, notice_id)
);

create table if not exists public.notice_sync_logs (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid references public.notices(id) on delete set null,
  source_id uuid not null references public.notice_sources(id) on delete restrict,
  sync_type text not null,
  status text not null,
  detail text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.notice_chunks (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references public.notices(id) on delete cascade,
  attachment_id uuid references public.notice_attachments(id) on delete set null,
  chunk_index integer not null,
  content text not null,
  tokens integer,
  created_at timestamptz not null default now(),
  unique(notice_id, chunk_index)
);

create table if not exists public.notice_embeddings (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references public.notices(id) on delete cascade,
  chunk_id uuid references public.notice_chunks(id) on delete set null,
  model text not null,
  dimensions integer not null,
  embedding vector,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  notice_id uuid not null references public.notices(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null,
  content text not null,
  citations_json jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.alert_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  filters_json jsonb not null,
  channel text not null,
  frequency text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  alert_rule_id uuid references public.alert_rules(id) on delete set null,
  title text not null,
  body text not null,
  channel text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists notices_status_closing_idx on public.notices(status, closing_at);
create index if not exists notices_location_idx on public.notices(state, city);
create index if not exists notices_published_idx on public.notices(published_at desc);
create index if not exists notice_embeddings_notice_idx on public.notice_embeddings(notice_id);
create index if not exists saved_searches_user_idx on public.saved_searches(user_id);
create index if not exists search_history_user_created_idx on public.search_history(user_id, created_at desc);
create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.saved_searches enable row level security;
alter table public.search_history enable row level security;
alter table public.favorite_notices enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.alert_rules enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "saved_searches_own" on public.saved_searches for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "search_history_own" on public.search_history for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "favorite_notices_own" on public.favorite_notices for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ai_conversations_own" on public.ai_conversations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ai_messages_via_conversation" on public.ai_messages
  for all
  using (
    exists (
      select 1
      from public.ai_conversations c
      where c.id = conversation_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.ai_conversations c
      where c.id = conversation_id
        and c.user_id = auth.uid()
    )
  );
create policy "alert_rules_own" on public.alert_rules for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notifications_own" on public.notifications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "audit_logs_own" on public.audit_logs for select using (auth.uid() = user_id);

insert into public.notice_sources (key, name, base_url, is_active)
values ('pncp', 'Portal Nacional de Contratações Públicas', 'https://pncp.gov.br/api/consulta', true)
on conflict (key) do update
set
  name = excluded.name,
  base_url = excluded.base_url,
  is_active = excluded.is_active;
