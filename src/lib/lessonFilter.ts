import type { EnglishLevel, Lesson } from "@/types/lesson";

/**
 * Filters lessons by maximum level (inclusive).
 * - beginner → only beginner
 * - intermediate → beginner + intermediate
 * - advanced → all lessons
 */
const LEVEL_ORDER: EnglishLevel[] = ["beginner", "intermediate", "advanced"];

function levelIndex(level: EnglishLevel): number {
  const i = LEVEL_ORDER.indexOf(level);
  return i >= 0 ? i : 0;
}

export function filterLessonsByLevel(
  lessons: Lesson[],
  maxLevel: EnglishLevel
): Lesson[] {
  const max = levelIndex(maxLevel);
  return lessons.filter((lesson) => {
    const lessonLevel = lesson.level ?? "beginner";
    return levelIndex(lessonLevel) <= max;
  });
}
