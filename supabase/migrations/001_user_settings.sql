-- user_settings: store per-user preferences (e.g. level for the feed)
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  level text not null default 'beginner' check (level in ('beginner', 'intermediate', 'advanced')),
  created_at timestamptz not null default now()
);

-- Optional: allow RLS and policy so users can only read/update their own row
-- alter table public.user_settings enable row level security;
-- create policy "Users can read own settings" on public.user_settings for select using (auth.uid() = user_id);
-- create policy "Users can update own settings" on public.user_settings for update using (auth.uid() = user_id);
-- create policy "Users can insert own settings" on public.user_settings for insert with check (auth.uid() = user_id);
