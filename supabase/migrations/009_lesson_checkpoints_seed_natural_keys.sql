-- =============================================================================
-- Bind ALL lesson_checkpoints to course_lessons by stable curriculum keys.
-- Matches: course slug englishfeed-core + unit.cefr_level + lesson_order +
--          (trim(title) OR grammar_point).
-- Does NOT rely on unit_order being 1..5 (your DB may differ).
-- Idempotent: ON CONFLICT (id) updates rows.
-- Run once in Supabase SQL Editor (or supabase db push).
-- =============================================================================

insert into public.lesson_checkpoints (
  id,
  lesson_id,
  checkpoint_order,
  prompt,
  grammar_hint,
  required_vocabulary,
  min_words
)
select distinct on (v.cp_id)
  v.cp_id,
  cl.id,
  v.cp_ord,
  v.prompt,
  v.grammar_hint,
  v.required_vocabulary,
  v.min_words
from (
  values
    -- A1 lesson
    ('a1-01-c1', 1, 'Daily Introductions', 'Simple present for introductions', 'A1', 1, 'Write one sentence with "name" and "from".', 'Use "My name is..." and "I am from...".', array['name','from']::text[], 7),
    ('a1-01-c2', 1, 'Daily Introductions', 'Simple present for introductions', 'A1', 2, 'Write one sentence with "live" and "work".', 'Use present simple: "I live..." and "I work...".', array['live','work']::text[], 7),
    ('a1-01-c3', 1, 'Daily Introductions', 'Simple present for introductions', 'A1', 3, 'Write one sentence with "student" and one earlier word.', 'Use simple present forms.', array['student']::text[], 8),
    ('a1-assess-c1', 99, 'A1 Cumulative Assessment', 'Simple present mastery', 'A1', 1, 'Use "name" and "from" in one sentence.', 'Use simple present.', array['name','from']::text[], 8),
    ('a1-assess-c2', 99, 'A1 Cumulative Assessment', 'Simple present mastery', 'A1', 2, 'Use "live" and "work" in one sentence.', 'Use simple present.', array['live','work']::text[], 8),
    ('a1-assess-c3', 99, 'A1 Cumulative Assessment', 'Simple present mastery', 'A1', 3, 'Use "student" plus one previous A1 word.', 'Use simple present.', array['student']::text[], 8),
    -- A2
    ('a2-01-c1', 1, 'Weekend Planning', 'Going to for plans', 'A2', 1, 'Write one sentence with "going to" and "weekend".', 'Use am/is/are going to + verb.', array['weekend']::text[], 8),
    ('a2-01-c2', 1, 'Weekend Planning', 'Going to for plans', 'A2', 2, 'Write one sentence with "visit" and "tomorrow".', 'Keep future plan grammar.', array['visit','tomorrow']::text[], 8),
    ('a2-01-c3', 1, 'Weekend Planning', 'Going to for plans', 'A2', 3, 'Write one sentence using "plan" and "travel".', 'Use both words in one thought.', array['plan','travel']::text[], 9),
    ('a2-assess-c1', 99, 'A2 Cumulative Assessment', 'Going to mastery', 'A2', 1, 'Use "going to" and "weekend".', 'Use future plan grammar.', array['weekend']::text[], 9),
    ('a2-assess-c2', 99, 'A2 Cumulative Assessment', 'Going to mastery', 'A2', 2, 'Use "visit" and "tomorrow".', 'Use future plan grammar.', array['visit','tomorrow']::text[], 9),
    ('a2-assess-c3', 99, 'A2 Cumulative Assessment', 'Going to mastery', 'A2', 3, 'Use "plan" and "travel".', 'Use future plan grammar.', array['plan','travel']::text[], 10),
    -- B1
    ('b1-01-c1', 1, 'Workplace Updates', 'Present perfect for recent updates', 'B1', 1, 'Write one sentence with present perfect and "project".', 'Use have/has + participle.', array['project']::text[], 9),
    ('b1-01-c2', 1, 'Workplace Updates', 'Present perfect for recent updates', 'B1', 2, 'Write one sentence with "deadline" and "issue".', 'Mention what has happened recently.', array['deadline','issue']::text[], 10),
    ('b1-01-c3', 1, 'Workplace Updates', 'Present perfect for recent updates', 'B1', 3, 'Write one sentence with "update" and "improve".', 'Use present perfect.', array['update','improve']::text[], 10),
    ('b1-assess-c1', 99, 'B1 Cumulative Assessment', 'Present perfect mastery', 'B1', 1, 'Use present perfect and "project".', 'Use have/has + participle.', array['project']::text[], 10),
    ('b1-assess-c2', 99, 'B1 Cumulative Assessment', 'Present perfect mastery', 'B1', 2, 'Use "deadline" and "issue".', 'Mention what has happened recently.', array['deadline','issue']::text[], 11),
    ('b1-assess-c3', 99, 'B1 Cumulative Assessment', 'Present perfect mastery', 'B1', 3, 'Use "update" and "improve".', 'Use present perfect.', array['update','improve']::text[], 11),
    -- B2
    ('b2-01-c1', 1, 'Opinion and Contrast', 'Complex contrast clauses', 'B2', 1, 'Write one sentence using "although" and "claim".', 'Contrast two ideas.', array['although','claim']::text[], 11),
    ('b2-01-c2', 1, 'Opinion and Contrast', 'Complex contrast clauses', 'B2', 2, 'Write one sentence using "however" and "evidence".', 'Use clear contrast punctuation.', array['however','evidence']::text[], 11),
    ('b2-01-c3', 1, 'Opinion and Contrast', 'Complex contrast clauses', 'B2', 3, 'Write one sentence using "policy" and one contrast marker.', 'Choose although or however.', array['policy']::text[], 12),
    ('b2-assess-c1', 99, 'B2 Cumulative Assessment', 'Contrast clause mastery', 'B2', 1, 'Use "although" and "claim".', 'Contrast two ideas.', array['although','claim']::text[], 12),
    ('b2-assess-c2', 99, 'B2 Cumulative Assessment', 'Contrast clause mastery', 'B2', 2, 'Use "however" and "evidence".', 'Use clear contrast punctuation.', array['however','evidence']::text[], 12),
    ('b2-assess-c3', 99, 'B2 Cumulative Assessment', 'Contrast clause mastery', 'B2', 3, 'Use "policy" and one contrast marker.', 'Use formal contrast.', array['policy']::text[], 13),
    -- C1
    ('c1-01-c1', 1, 'Strategic Recommendations', 'Hedging and formal recommendations', 'C1', 1, 'Write one sentence using "recommend" and "stakeholder".', 'Use a hedge like might/would.', array['recommend','stakeholder']::text[], 12),
    ('c1-01-c2', 1, 'Strategic Recommendations', 'Hedging and formal recommendations', 'C1', 2, 'Write one sentence using "mitigate" and "risk".', 'Prefer formal register.', array['mitigate','risk']::text[], 12),
    ('c1-01-c3', 1, 'Strategic Recommendations', 'Hedging and formal recommendations', 'C1', 3, 'Write one sentence using "timeline" and one hedge.', 'Use nuanced recommendation.', array['timeline']::text[], 12),
    ('c1-assess-c1', 99, 'C1 Cumulative Assessment', 'Hedging mastery', 'C1', 1, 'Use "recommend" and "stakeholder".', 'Use hedging language.', array['recommend','stakeholder']::text[], 13),
    ('c1-assess-c2', 99, 'C1 Cumulative Assessment', 'Hedging mastery', 'C1', 2, 'Use "mitigate" and "risk".', 'Use formal register.', array['mitigate','risk']::text[], 13),
    ('c1-assess-c3', 99, 'C1 Cumulative Assessment', 'Hedging mastery', 'C1', 3, 'Use "timeline" and one hedge.', 'Use nuanced recommendation.', array['timeline']::text[], 13)
) as v(
  cp_id text,
  lesson_order int,
  title text,
  grammar_point text,
  cefr_level text,
  cp_ord int,
  prompt text,
  grammar_hint text,
  required_vocabulary text[],
  min_words int
)
join public.courses co on co.slug = 'englishfeed-core'
join public.course_units u on u.course_id = co.id and u.cefr_level = v.cefr_level
join public.course_lessons cl
  on cl.unit_id = u.id
  and cl.lesson_order = v.lesson_order
  and cl.cefr_level = v.cefr_level
  and (
    btrim(cl.title) = btrim(v.title)
    or cl.grammar_point = v.grammar_point
  )
order by v.cp_id, u.unit_order, cl.id
on conflict (id) do update set
  lesson_id = excluded.lesson_id,
  checkpoint_order = excluded.checkpoint_order,
  prompt = excluded.prompt,
  grammar_hint = excluded.grammar_hint,
  required_vocabulary = excluded.required_vocabulary,
  min_words = excluded.min_words;
