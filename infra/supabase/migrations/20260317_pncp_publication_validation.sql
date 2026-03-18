alter table if exists public.pncp_editais
  add column if not exists portal_url text,
  add column if not exists is_published_on_pncp boolean,
  add column if not exists validated_at timestamptz;

create index if not exists pncp_editais_publication_validation_idx
  on public.pncp_editais (is_published_on_pncp, validated_at desc);
