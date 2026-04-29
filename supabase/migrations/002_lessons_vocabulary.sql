-- Vocabulary JSON for each lesson (precomputed; read via GET /api/lesson-vocabulary)
create table if not exists public.lessons (
  id text primary key,
  vocabulary jsonb default null
);

alter table public.lessons add column if not exists vocabulary jsonb;
