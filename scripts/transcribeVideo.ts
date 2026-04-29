/**
 * Transcribes video.mp4 using OpenAI Whisper with word-level timestamps.
 * Saves to scripts/output/subtitles.json with real timestamps.
 * Run from repo root: npm run generate:transcript
 * Requires: OPENAI_API_KEY, video.mp4 at project root
 */

import "dotenv/config";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import OpenAI from "openai";

dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });

const PROJECT_ROOT = path.resolve(__dirname, "..");
const VIDEO_PATH = path.join(PROJECT_ROOT, "video.mp4");
const OUTPUT_DIR = path.join(__dirname, "output");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "subtitles.json");

interface WordTiming {
  word: string;
  start: number;
  end: number;
}

interface VerboseSegment {
  id?: number;
  start?: number;
  end?: number;
  text?: string;
  words?: Array<{ word?: string; start?: number; end?: number }>;
}

interface VerboseTranscription {
  text?: string;
  duration?: number;
  segments?: VerboseSegment[];
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY environment variable.");
  }

  if (!fs.existsSync(VIDEO_PATH)) {
    console.error(`Video file not found: ${VIDEO_PATH}`);
    console.error("Place your video file as video.mp4 at the project root.");
    process.exit(1);
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  console.log("Transcribing video with Whisper (word-level timestamps)...");
  const response = await openai.audio.transcriptions.create({
    file: fs.createReadStream(VIDEO_PATH),
    model: "whisper-1",
    response_format: "verbose_json",
    timestamp_granularities: ["word"],
  });

  const data = response as unknown as VerboseTranscription;
  const fullText = data.text ?? "";
  const rawSegments = data.segments ?? [];
  const duration = data.duration ?? 0;

  // Extract word-level timestamps (flat array)
  const words: WordTiming[] = [];
  for (const seg of rawSegments) {
    if (seg.words?.length) {
      for (const w of seg.words) {
        const word = (w.word ?? "").trim();
        if (word) {
          words.push({
            word,
            start: typeof w.start === "number" ? w.start : 0,
            end: typeof w.end === "number" ? w.end : 0,
          });
        }
      }
    }
  }

  // Build subtitle segments from API segments (real timestamps)
  const segments = rawSegments
    .filter((seg) => (seg.text ?? "").trim())
    .map((seg, id) => ({
      id,
      start: Math.round((seg.start ?? 0) * 100) / 100,
      end: Math.round((seg.end ?? 0) * 100) / 100,
      text: (seg.text ?? "").trim(),
    }));

  const output = {
    text: fullText,
    duration,
    segments,
    words,
  };

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf-8");
  console.log(
    `Saved ${segments.length} segments, ${words.length} words to ${OUTPUT_PATH}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
