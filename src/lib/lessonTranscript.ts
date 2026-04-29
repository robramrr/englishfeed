import path from "path";
import fs from "fs";
import type { Lesson } from "@/types/lesson";

type SubtitleSegment = { text?: string };

/**
 * Build a single transcript string from the lesson's subtitle JSON on disk.
 * Same shape as generate-practice uses.
 */
export function getLessonTranscript(lesson: Lesson): string | null {
  if (!lesson.subtitlesUrl) return null;
  const subtitlesPath = path.join(
    process.cwd(),
    "public",
    lesson.subtitlesUrl.replace(/^\//, "")
  );
  let raw: string;
  try {
    raw = fs.readFileSync(subtitlesPath, "utf-8");
  } catch {
    return null;
  }
  let data: { segments?: SubtitleSegment[] };
  try {
    data = JSON.parse(raw) as { segments?: SubtitleSegment[] };
  } catch {
    return null;
  }
  const segments = Array.isArray(data.segments) ? data.segments : [];
  const transcript = segments
    .map((s) => (typeof s.text === "string" ? s.text : ""))
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return transcript || null;
}
