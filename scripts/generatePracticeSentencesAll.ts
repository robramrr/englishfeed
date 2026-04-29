/**
 * Generate pronunciation practice sentences for all lessons based on their subtitles.
 *
 * For each lesson in src/data/lessons.json that has a subtitlesUrl and a subtitles
 * file in public/subtitles, this script:
 * - Loads the subtitle JSON
 * - Builds a transcript by joining segment text
 * - Calls generatePracticeSentences(transcript)
 * - Writes the resulting sentences back to lesson.practiceSentences
 *
 * Run after subtitles exist, e.g.:
 *   npm run generate:subtitles
 *   npm run generate:practice-sentences
 */

import "dotenv/config";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { generatePracticeSentences } from "../src/lib/generatePracticeSentences";

dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });

const LESSONS_PATH = path.resolve(
  __dirname,
  "..",
  "src",
  "data",
  "lessons.json"
);

interface SubtitleSegment {
  id?: number;
  start?: number;
  end?: number;
  text?: string;
}

interface SubtitlesJson {
  segments?: SubtitleSegment[];
}

interface LessonJson {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  level: string;
  durationSeconds: number;
  subtitlesUrl?: string;
  practiceSentences?: string[];
  [key: string]: unknown;
}

async function main() {
  if (!fs.existsSync(LESSONS_PATH)) {
    console.error(`Lessons file not found: ${LESSONS_PATH}`);
    process.exit(1);
  }

  const rawLessons = fs.readFileSync(LESSONS_PATH, "utf-8");
  let lessons: LessonJson[];
  try {
    const parsed = JSON.parse(rawLessons);
    if (!Array.isArray(parsed)) {
      console.error("Expected lessons.json to contain an array.");
      process.exit(1);
    }
    lessons = parsed as LessonJson[];
  } catch (e) {
    console.error("Failed to parse lessons.json:", e);
    process.exit(1);
  }

  let updatedCount = 0;

  for (const lesson of lessons) {
    if (!lesson.subtitlesUrl) {
      continue;
    }

    const subtitlesPath = path.resolve(
      __dirname,
      "..",
      "public",
      lesson.subtitlesUrl.replace(/^\//, "")
    );

    if (!fs.existsSync(subtitlesPath)) {
      console.warn(
        `Skipping ${lesson.id}: subtitles file not found at ${subtitlesPath}`
      );
      continue;
    }

    let subtitlesRaw: string;
    try {
      subtitlesRaw = fs.readFileSync(subtitlesPath, "utf-8");
    } catch (e) {
      console.warn(
        `Skipping ${lesson.id}: failed to read subtitles file:`,
        e
      );
      continue;
    }

    let subtitlesJson: SubtitlesJson;
    try {
      subtitlesJson = JSON.parse(subtitlesRaw) as SubtitlesJson;
    } catch (e) {
      console.warn(
        `Skipping ${lesson.id}: invalid subtitles JSON at ${subtitlesPath}:`,
        e
      );
      continue;
    }

    const segments = Array.isArray(subtitlesJson.segments)
      ? subtitlesJson.segments
      : [];
    const transcript = segments
      .map((s) => (typeof s.text === "string" ? s.text : ""))
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (!transcript) {
      console.warn(`Skipping ${lesson.id}: empty transcript from subtitles.`);
      continue;
    }

    console.log(
      `Generating practice sentences for lesson ${lesson.id} (${lesson.title})...`
    );
    const sentences = await generatePracticeSentences(transcript);
    if (!sentences.length) {
      console.warn(
        `AI did not return any valid practice sentences for lesson ${lesson.id}.`
      );
      continue;
    }

    lesson.practiceSentences = sentences;
    updatedCount += 1;
  }

  fs.writeFileSync(LESSONS_PATH, JSON.stringify(lessons, null, 2), "utf-8");
  console.log(
    `Updated practiceSentences for ${updatedCount} lesson(s) in ${LESSONS_PATH}`
  );
}

main().catch((err) => {
  console.error("Unexpected error generating practice sentences:", err);
  process.exit(1);
});

