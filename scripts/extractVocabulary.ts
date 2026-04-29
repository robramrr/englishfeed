/**
 * Loads scripts/output/subtitles.json, extracts vocabulary via OpenAI, saves to scripts/output/vocabulary.json
 * Run after generate:transcript: npm run generate:vocab
 * Requires: OPENAI_API_KEY
 */

import "dotenv/config";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import OpenAI from "openai";

dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });

const OUTPUT_DIR = path.join(__dirname, "output");
const SUBTITLES_PATH = path.join(OUTPUT_DIR, "subtitles.json");
const VOCAB_OUTPUT_PATH = path.join(OUTPUT_DIR, "vocabulary.json");

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
  example: string;
}

interface VocabularyOutput {
  vocabulary: VocabularyItem[];
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY environment variable.");
  }

  if (!fs.existsSync(SUBTITLES_PATH)) {
    console.error(`Subtitles not found: ${SUBTITLES_PATH}`);
    console.error("Run npm run generate:transcript first.");
    process.exit(1);
  }

  const raw = fs.readFileSync(SUBTITLES_PATH, "utf-8");
  const data: SubtitlesJson = JSON.parse(raw);
  const combinedText = data.text ?? data.segments.map((s) => s.text).join(" ");

  if (!combinedText.trim()) {
    console.error("No transcript text to extract vocabulary from.");
    process.exit(1);
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const systemPrompt = `You are an English teaching assistant. Given a transcript, extract useful vocabulary for English learners.
Return ONLY a single valid JSON object with this exact shape (no markdown, no code fence):
{"vocabulary":[{"word":"","meaning":"","example":""}]}
- word: the word or short phrase
- meaning: clear, simple definition
- example: one example sentence using the word (optional but preferred when possible)
Include 5-15 items. Prefer phrases and high-value learning words.`;

  console.log("Extracting vocabulary with gpt-4.1...");
  const completion = await openai.chat.completions.create({
    model: "gpt-4.1",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Transcript:\n\n${combinedText.slice(0, 12000)}` },
    ],
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    console.error("No response from OpenAI.");
    process.exit(1);
  }

  let parsed: VocabularyOutput;
  try {
    parsed = JSON.parse(content) as VocabularyOutput;
  } catch {
    console.error("Invalid JSON in model response.");
    process.exit(1);
  }

  if (!Array.isArray(parsed.vocabulary)) {
    parsed = { vocabulary: [] };
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  fs.writeFileSync(VOCAB_OUTPUT_PATH, JSON.stringify(parsed, null, 2), "utf-8");
  console.log(`Saved ${parsed.vocabulary.length} vocabulary items to ${VOCAB_OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
