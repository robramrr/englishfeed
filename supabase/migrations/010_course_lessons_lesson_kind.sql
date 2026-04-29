-- =============================================================================
-- Align course_lessons with app + seed 004: lesson_kind (lesson | assessment)
-- Safe if column already exists (IF NOT EXISTS).
-- =============================================================================

alter table public.course_lessons
  add column if not exists lesson_kind text not null default 'lesson';

alter table public.course_lessons
  drop constraint if exists course_lessons_lesson_kind_check;

alter table public.course_lessons
  add constraint course_lessons_lesson_kind_check
  check (lesson_kind in ('lesson', 'assessment'));

update public.course_lessons
set lesson_kind = 'assessment'
where lesson_order = 99
   or title like '%Cumulative Assessment%';
