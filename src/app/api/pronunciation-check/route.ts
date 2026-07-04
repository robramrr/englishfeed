import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { checkRateLimit } from "@/lib/rateLimit";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export type PronunciationFeedbackItem = {
  word: string;
  correct: boolean;
};

export type PronunciationCheckResponse = {
  score: number;
  transcript: string;
  feedback: PronunciationFeedbackItem[];
  accentInsight?: {
    shortLine: string;
    likelyAccent: string;
    confidence: "low" | "medium" | "high";
    summary: string;
    tips: string[];
  };
};

function normalizeForCompare(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,?!:;'"()[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(s: string): string[] {
  return normalizeForCompare(s).split(/\s+/).filter(Boolean);
}

function isAccentFeatureEnabled(): boolean {
  const v = process.env.EXPERIMENTAL_ACCENT_CARD;
  return v === "1" || v === "true";
}

function normalizeSimpleText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isTranscriptEcho(candidate: string, transcript: string, expected: string): boolean {
  const c = normalizeSimpleText(candidate);
  const t = normalizeSimpleText(transcript);
  const e = normalizeSimpleText(expected);
  if (!c) return true;
  if (c === t || c === e) return true;

  const cWords = c.split(" ").filter(Boolean);
  const tSet = new Set(t.split(" ").filter(Boolean));
  if (cWords.length >= 4) {
    const overlap = cWords.filter((w) => tSet.has(w)).length;
    if (overlap / cWords.length >= 0.7) return true;
  }
  return false;
}

function normalizeShortLine(
  text: string,
  maxChars: number,
  transcript: string,
  expected: string,
): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  const clean = normalized.replace(/[.!?]+$/, "");
  const fallback = "Accent influence is subtle; keep practicing key contrast sounds.";
  if (!clean) return fallback;
  if (isTranscriptEcho(clean, transcript, expected)) return fallback;
  if (clean.length <= maxChars) return `${clean}.`;
  // Prefer a compact accent-focused line rather than truncation.
  if (clean.toLowerCase().includes("accent")) {
    const shortAccent = "Accent influence is minor; keep practicing key sounds.";
    return shortAccent.length <= maxChars ? shortAccent : fallback;
  }
  return fallback.length <= maxChars ? fallback : "Clear pronunciation; keep practicing key sounds.";
}

function safeParseAccentInsight(
  raw: string,
  transcript: string,
  expected: string,
): PronunciationCheckResponse["accentInsight"] | null {
  try {
    const parsed = JSON.parse(raw) as {
      shortLine?: unknown;
      likelyAccent?: unknown;
      confidence?: unknown;
      summary?: unknown;
      tips?: unknown;
    };
    const shortLineRaw =
      typeof parsed.shortLine === "string" ? parsed.shortLine.trim() : "";
    const likelyAccent =
      typeof parsed.likelyAccent === "string" ? parsed.likelyAccent.trim() : "";
    const confidenceRaw = parsed.confidence;
    const confidence =
      confidenceRaw === "low" || confidenceRaw === "medium" || confidenceRaw === "high"
        ? confidenceRaw
        : "low";
    const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
    const tips = Array.isArray(parsed.tips)
      ? parsed.tips.filter((t): t is string => typeof t === "string").map((t) => t.trim()).filter(Boolean).slice(0, 3)
      : [];
    if (!likelyAccent || !summary || tips.length === 0) return null;
    return {
      shortLine: normalizeShortLine(shortLineRaw || summary, 75, transcript, expected),
      likelyAccent,
      confidence,
      summary,
      tips,
    };
  } catch {
    return null;
  }
}

async function buildAccentInsight(
  expected: string,
  transcript: string
): Promise<PronunciationCheckResponse["accentInsight"] | null> {
  if (!openai || !isAccentFeatureEnabled()) return null;
  if (!transcript.trim()) return null;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are an ESL pronunciation coach. Infer likely accent influence carefully from transcript cues only. Avoid certainty. Return JSON with keys: shortLine, likelyAccent, confidence (low|medium|high), summary, tips. shortLine must be one complete sentence, <=75 characters, no ellipsis, and MUST NOT repeat or closely paraphrase the transcript. tips must be an array of 3 short actionable tips.",
        },
        {
          role: "user",
          content: `Expected sentence: ${expected}\nSpoken transcript: ${transcript}\nReturn only JSON.`,
        },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "";
    if (!raw) return null;
    return safeParseAccentInsight(raw, transcript, expected);
  } catch (error) {
    console.error("accent insight error:", error);
    return null;
  }
}

/**
 * Compare expected vs transcript: word-level feedback and 0–100 score.
 * Alignment is simple one-to-one by index; excess transcript words are ignored.
 */
function compareSentences(
  expectedSentence: string,
  transcript: string
): { score: number; feedback: PronunciationFeedbackItem[] } {
  const expectedNormalized = tokenize(expectedSentence);
  const transcriptWords = tokenize(transcript);
  const originalWords = expectedSentence
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (expectedNormalized.length === 0) {
    return { score: 0, feedback: [] };
  }
  const feedback: PronunciationFeedbackItem[] = expectedNormalized.map(
    (norm, i) => {
      const spoken = transcriptWords[i];
      const correct = spoken !== undefined && spoken === norm;
      const word = originalWords[i] ?? norm;
      return { word, correct };
    }
  );
  const correctCount = feedback.filter((f) => f.correct).length;
  const score = Math.round((correctCount / expectedNormalized.length) * 100);
  return { score, feedback };
}

export async function POST(request: NextRequest) {
  const rate = await checkRateLimit(request, {
    route: "pronunciation-check",
    limit: 20,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  try {
    const formData = await request.formData();
    const audio = formData.get("audio");
    const expectedSentence = formData.get("expectedSentence");
    if (!audio || !(audio instanceof Blob) || audio.size === 0) {
      return NextResponse.json(
        { error: "Missing or invalid audio file" },
        { status: 400 }
      );
    }
    const expected =
      typeof expectedSentence === "string" ? expectedSentence.trim() : "";
    if (!expected) {
      return NextResponse.json(
        { error: "Missing expectedSentence" },
        { status: 400 }
      );
    }

    if (!openai) {
      return NextResponse.json(
        { error: "OpenAI not configured" },
        { status: 500 }
      );
    }

    const audioType = audio.type || "audio/webm";
    const ext = audioType.toLowerCase().includes("mp4")
      || audioType.toLowerCase().includes("aac")
      ? "m4a"
      : audioType.toLowerCase().includes("ogg")
        ? "ogg"
        : "webm";
    const file = new File([audio], `recording.${ext}`, { type: audioType });
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      language: "en",
      prompt: expected,
    });
    const transcript =
      typeof transcription.text === "string" ? transcription.text.trim() : "";

    if (!transcript) {
      return NextResponse.json(
        {
          error:
            "No speech detected in the recording. Speak louder, hold record a little longer, or check your microphone.",
        },
        { status: 422 }
      );
    }

    const { score, feedback } = compareSentences(expected, transcript);

    const accentInsight = await buildAccentInsight(expected, transcript);
    const body: PronunciationCheckResponse = {
      score,
      transcript,
      feedback,
      ...(accentInsight ? { accentInsight } : {}),
    };
    return NextResponse.json(body);
  } catch (error) {
    console.error("Pronunciation check error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Pronunciation check failed" },
      { status: 500 }
    );
  }
}
