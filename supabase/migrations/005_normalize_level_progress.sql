-- Normalized per-user level progress (replaces user_course_state.level_stats jsonb).

create table if not exists public.user_course_level_progress (
  user_id uuid not null,
  cefr_level text not null check (cefr_level in ('A1','A2','B1','B2','C1','C2')),
  assessment_passed boolean not null default false,
  assessment_index int not null default 0,
  primary key (user_id, cefr_level)
);

create table if not exists public.user_course_active_days (
  user_id uuid not null,
  cefr_level text not null check (cefr_level in ('A1','A2','B1','B2','C1','C2')),
  day_date date not null,
  primary key (user_id, cefr_level, day_date)
);

create table if not exists public.user_course_weekly_passes (
  user_id uuid not null,
  cefr_level text not null check (cefr_level in ('A1','A2','B1','B2','C1','C2')),
  week_key text not null,
  pass_count int not null default 0,
  primary key (user_id, cefr_level, week_key)
);

create table if not exists public.user_course_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  cefr_level text not null check (cefr_level in ('A1','A2','B1','B2','C1','C2')),
  due_date date not null,
  done boolean not null default false
);

create index if not exists idx_user_course_reviews_user on public.user_course_reviews(user_id, cefr_level);
create index if not exists idx_user_course_active_days_user on public.user_course_active_days(user_id);

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
  for select using (auth.uid() = user_id);
create policy user_course_level_progress_upsert on public.user_course_level_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy user_course_active_days_select on public.user_course_active_days
  for select using (auth.uid() = user_id);
create policy user_course_active_days_all on public.user_course_active_days
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy user_course_weekly_passes_select on public.user_course_weekly_passes
  for select using (auth.uid() = user_id);
create policy user_course_weekly_passes_all on public.user_course_weekly_passes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy user_course_reviews_select on public.user_course_reviews
  for select using (auth.uid() = user_id);
create policy user_course_reviews_all on public.user_course_reviews
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Backfill from legacy jsonb (if column exists)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_course_state' and column_name = 'level_stats'
  ) then
    insert into public.user_course_level_progress (user_id, cefr_level, assessment_passed, assessment_index)
    select u.user_id, lvl.key,
      coalesce((lvl.value->>'assessmentPassed')::boolean, false),
      coalesce((lvl.value->>'assessmentIndex')::int, 0)
    from public.user_course_state u
    cross join lateral jsonb_each(u.level_stats) as lvl(key, value)
    on conflict (user_id, cefr_level) do update set
      assessment_passed = excluded.assessment_passed,
      assessment_index = excluded.assessment_index;

    insert into public.user_course_active_days (user_id, cefr_level, day_date)
    select u.user_id, lvl.key::text, d.value::text::date
    from public.user_course_state u
    cross join lateral jsonb_each(u.level_stats) as lvl(key, value)
    cross join lateral jsonb_array_elements_text(coalesce(value->'activeDays', '[]'::jsonb)) as d(value)
    on conflict do nothing;

    insert into public.user_course_weekly_passes (user_id, cefr_level, week_key, pass_count)
    select u.user_id, lvl.key::text, wp.key, (wp.value)::text::int
    from public.user_course_state u
    cross join lateral jsonb_each(u.level_stats) as lvl(key, value)
    cross join lateral jsonb_each(coalesce(value->'weeklyPasses', '{}'::jsonb)) as wp(key, value)
    on conflict (user_id, cefr_level, week_key) do update set pass_count = excluded.pass_count;

    insert into public.user_course_reviews (user_id, cefr_level, due_date, done)
    select u.user_id, lvl.key::text, (r->>'dueDate')::date, coalesce((r->>'done')::boolean, false)
    from public.user_course_state u
    cross join lateral jsonb_each(u.level_stats) as lvl(key, value)
    cross join lateral jsonb_array_elements(coalesce(value->'reviewQueue', '[]'::jsonb)) as r;

    alter table public.user_course_state drop column level_stats;
  end if;
end $$;
