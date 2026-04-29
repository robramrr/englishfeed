-- =============================================================================
-- EnglishFeed — Row Level Security (RLS) for public schema
-- File: supabase/migrations/006_rls_public_tables.sql
--
-- Prerequisites: apply repo migrations 001–005 (or ensure the same tables/columns exist).
-- If ALTER TABLE fails, that table is missing — run earlier migrations or comment that section.
--
-- Run in Supabase SQL Editor (or supabase db push). Re-runnable: uses DROP POLICY IF EXISTS.
-- Service role bypasses RLS; these policies protect direct PostgREST / anon+authenticated access.
-- =============================================================================
-- CLASSIFICATION (see README or project docs for full matrix):
--   Public read     = anon + authenticated may SELECT (catalog / shared content)
--   Auth read       = only authenticated may SELECT
--   User-owned      = users may CRUD only rows where user_id = auth.uid()
--   Server-only     = RLS ON, no policies for anon/authenticated → clients cannot access;
--                     only service_role (your API) can read/write.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Course catalog (public read — safe, non-secret structure)
-- ---------------------------------------------------------------------------
alter table public.courses enable row level security;
alter table public.course_units enable row level security;
alter table public.course_lessons enable row level security;
alter table public.lesson_checkpoints enable row level security;

drop policy if exists courses_select_public on public.courses;
create policy courses_select_public on public.courses
  for select to anon, authenticated
  using (true);

drop policy if exists course_units_select_public on public.course_units;
create policy course_units_select_public on public.course_units
  for select to anon, authenticated
  using (true);

drop policy if exists course_lessons_select_public on public.course_lessons;
create policy course_lessons_select_public on public.course_lessons
  for select to anon, authenticated
  using (true);

drop policy if exists lesson_checkpoints_select_public on public.lesson_checkpoints;
create policy lesson_checkpoints_select_public on public.lesson_checkpoints
  for select to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- user_course_state (owner only)
-- ---------------------------------------------------------------------------
alter table public.user_course_state enable row level security;

drop policy if exists user_course_state_select_own on public.user_course_state;
drop policy if exists user_course_state_insert_own on public.user_course_state;
drop policy if exists user_course_state_update_own on public.user_course_state;
drop policy if exists user_course_state_delete_own on public.user_course_state;

create policy user_course_state_select_own on public.user_course_state
  for select to authenticated
  using (auth.uid() = user_id);
create policy user_course_state_insert_own on public.user_course_state
  for insert to authenticated
  with check (auth.uid() = user_id);
create policy user_course_state_update_own on public.user_course_state
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy user_course_state_delete_own on public.user_course_state
  for delete to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- lesson_attempts (owner insert + select; no cross-user reads)
-- ---------------------------------------------------------------------------
alter table public.lesson_attempts enable row level security;

drop policy if exists lesson_attempts_select_own on public.lesson_attempts;
drop policy if exists lesson_attempts_insert_own on public.lesson_attempts;
drop policy if exists lesson_attempts_update_own on public.lesson_attempts;
drop policy if exists lesson_attempts_delete_own on public.lesson_attempts;

create policy lesson_attempts_select_own on public.lesson_attempts
  for select to authenticated
  using (auth.uid() = user_id);
create policy lesson_attempts_insert_own on public.lesson_attempts
  for insert to authenticated
  with check (auth.uid() = user_id);
-- No generic update/delete from clients (analytics integrity)

-- ---------------------------------------------------------------------------
-- Normalized course gate stats (005) — owner only
-- ---------------------------------------------------------------------------
alter table public.user_course_level_progress enable row level security;
alter table public.user_course_active_days enable row level security;
alter table public.user_course_weekly_passes enable row level security;
alter table public.user_course_reviews enable row level security;

drop policy if exists user_course_level_progress_select on public.user_course_level_progress;
drop policy if exists user_course_level_progress_upsert on public.user_course_level_progress;
drop policy if exists user_course_active_days_select on public.user_course_active_days;
drop policy if exists user_course_active_days_all on public.user_course_active_days;
drop policy if exists user_course_weekly_passes_select on public.user_course_weekly_passes;
drop policy if exists user_course_weekly_passes_all on public.user_course_weekly_passes;
drop policy if exists user_course_reviews_select on public.user_course_reviews;
drop policy if exists user_course_reviews_all on public.user_course_reviews;

create policy user_course_level_progress_select on public.user_course_level_progress
  for select to authenticated using (auth.uid() = user_id);
create policy user_course_level_progress_ins on public.user_course_level_progress
  for insert to authenticated with check (auth.uid() = user_id);
create policy user_course_level_progress_upd on public.user_course_level_progress
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy user_course_level_progress_del on public.user_course_level_progress
  for delete to authenticated using (auth.uid() = user_id);

create policy user_course_active_days_select on public.user_course_active_days
  for select to authenticated using (auth.uid() = user_id);
create policy user_course_active_days_ins on public.user_course_active_days
  for insert to authenticated with check (auth.uid() = user_id);
create policy user_course_active_days_upd on public.user_course_active_days
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy user_course_active_days_del on public.user_course_active_days
  for delete to authenticated using (auth.uid() = user_id);

create policy user_course_weekly_passes_select on public.user_course_weekly_passes
  for select to authenticated using (auth.uid() = user_id);
create policy user_course_weekly_passes_ins on public.user_course_weekly_passes
  for insert to authenticated with check (auth.uid() = user_id);
create policy user_course_weekly_passes_upd on public.user_course_weekly_passes
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy user_course_weekly_passes_del on public.user_course_weekly_passes
  for delete to authenticated using (auth.uid() = user_id);

create policy user_course_reviews_select on public.user_course_reviews
  for select to authenticated using (auth.uid() = user_id);
create policy user_course_reviews_ins on public.user_course_reviews
  for insert to authenticated with check (auth.uid() = user_id);
create policy user_course_reviews_upd on public.user_course_reviews
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy user_course_reviews_del on public.user_course_reviews
  for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- user_settings (owner only)
-- ---------------------------------------------------------------------------
alter table public.user_settings enable row level security;

drop policy if exists user_settings_select_own on public.user_settings;
drop policy if exists user_settings_insert_own on public.user_settings;
drop policy if exists user_settings_update_own on public.user_settings;
drop policy if exists user_settings_delete_own on public.user_settings;

create policy user_settings_select_own on public.user_settings
  for select to authenticated using (auth.uid() = user_id);
create policy user_settings_insert_own on public.user_settings
  for insert to authenticated with check (auth.uid() = user_id);
create policy user_settings_update_own on public.user_settings
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy user_settings_delete_own on public.user_settings
  for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- lessons (feed metadata / cached AI fields) — read-only for clients; server writes
-- Adjust to "authenticated only" if you do not want anonymous reads.
-- ---------------------------------------------------------------------------
alter table public.lessons enable row level security;

drop policy if exists lessons_select_public on public.lessons;
create policy lessons_select_public on public.lessons
  for select to anon, authenticated
  using (true);
-- No insert/update/delete for anon/authenticated (service role only)

-- ---------------------------------------------------------------------------
-- lesson_practice, likes, saves, events, lesson_engagement_stats
-- (wrapped so migration does not fail if a legacy table is missing in some envs)
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.lesson_practice') is not null then
    execute 'alter table public.lesson_practice enable row level security';
    execute 'drop policy if exists lesson_practice_select_public on public.lesson_practice';
    execute $p$
      create policy lesson_practice_select_public on public.lesson_practice
        for select to anon, authenticated using (true)
    $p$;
  end if;

  if to_regclass('public.likes') is not null then
    execute 'alter table public.likes enable row level security';
    execute 'drop policy if exists likes_select_own on public.likes';
    execute 'drop policy if exists likes_insert_own on public.likes';
    execute 'drop policy if exists likes_update_own on public.likes';
    execute 'drop policy if exists likes_delete_own on public.likes';
    execute $p$
      create policy likes_select_own on public.likes
        for select to authenticated using (auth.uid() = user_id)
    $p$;
    execute $p$
      create policy likes_insert_own on public.likes
        for insert to authenticated with check (auth.uid() = user_id)
    $p$;
    execute $p$
      create policy likes_update_own on public.likes
        for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)
    $p$;
    execute $p$
      create policy likes_delete_own on public.likes
        for delete to authenticated using (auth.uid() = user_id)
    $p$;
  end if;

  if to_regclass('public.saves') is not null then
    execute 'alter table public.saves enable row level security';
    execute 'drop policy if exists saves_select_own on public.saves';
    execute 'drop policy if exists saves_insert_own on public.saves';
    execute 'drop policy if exists saves_update_own on public.saves';
    execute 'drop policy if exists saves_delete_own on public.saves';
    execute $p$
      create policy saves_select_own on public.saves
        for select to authenticated using (auth.uid() = user_id)
    $p$;
    execute $p$
      create policy saves_insert_own on public.saves
        for insert to authenticated with check (auth.uid() = user_id)
    $p$;
    execute $p$
      create policy saves_update_own on public.saves
        for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)
    $p$;
    execute $p$
      create policy saves_delete_own on public.saves
        for delete to authenticated using (auth.uid() = user_id)
    $p$;
  end if;

  if to_regclass('public.events') is not null then
    execute 'alter table public.events enable row level security';
    -- No policies: server-only via service role.
  end if;

  if to_regclass('public.lesson_engagement_stats') is not null then
    execute 'alter table public.lesson_engagement_stats enable row level security';
    execute 'drop policy if exists lesson_engagement_stats_select_auth on public.lesson_engagement_stats';
    execute $p$
      create policy lesson_engagement_stats_select_auth on public.lesson_engagement_stats
        for select to authenticated using (true)
    $p$;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- course_lesson_ai_cache — server-only AI cache (if table exists in your project)
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.course_lesson_ai_cache') is not null then
    execute 'alter table public.course_lesson_ai_cache enable row level security';
    -- no policies: clients cannot read/write
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- user_course_progress — legacy progress table (if present): owner only
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.user_course_progress') is not null then
    execute 'alter table public.user_course_progress enable row level security';
    execute 'drop policy if exists user_course_progress_select_own on public.user_course_progress';
    execute 'drop policy if exists user_course_progress_insert_own on public.user_course_progress';
    execute 'drop policy if exists user_course_progress_update_own on public.user_course_progress';
    execute 'drop policy if exists user_course_progress_delete_own on public.user_course_progress';
    execute $p$
      create policy user_course_progress_select_own on public.user_course_progress
        for select to authenticated using (auth.uid() = user_id)
    $p$;
    execute $p$
      create policy user_course_progress_insert_own on public.user_course_progress
        for insert to authenticated with check (auth.uid() = user_id)
    $p$;
    execute $p$
      create policy user_course_progress_update_own on public.user_course_progress
        for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)
    $p$;
    execute $p$
      create policy user_course_progress_delete_own on public.user_course_progress
        for delete to authenticated using (auth.uid() = user_id)
    $p$;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Hardening: api_rate_limits + ai_cache (often flagged) — server-only
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.api_rate_limits') is not null then
    execute 'alter table public.api_rate_limits enable row level security';
  end if;
  if to_regclass('public.ai_cache') is not null then
    execute 'alter table public.ai_cache enable row level security';
  end if;
end $$;
