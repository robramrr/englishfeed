import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import OpenAI from "openai";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  flashcardObjectKey,
  isR2FlashcardConfigured,
  tryHeadExistingFlashcardPublicUrl,
  uploadFlashcardPngToR2,
} from "@/lib/r2FlashcardUpload";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const CACHE_TYPE = "vocab_flashcard";
const MAX_WORD_LEN = 48;

/**
 * When R2 is off, responses use `data:image/...;base64,...`. Allow caching those only
 * below this size so `ai_cache` rows stay reasonable for Postgres/Supabase.
 */
const MAX_CACHED_DATA_IMAGE_URL_CHARS = 1_500_000;

function shouldPersistFlashcardToAiCache(imageUrl: string): boolean {
  if (imageUrl.startsWith("http")) return true;
  return (
    imageUrl.startsWith("data:image/") &&
    imageUrl.length > 0 &&
    imageUrl.length <= MAX_CACHED_DATA_IMAGE_URL_CHARS
  );
}

/**
 * Default dall-e-3 follows “no text in image” much better than dall-e-2.
 * Set VOCAB_FLASHCARD_IMAGE_MODEL=dall-e-2 for faster 512px images (more risk of stray text).
 */
function flashcardImageModel(): "dall-e-2" | "dall-e-3" {
  return process.env.VOCAB_FLASHCARD_IMAGE_MODEL === "dall-e-2"
    ? "dall-e-2"
    : "dall-e-3";
}

function flashcardInputHash(word: string, model: string): string {
  const key = `vocab_flashcard:v7:${model}:${word.toLowerCase().trim()}`;
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Scene-first hints for words that models often illustrate with on-image text
 * or overly literal objects (compass for "quick", globe for "order", etc.).
 */
const WORD_SCENE_HINTS: Record<string, string> = {
  quick:
    "speed and urgency: a runner mid-stride with motion blur, or a fast bicycle whooshing past, clear sense of rapid movement",
  order:
    "restaurant: customer at a plain table raising one hand; waiter silhouette approaching with a covered cloche or empty tray—no menus, checks, notepads, or paper",
  fast: "something clearly moving very fast with motion lines or blur (runner, race car, swift bird in flight)",
  slow: "a relaxed tortoise, snail, or person strolling slowly—emphasis on unhurried pace",
  minute:
    "a clock face showing a single hand between ticks (no numerals or digits visible), or a short sand timer—suggest brief duration without any numbers",
  second: "a stopwatch silhouette with no readable digits, or a starting pistol and sprint start—suggest a very short moment",
  present:
    "someone handing a wrapped gift box with a bow (gift sense), not a lecture hall",
  bark: "rough tree bark texture close-up on a trunk (the covering of a tree)",
  bank: "a riverbank with grass and water, or a simple teller counter with no signage or text",
  spring: "coiled metal spring or cherry blossoms in bloom—pick the more common classroom sense for the level",
  fair: "a sunny outdoor fair with tents and rides in the distance, no banners with writing",
  row: "a small boat with oars in calm water, people rowing together",
  kind: "one person helping another up, or sharing food—warmth and generosity",
  light: "sunbeam through a window or a simple glowing lamp—illumination, not weight",
  watch: "wristwatch on an arm with a blank face (no numbers or letters), or someone looking attentively",
  match: "two matching socks or a lit matchstick—choose the clearest single reading",
  train:
    "simple train silhouette on parallel tracks, empty sky—no station, platform signs, or destination boards",
  can: "a metal food can with a plain label area that is completely blank (no words, no logo)",
  book: "closed book with a plain colored cover—no title, spine text, or pages of writing visible",
  note: "a folded paper slip on a table with no writing visible, or musical notes as simple shapes without letters",
  sign: "a blank wooden directional post with empty arrow shapes—no words on them",
  world: "simple Earth globe as geography only—no words, labels, or country names on it",
  compass: "handheld hiking compass with a blank face or illegible markings—no readable letters or degree numbers",
  map: "folded paper map with only colored regions and lines—no place names or text",
  key: "a single metal door key on a table",
  scale: "bathroom scale showing a blank display (no digits), or balancing scales without labels",
  ruler: "a plain wooden ruler with tick marks only—no numbers printed on it",
  clock: "round wall clock with blank face or hands only—no numerals or text",
};

/** DALL·E 2 hard limit; DALL·E 3 allows up to ~4000. */
const DALLE2_PROMPT_MAX = 1000;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True if the description accidentally contains the lesson term (substring or whole word for short terms). */
function descriptionContainsForbidden(text: string, term: string): boolean {
  const t = text.toLowerCase();
  const w = term.toLowerCase().trim();
  if (!w || !text.trim()) return true;
  if (w.length <= 2) {
    return new RegExp(`\\b${escapeRegExp(w)}\\b`, "i").test(text);
  }
  if (t.includes(w)) return true;
  for (const part of w.split(/\s+/)) {
    if (part.length > 2 && t.includes(part)) return true;
  }
  return false;
}

/** If the lemma appears inside the hint (e.g. riverbank / bank), do not pass hint to DALL·E—it can trigger on-image text. */
function hintContainsLemmaSubstring(hint: string, word: string): boolean {
  const w = word.toLowerCase().trim();
  if (!w) return true;
  if (w.length < 3) {
    return new RegExp(`\\b${escapeRegExp(w)}\\b`, "i").test(hint);
  }
  return hint.toLowerCase().includes(w);
}

/**
 * One sentence of what to draw, without naming the target word (reduces DALL·E spelling it on-canvas).
 */
async function visualDescriptionWithoutTargetWord(
  word: string,
  sceneHint: string | undefined
): Promise<string> {
  if (!openai) return "";

  const hintBlock = sceneHint
    ? `Art-direction hint (do not write any of this as text in your answer—only for understanding): ${sceneHint}`
    : "";

  const normalize = (s: string) => s.trim().replace(/^["']|["']$/g, "");

  const completion1 = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "You output exactly one short English sentence: what a simple vocabulary flashcard drawing should depict (objects, colors, action, setting). Rules: no quotation marks in your output; your sentence must NOT contain the vocabulary term as any substring; for multi-word terms, omit every word of that term; describe only concrete visuals.",
      },
      {
        role: "user",
        content: `Vocabulary term (never include this in your sentence): ${word}\n${hintBlock}\nOne sentence: what to draw.`,
      },
    ],
    max_tokens: 120,
  });

  let text = normalize(
    completion1.choices[0]?.message?.content ?? ""
  );
  if (text.length >= 12 && !descriptionContainsForbidden(text, word)) {
    return text;
  }

  const completion2 = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content:
          "Output one short sentence of pure visual description for a drawing. Never type the forbidden vocabulary word or its parts (not even inside other words).",
      },
      {
        role: "user",
        content: `Forbidden term: ${word}. ${hintBlock}\nDescribe only shapes and objects to draw in one sentence. Do not use the forbidden term.`,
      },
    ],
    max_tokens: 120,
  });

  text = normalize(completion2.choices[0]?.message?.content ?? "");
  if (text.length >= 12 && !descriptionContainsForbidden(text, word)) {
    return text;
  }

  return "";
}

function noTextRulesShort(): string {
  return "STRICT: absolutely NO text in the image—no letters, numbers, words, typography, captions, labels, signs, logos, speech bubbles, book/screen writing, watermarks, or readable characters. Illustration only.";
}

function noTextRulesLong(): string {
  return [
    "HARD RULE: The picture must be 100% non-verbal. Zero readable characters anywhere in the frame.",
    "Do not write the vocabulary answer. Do not write any English or other language. No labels, titles, captions, posters, packaging text, clothing text, UI text, chalkboards, neon, handwriting, or decorative lettering.",
    "Only silent drawings: objects, people, and scenes with blank surfaces where text could have appeared.",
  ].join(" ");
}

const styleSimpleD2 =
  "Style: plain educational flashcard—one large clear subject, simple clipart / workbook drawing, white or very light background, minimal detail, easy to recognize. Not poster art, not decorative.";

const styleSimpleD3 =
  "Style: simple ESL vocabulary picture—one obvious subject or interaction, centered, plain white or cream background, soft colors, light outlines OK, minimal shading. Teaching clipart, not artwork.";

/** DALL·E prompt that never names the target word (uses lexeme-free visual sentence from GPT). */
function flashcardPromptLexemeFree(visualPhrase: string, model: "dall-e-2" | "dall-e-3"): string {
  const body = `Draw exactly this as a silent picture (no words, letters, or numbers anywhere): ${visualPhrase}`;

  if (model === "dall-e-2") {
    const p = [
      noTextRulesShort(),
      body,
      styleSimpleD2,
      "The drawing must contain zero glyphs. No spelling of any vocabulary term.",
    ].join(" ");
    if (p.length <= DALLE2_PROMPT_MAX) return p;
    const cap = DALLE2_PROMPT_MAX - 220;
    const shortBody =
      body.length > cap ? `${body.slice(0, cap).trim()}…` : body;
    const q = [noTextRulesShort(), shortBody, styleSimpleD2].join(" ");
    return q.length <= DALLE2_PROMPT_MAX
      ? q
      : q.slice(0, DALLE2_PROMPT_MAX - 3) + "...";
  }

  return [
    noTextRulesLong(),
    body,
    styleSimpleD3,
    noTextRulesShort(),
    "Do not add titles, labels, or the answer as text. Wordless illustration only.",
  ].join(" ");
}

/** Fallback: target word appears once only; stronger bookends. */
function flashcardPromptFallback(
  word: string,
  model: "dall-e-2" | "dall-e-3",
  hint: string | undefined
): string {
  const core = hint
    ? `Silent drawing for English concept ${word}. Scene guidance: ${hint}`
    : `One clear everyday referent for English concept ${word}. Wordless picture only—no characters or lettering.`;

  if (model === "dall-e-2") {
    const p = [
      "STRICT NO TEXT anywhere in the image. No letters or words.",
      core,
      styleSimpleD2,
      "Never render the vocabulary term as readable characters.",
    ].join(" ");
    if (p.length <= DALLE2_PROMPT_MAX) return p;
    return p.slice(0, DALLE2_PROMPT_MAX - 3) + "...";
  }

  return [
    noTextRulesLong(),
    "The vocabulary answer must never appear as written text in the image.",
    core,
    styleSimpleD3,
    noTextRulesShort(),
    "Final: zero typography. Illustration only.",
  ].join(" ");
}

async function buildFlashcardPrompt(
  word: string,
  model: "dall-e-2" | "dall-e-3"
): Promise<string> {
  const key = word.toLowerCase().trim();
  const hint = WORD_SCENE_HINTS[key];

  const useLexemeFree =
    process.env.VOCAB_FLASHCARD_SKIP_LEXEME_FREE_PROMPT !== "1";

  if (useLexemeFree) {
    try {
      const phrase = await visualDescriptionWithoutTargetWord(word, hint);
      if (phrase) {
        return flashcardPromptLexemeFree(phrase, model);
      }
    } catch (e) {
      console.warn("vocab-flashcard-image lexeme-free description:", e);
    }
  }

  const safeHint =
    hint && !hintContainsLemmaSubstring(hint, word) ? hint : undefined;
  return flashcardPromptFallback(word, model, safeHint);
}

type GeneratedPayload = { imageUrl: string; word: string; cached: boolean };

const inflightByHash = new Map<string, Promise<GeneratedPayload>>();

async function generateAndStoreImage(
  word: string,
  inputHash: string,
  model: "dall-e-2" | "dall-e-3",
  supabase: ReturnType<typeof getSupabaseServer> | null
): Promise<GeneratedPayload> {
  if (!openai) {
    throw new Error("Image generation unavailable (no OPENAI_API_KEY)");
  }

  const prompt = await buildFlashcardPrompt(word, model);

  const img =
    model === "dall-e-3"
      ? await openai.images.generate({
          model: "dall-e-3",
          prompt,
          n: 1,
          size: "1024x1024",
          response_format: "b64_json",
          quality: "standard",
          style: "natural",
        })
      : await openai.images.generate({
          model: "dall-e-2",
          prompt,
          n: 1,
          size: "512x512",
          response_format: "b64_json",
        });

  const b64 = img.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("Empty image response");
  }

  const buffer = Buffer.from(b64, "base64");
  const objectKey = flashcardObjectKey(word, inputHash);

  let imageUrl: string | null = null;
  if (isR2FlashcardConfigured()) {
    imageUrl = await uploadFlashcardPngToR2(objectKey, buffer);
  }

  if (!imageUrl) {
    imageUrl = `data:image/png;base64,${b64}`;
  }

  if (supabase && shouldPersistFlashcardToAiCache(imageUrl)) {
    const { error: cacheErr } = await supabase.from("ai_cache").insert({
      type: CACHE_TYPE,
      input_hash: inputHash,
      input_text: word,
      result: { imageUrl },
    });
    if (cacheErr) {
      console.warn("vocab-flashcard-image cache insert:", cacheErr.message);
    }
  }

  return { imageUrl, word, cached: false };
}

export async function GET(request: NextRequest) {
  const rate = await checkRateLimit(request, {
    route: "vocab-flashcard-image",
    limit: 24,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  const raw = request.nextUrl.searchParams.get("word")?.trim() ?? "";
  const word = raw.replace(/\s+/g, " ");
  if (!word || word.length > MAX_WORD_LEN) {
    return NextResponse.json({ error: "Invalid word" }, { status: 400 });
  }

  const model = flashcardImageModel();
  const inputHash = flashcardInputHash(word, model);

  let supabase: ReturnType<typeof getSupabaseServer> | null = null;
  try {
    supabase = getSupabaseServer();
  } catch {
    supabase = null;
  }

  if (supabase) {
    const { data: cached, error: cacheReadErr } = await supabase
      .from("ai_cache")
      .select("result")
      .eq("type", CACHE_TYPE)
      .eq("input_hash", inputHash)
      .maybeSingle();

    if (cacheReadErr) {
      console.warn("vocab-flashcard-image cache read:", cacheReadErr.message);
    } else {
      const url =
        cached &&
        typeof cached.result === "object" &&
        cached.result !== null &&
        typeof (cached.result as { imageUrl?: string }).imageUrl === "string"
          ? (cached.result as { imageUrl: string }).imageUrl
          : null;
      if (url) {
        return NextResponse.json({ imageUrl: url, word, cached: true });
      }
    }
  }

  const r2Existing = await tryHeadExistingFlashcardPublicUrl(word, inputHash);
  if (r2Existing) {
    if (supabase) {
      const { error: healErr } = await supabase.from("ai_cache").insert({
        type: CACHE_TYPE,
        input_hash: inputHash,
        input_text: word,
        result: { imageUrl: r2Existing },
      });
      if (healErr && healErr.code !== "23505") {
        console.warn("vocab-flashcard-image R2 heal insert:", healErr.message);
      }
    }
    return NextResponse.json({
      imageUrl: r2Existing,
      word,
      cached: true,
    });
  }

  if (!openai) {
    return NextResponse.json(
      { error: "Image generation unavailable (no OPENAI_API_KEY)" },
      { status: 503 }
    );
  }

  try {
    let gen = inflightByHash.get(inputHash);
    if (!gen) {
      gen = generateAndStoreImage(word, inputHash, model, supabase).finally(
        () => {
          inflightByHash.delete(inputHash);
        }
      );
      inflightByHash.set(inputHash, gen);
    }

    const payload = await gen;
    return NextResponse.json(payload);
  } catch (e) {
    console.error("vocab-flashcard-image:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Image generation failed" },
      { status: 502 }
    );
  }
}
