import type { EnglishLevel, Lesson } from "@/types/lesson";
import lessonsFromJson from "@/data/lessons.json";
import { sampleLessons } from "@/data/sample-lessons";
import { filterLessonsByLevel } from "@/lib/lessonFilter";

export function getCombinedLessons(): Lesson[] {
  const fromJson =
    Array.isArray(lessonsFromJson) && lessonsFromJson.length > 0
      ? (lessonsFromJson as Lesson[])
      : [];
  return fromJson.length > 0 ? fromJson : sampleLessons;
}

/** Same as feed: lessons for this level (used by tag page to show only feed-visible lessons). */
export function getLessonsForLevel(level: EnglishLevel): Lesson[] {
  return filterLessonsByLevel(getCombinedLessons(), level);
}

export function getLessonById(lessonId: string): Lesson | undefined {
  return getCombinedLessons().find((l) => l.id === lessonId);
}
