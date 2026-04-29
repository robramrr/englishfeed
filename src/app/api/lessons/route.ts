import path from "path";
import { NextRequest, NextResponse } from "next/server";
import type { EnglishLevel, Lesson } from "@/types/lesson";
import { filterLessonsByLevel } from "@/lib/lessonFilter";
import {
  generateSubtitlesForVideo,
  needsSubtitleGeneration,
} from "@/lib/generateSubtitlesForVideo";
import lessonsFromJson from "@/data/lessons.json";
import { sampleLessons } from "@/data/sample-lessons";

const BATCH_SIZE = 10;
const VALID_LEVELS: EnglishLevel[] = ["beginner", "intermediate", "advanced"];

const generating = new Set<string>();

/** Whisper subtitle autogeneration on every lessons list fetch is expensive. Opt in with 1/true. */
function subtitleAutogenOnLessonsFetchEnabled(): boolean {
  const v = process.env.SUBTITLE_AUTOGEN_ON_LESSONS;
  return v === "1" || v === "true";
}

function getCombinedLessons(): Lesson[] {
  const fromJson =
    Array.isArray(lessonsFromJson) && lessonsFromJson.length > 0
      ? (lessonsFromJson as Lesson[])
      : [];
  return fromJson.length > 0 ? fromJson : sampleLessons;
}

function getVideoFilenameFromUrl(videoUrl: string): string | null {
  try {
    const u = new URL(videoUrl);
    const name = path.basename(u.pathname);
    return name && name.includes(".") ? name : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const levelParam = searchParams.get("level");
  const cursorParam = searchParams.get("cursor");

  const level = VALID_LEVELS.includes(levelParam as EnglishLevel)
    ? (levelParam as EnglishLevel)
    : "beginner";

  let cursor = 0;
  if (cursorParam != null && cursorParam !== "") {
    const parsed = Number.parseInt(cursorParam, 10);
    if (Number.isFinite(parsed) && parsed >= 0) cursor = parsed;
  }

  const combined = getCombinedLessons();
  const filtered = filterLessonsByLevel(combined, level);
  const lessons = filtered.slice(cursor, cursor + BATCH_SIZE);
  const nextCursor =
    cursor + BATCH_SIZE < filtered.length ? cursor + BATCH_SIZE : null;

  if (subtitleAutogenOnLessonsFetchEnabled()) {
    const allLessons = getCombinedLessons();
    const seen = new Set<string>();
    for (const lesson of allLessons) {
      const filename = getVideoFilenameFromUrl(lesson.videoUrl);
      if (!filename || seen.has(filename) || generating.has(filename)) continue;
      if (!needsSubtitleGeneration(filename)) continue;
      seen.add(filename);
      generating.add(filename);
      generateSubtitlesForVideo(filename)
        .catch((err) => {
          console.error(
            `[lessons] Subtitle generation failed for ${filename}:`,
            err
          );
        })
        .finally(() => {
          generating.delete(filename);
        });
    }
  }

  return NextResponse.json({ lessons, nextCursor });
}
