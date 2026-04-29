create table if not exists public.user_course_state (
  user_id uuid primary key,
  completed_lesson_ids text[] not null default '{}',
  current_lesson_id text not null default 'a1-01',
  level_stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_course_state_updated_at
  on public.user_course_state(updated_at desc);

