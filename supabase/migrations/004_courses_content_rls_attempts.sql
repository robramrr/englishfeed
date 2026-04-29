create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.course_units (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  unit_order int not null check (unit_order > 0),
  cefr_level text not null check (cefr_level in ('A1','A2','B1','B2','C1','C2')),
  title text not null,
  unique (course_id, unit_order)
);

create table if not exists public.course_lessons (
  id text primary key,
  unit_id uuid not null references public.course_units(id) on delete cascade,
  lesson_order int not null check (lesson_order > 0),
  title text not null,
  cefr_level text not null check (cefr_level in ('A1','A2','B1','B2','C1','C2')),
  grammar_point text not null,
  vocabulary text[] not null default '{}',
  outcome text not null,
  lesson_kind text not null default 'lesson' check (lesson_kind in ('lesson','assessment')),
  unique (unit_id, lesson_order)
);

create table if not exists public.lesson_checkpoints (
  id text primary key,
  lesson_id text not null references public.course_lessons(id) on delete cascade,
  checkpoint_order int not null check (checkpoint_order > 0),
  prompt text not null,
  grammar_hint text not null,
  required_vocabulary text[] not null default '{}',
  min_words int not null default 1,
  unique (lesson_id, checkpoint_order)
);

create table if not exists public.lesson_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  lesson_id text not null references public.course_lessons(id) on delete cascade,
  checkpoint_id text not null references public.lesson_checkpoints(id) on delete cascade,
  learner_text text not null,
  pass boolean not null,
  score int not null,
  reason text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_course_units_course on public.course_units(course_id);
create index if not exists idx_course_lessons_unit on public.course_lessons(unit_id);
create index if not exists idx_lesson_checkpoints_lesson on public.lesson_checkpoints(lesson_id);
create index if not exists idx_lesson_attempts_user_created on public.lesson_attempts(user_id, created_at desc);

alter table public.user_course_state enable row level security;
alter table public.lesson_attempts enable row level security;

drop policy if exists user_course_state_select_own on public.user_course_state;
drop policy if exists user_course_state_insert_own on public.user_course_state;
drop policy if exists user_course_state_update_own on public.user_course_state;
drop policy if exists lesson_attempts_select_own on public.lesson_attempts;
drop policy if exists lesson_attempts_insert_own on public.lesson_attempts;

create policy user_course_state_select_own on public.user_course_state
  for select using (auth.uid() = user_id);
create policy user_course_state_insert_own on public.user_course_state
  for insert with check (auth.uid() = user_id);
create policy user_course_state_update_own on public.user_course_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy lesson_attempts_select_own on public.lesson_attempts
  for select using (auth.uid() = user_id);
create policy lesson_attempts_insert_own on public.lesson_attempts
  for insert with check (auth.uid() = user_id);

insert into public.courses (slug, title)
values ('englishfeed-core', 'EnglishFeed Core Path')
on conflict (slug) do nothing;

with core as (
  select id from public.courses where slug = 'englishfeed-core' limit 1
),
u as (
  insert into public.course_units (course_id, unit_order, cefr_level, title)
  select core.id, x.unit_order, x.cefr_level, x.title
  from core
  join (
    values
      (1, 'A1', 'A1 Foundations'),
      (2, 'A2', 'A2 Everyday English'),
      (3, 'B1', 'B1 Conversation Skills'),
      (4, 'B2', 'B2 Fluency Expansion'),
      (5, 'C1', 'C1 Professional English')
  ) as x(unit_order, cefr_level, title) on true
  on conflict (course_id, unit_order) do update set title = excluded.title
  returning id, unit_order
)
insert into public.course_lessons
  (id, unit_id, lesson_order, title, cefr_level, grammar_point, vocabulary, outcome, lesson_kind)
select x.id, u.id, x.lesson_order, x.title, x.cefr_level, x.grammar_point, x.vocabulary, x.outcome, x.lesson_kind
from u
join (
  values
  ('a1-01', 1, 1, 'Daily Introductions', 'A1', 'Simple present for introductions', array['name','from','live','student','work'], 'Introduce yourself in 3 accurate sentences.', 'lesson'),
  ('a1-assess', 1, 99, 'A1 Cumulative Assessment', 'A1', 'Simple present mastery', array['name','from','live','student','work'], 'Pass A1 cumulative check.', 'assessment'),
  ('a2-01', 2, 1, 'Weekend Planning', 'A2', 'Going to for plans', array['weekend','visit','plan','travel','tomorrow'], 'State short future plans with confidence.', 'lesson'),
  ('a2-assess', 2, 99, 'A2 Cumulative Assessment', 'A2', 'Going to mastery', array['weekend','visit','plan','travel','tomorrow'], 'Pass A2 cumulative check.', 'assessment'),
  ('b1-01', 3, 1, 'Workplace Updates', 'B1', 'Present perfect for recent updates', array['project','deadline','update','improve','issue'], 'Report recent progress and blockers.', 'lesson'),
  ('b1-assess', 3, 99, 'B1 Cumulative Assessment', 'B1', 'Present perfect mastery', array['project','deadline','update','improve','issue'], 'Pass B1 cumulative check.', 'assessment'),
  ('b2-01', 4, 1, 'Opinion and Contrast', 'B2', 'Complex contrast clauses', array['although','however','evidence','claim','policy'], 'Argue with contrast and evidence.', 'lesson'),
  ('b2-assess', 4, 99, 'B2 Cumulative Assessment', 'B2', 'Contrast clause mastery', array['although','however','evidence','claim','policy'], 'Pass B2 cumulative check.', 'assessment'),
  ('c1-01', 5, 1, 'Strategic Recommendations', 'C1', 'Hedging and formal recommendations', array['recommend','mitigate','risk','stakeholder','timeline'], 'Give formal recommendations with nuanced tone.', 'lesson'),
  ('c1-assess', 5, 99, 'C1 Cumulative Assessment', 'C1', 'Hedging mastery', array['recommend','mitigate','risk','stakeholder','timeline'], 'Pass C1 cumulative check.', 'assessment')
) as x(id, unit_order, lesson_order, title, cefr_level, grammar_point, vocabulary, outcome, lesson_kind)
  on x.unit_order = u.unit_order
on conflict (id) do update set
  title = excluded.title,
  grammar_point = excluded.grammar_point,
  vocabulary = excluded.vocabulary,
  outcome = excluded.outcome,
  lesson_kind = excluded.lesson_kind;

insert into public.lesson_checkpoints (id, lesson_id, checkpoint_order, prompt, grammar_hint, required_vocabulary, min_words)
values
('a1-01-c1','a1-01',1,'Write one sentence with "name" and "from".','Use "My name is..." and "I am from...".',array['name','from'],7),
('a1-01-c2','a1-01',2,'Write one sentence with "live" and "work".','Use present simple: "I live..." and "I work...".',array['live','work'],7),
('a1-01-c3','a1-01',3,'Write one sentence with "student" and one earlier word.','Use simple present forms.',array['student'],8),
('a1-assess-c1','a1-assess',1,'Use "name" and "from" in one sentence.','Use simple present.',array['name','from'],8),
('a1-assess-c2','a1-assess',2,'Use "live" and "work" in one sentence.','Use simple present.',array['live','work'],8),
('a1-assess-c3','a1-assess',3,'Use "student" plus one previous A1 word.','Use simple present.',array['student'],8),
('a2-01-c1','a2-01',1,'Write one sentence with "going to" and "weekend".','Use am/is/are going to + verb.',array['weekend'],8),
('a2-01-c2','a2-01',2,'Write one sentence with "visit" and "tomorrow".','Keep future plan grammar.',array['visit','tomorrow'],8),
('a2-01-c3','a2-01',3,'Write one sentence using "plan" and "travel".','Use both words in one thought.',array['plan','travel'],9),
('a2-assess-c1','a2-assess',1,'Use "going to" and "weekend".','Use future plan grammar.',array['weekend'],9),
('a2-assess-c2','a2-assess',2,'Use "visit" and "tomorrow".','Use future plan grammar.',array['visit','tomorrow'],9),
('a2-assess-c3','a2-assess',3,'Use "plan" and "travel".','Use future plan grammar.',array['plan','travel'],10),
('b1-01-c1','b1-01',1,'Write one sentence with present perfect and "project".','Use have/has + participle.',array['project'],9),
('b1-01-c2','b1-01',2,'Write one sentence with "deadline" and "issue".','Mention what has happened recently.',array['deadline','issue'],10),
('b1-01-c3','b1-01',3,'Write one sentence with "update" and "improve".','Use present perfect.',array['update','improve'],10),
('b1-assess-c1','b1-assess',1,'Use present perfect and "project".','Use have/has + participle.',array['project'],10),
('b1-assess-c2','b1-assess',2,'Use "deadline" and "issue".','Mention what has happened recently.',array['deadline','issue'],11),
('b1-assess-c3','b1-assess',3,'Use "update" and "improve".','Use present perfect.',array['update','improve'],11),
('b2-01-c1','b2-01',1,'Write one sentence using "although" and "claim".','Contrast two ideas.',array['although','claim'],11),
('b2-01-c2','b2-01',2,'Write one sentence using "however" and "evidence".','Use clear contrast punctuation.',array['however','evidence'],11),
('b2-01-c3','b2-01',3,'Write one sentence using "policy" and one contrast marker.','Choose although or however.',array['policy'],12),
('b2-assess-c1','b2-assess',1,'Use "although" and "claim".','Contrast two ideas.',array['although','claim'],12),
('b2-assess-c2','b2-assess',2,'Use "however" and "evidence".','Use clear contrast punctuation.',array['however','evidence'],12),
('b2-assess-c3','b2-assess',3,'Use "policy" and one contrast marker.','Use formal contrast.',array['policy'],13),
('c1-01-c1','c1-01',1,'Write one sentence using "recommend" and "stakeholder".','Use a hedge like might/would.',array['recommend','stakeholder'],12),
('c1-01-c2','c1-01',2,'Write one sentence using "mitigate" and "risk".','Prefer formal register.',array['mitigate','risk'],12),
('c1-01-c3','c1-01',3,'Write one sentence using "timeline" and one hedge.','Use nuanced recommendation.',array['timeline'],12),
('c1-assess-c1','c1-assess',1,'Use "recommend" and "stakeholder".','Use hedging language.',array['recommend','stakeholder'],13),
('c1-assess-c2','c1-assess',2,'Use "mitigate" and "risk".','Use formal register.',array['mitigate','risk'],13),
('c1-assess-c3','c1-assess',3,'Use "timeline" and one hedge.','Use nuanced recommendation.',array['timeline'],13)
on conflict (id) do update set
  prompt = excluded.prompt,
  grammar_hint = excluded.grammar_hint,
  required_vocabulary = excluded.required_vocabulary,
  min_words = excluded.min_words;

