/**
 * Reads scripts/output/subtitles.json and vocabulary.json, builds a Lesson, writes to src/data/lessons.json
 * Run after generate:vocab: npm run generate:lesson
 */

import "dotenv/config";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });

const OUTPUT_DIR = path.join(__dirname, "output");
const SUBTITLES_PATH = path.join(OUTPUT_DIR, "subtitles.json");
const VOCAB_PATH = path.join(OUTPUT_DIR, "vocabulary.json");
const LESSONS_OUTPUT_PATH = path.resolve(__dirname, "..", "src", "data", "lessons.json");

interface SubtitleSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

interface SubtitlesJson {
  text: string;
  duration?: number;
  segments: SubtitleSegment[];
}

interface VocabularyItem {
  word: string;
  meaning: string;
  example?: string;
}

interface VocabularyOutput {
  vocabulary: VocabularyItem[];
}

type EnglishLevel = "beginner" | "intermediate" | "advanced";

interface Lesson {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  level: EnglishLevel;
  durationSeconds: number;
  vocabulary?: VocabularyItem[];
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "lesson";
}

function main() {
  if (!fs.existsSync(SUBTITLES_PATH)) {
    console.error(`Subtitles not found: ${SUBTITLES_PATH}`);
    console.error("Run npm run generate:transcript first.");
    process.exit(1);
  }

  if (!fs.existsSync(VOCAB_PATH)) {
    console.error(`Vocabulary not found: ${VOCAB_PATH}`);
    console.error("Run npm run generate:vocab first.");
    process.exit(1);
  }

  const subtitlesRaw = fs.readFileSync(SUBTITLES_PATH, "utf-8");
  const vocabRaw = fs.readFileSync(VOCAB_PATH, "utf-8");
  const subtitles: SubtitlesJson = JSON.parse(subtitlesRaw);
  const vocabData: VocabularyOutput = JSON.parse(vocabRaw);

  const fullText = subtitles.text ?? subtitles.segments.map((s) => s.text).join(" ");
  const durationSeconds = Math.ceil(subtitles.duration ?? 0);
  const vocabulary = Array.isArray(vocabData.vocabulary) ? vocabData.vocabulary : [];

  const firstSentence = fullText.trim().split(/[.!?]/)[0]?.trim() || "English lesson";
  const title = firstSentence.slice(0, 60).trim();
  const description = fullText.slice(0, 120).trim().replace(/\s+/g, " ");
  const id = slugify(title);

  const lesson: Lesson = {
    id,
    title,
    description,
    videoUrl: "https://res.cloudinary.com/YOUR_CLOUD_NAME/video/upload/YOUR_VIDEO_ID.mp4",
    level: "beginner",
    durationSeconds: durationSeconds || 60,
    vocabulary: vocabulary.map((v) => ({
      word: v.word ?? "",
      meaning: v.meaning ?? "",
      example: v.example,
    })),
  };

  const lessons: Lesson[] = [lesson];
  const outDir = path.dirname(LESSONS_OUTPUT_PATH);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  fs.writeFileSync(LESSONS_OUTPUT_PATH, JSON.stringify(lessons, null, 2), "utf-8");
  console.log(`Wrote 1 lesson to ${LESSONS_OUTPUT_PATH}`);
}

main();
