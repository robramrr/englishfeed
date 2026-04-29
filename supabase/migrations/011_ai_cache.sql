-- Server-side cache for AI API responses (translations, vocab flashcard URLs, etc.).
-- Service role bypasses RLS; anon/authenticated clients have no policies → no direct access.

create table if not exists public.ai_cache (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  input_hash text not null,
  input_text text,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists ai_cache_type_input_hash_uidx
  on public.ai_cache (type, input_hash);

comment on table public.ai_cache is 'Server-only AI response cache; keyed by type + input_hash.';

alter table public.ai_cache enable row level security;
