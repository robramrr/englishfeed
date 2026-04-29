import path from "path";
import fs from "fs";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { getLessonById } from "@/lib/lessonsData";
import { checkRateLimit } from "@/lib/rateLimit";
import type { PracticeQuestion } from "@/types/lesson";

type Row = {
  practice: unknown;
  is_generating?: boolean | null;
};

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

type SubtitleSegment = { id?: number; start?: number; end?: number; text: string };
const LOCK_POLL_MS = 300;
const LOCK_MAX_RETRIES = 8;

async function waitForPracticeCache(
  supabase: ReturnType<typeof getSupabaseServer>,
  lessonId: string
): Promise<PracticeQuestion[] | null> {
  for (let i = 0; i < LOCK_MAX_RETRIES; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, LOCK_POLL_MS));
    const { data } = await supabase
      .from("lessons")
      .select("practice")
      .eq("id", lessonId)
      .maybeSingle();
    const cached = normalizePracticeQuestions((data as Row | null)?.practice);
    if (cached.length > 0) return cached;
  }
  return null;
}

/**
 * GET /api/lesson-practice?lessonId=...
 * Reads precomputed practice from Supabase `lessons.practice` (jsonb).
 * If null/empty: one-time OpenAI generate from lesson transcript, upsert, then return.
 */
export async function GET(request: NextRequest) {
  const rate = await checkRateLimit(request, {
    route: "lesson-practice",
    limit: 10,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const lessonId = searchParams.get("lessonId");
    if (!lessonId) {
      return NextResponse.json(
        { error: "Missing lessonId" },
        { status: 400 }
      );
    }

    const lesson = getLessonById(lessonId);
    if (!lesson) {
      return NextResponse.json(
        { error: "Lesson not found" },
        { status: 404 }
      );
    }
    if (!lesson.subtitlesUrl) {
      return NextResponse.json(
        { error: "Lesson has no subtitles; cannot generate practice" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("lessons")
      .select("practice, is_generating")
      .eq("id", lessonId)
      .maybeSingle();

    if (error) {
      console.error("lesson-practice GET error:", error);
      return NextResponse.json(
        { error: "Failed to load practice" },
        { status: 500 }
      );
    }

    const row = data as Row | null;
    const cachedRaw = row?.practice;
    const questions = normalizePracticeQuestions(cachedRaw);
    if (questions.length > 0) {
      return NextResponse.json({ questions });
    }

    // Lock is active: wait briefly for the other request to finish generation.
    if (row?.is_generating === true) {
      const waited = await waitForPracticeCache(supabase, lessonId);
      if (waited && waited.length > 0) {
        return NextResponse.json({ questions: waited });
      }
      return NextResponse.json(
        { error: "Practice generation in progress. Please try again." },
        { status: 503 }
      );
    }

    // Try to acquire generation lock for this lesson.
    const { data: lockRow, error: lockError } = await supabase
      .from("lessons")
      .update({ is_generating: true })
      .eq("id", lessonId)
      .or("is_generating.is.null,is_generating.eq.false")
      .select("id")
      .maybeSingle();
    if (lockError) {
      console.error("lesson-practice lock error:", lockError);
      return NextResponse.json(
        { error: "Failed to load practice" },
        { status: 500 }
      );
    }
    if (!lockRow) {
      const waited = await waitForPracticeCache(supabase, lessonId);
      if (waited && waited.length > 0) {
        return NextResponse.json({ questions: waited });
      }
      return NextResponse.json(
        { error: "Practice generation in progress. Please try again." },
        { status: 503 }
      );
    }

    try {
      const { data: recheckData, error: recheckError } = await supabase
        .from("lessons")
        .select("practice")
        .eq("id", lessonId)
        .maybeSingle();
      if (recheckError) {
        console.error("lesson-practice recheck error:", recheckError);
        return NextResponse.json(
          { error: "Failed to load practice" },
          { status: 500 }
        );
      }
      const rechecked = normalizePracticeQuestions((recheckData as Row | null)?.practice);
      if (rechecked.length > 0) {
        return NextResponse.json({ questions: rechecked });
      }

      if (!openai) {
        return NextResponse.json(
          { error: "OpenAI not configured" },
          { status: 500 }
        );
      }

      const subtitlesPath = path.join(
        process.cwd(),
        "public",
        lesson.subtitlesUrl.replace(/^\//, "")
      );
      let raw: string;
      try {
        raw = fs.readFileSync(subtitlesPath, "utf-8");
      } catch (e) {
        console.error("lesson-practice: read subtitles", e);
        return NextResponse.json(
          { error: "Subtitles file not found or unreadable" },
          { status: 400 }
        );
      }

      let subtitlesData: { segments?: SubtitleSegment[] };
      try {
        subtitlesData = JSON.parse(raw) as { segments?: SubtitleSegment[] };
      } catch {
        return NextResponse.json(
          { error: "Invalid subtitles JSON" },
          { status: 400 }
        );
      }

      const segments = Array.isArray(subtitlesData.segments) ? subtitlesData.segments : [];
      const transcript = segments
        .map((s) => (typeof s.text === "string" ? s.text : ""))
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (!transcript) {
        return NextResponse.json(
          { error: "No transcript text in subtitles" },
          { status: 400 }
        );
      }

      const prompt = `Generate exactly 3 multiple-choice English practice questions based on this lesson transcript.

You MUST create:
- 1 grammar question
- 1 vocabulary question
- 1 comprehension question

Question type rules:
- Grammar: test correct sentence structure or verb usage from the transcript.
- Vocabulary: ask about the meaning or usage of a specific word or phrase from the transcript.
- Comprehension: test understanding of the overall meaning or specific details from the transcript.

General rules:
- Each question must have exactly 3 options.
- Only one correct answer per question.
- Output valid JSON only, no other text.

Required JSON format:
{
  "questions": [
    {
      "type": "grammar" | "vocabulary" | "comprehension",
      "question": "Your question here?",
      "options": ["Option A", "Option B", "Option C"],
      "correctIndex": 0
    }
  ]
}

Transcript:
${transcript.slice(0, 6000)}
`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You respond only with valid JSON in the exact shape requested: an object with a 'questions' array. Each item has 'type' ('grammar' | 'vocabulary' | 'comprehension'), 'question' (string), 'options' (array of exactly 3 strings), and 'correctIndex' (number 0, 1, or 2).",
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        return NextResponse.json(
          { error: "No response from AI" },
          { status: 500 }
        );
      }

      let parsed: { questions?: unknown[] };
      try {
        parsed = JSON.parse(content) as { questions?: unknown[] };
      } catch {
        return NextResponse.json(
          { error: "Invalid JSON from AI" },
          { status: 500 }
        );
      }

      const generated = normalizePracticeQuestions({ questions: parsed.questions });
      if (generated.length === 0) {
        return NextResponse.json(
          { error: "AI did not return valid questions" },
          { status: 500 }
        );
      }

      const generatedPractice = { questions: generated };
      const { error: upsertError } = await supabase.from("lessons").upsert(
        {
          id: lessonId,
          practice: generatedPractice,
        },
        { onConflict: "id" }
      );
      if (upsertError) {
        console.error("lesson-practice upsert error:", upsertError);
      }

      return NextResponse.json({ questions: generated });
    } finally {
      // Always release generation lock, even on failures.
      const { error: releaseError } = await supabase
        .from("lessons")
        .update({ is_generating: false })
        .eq("id", lessonId);
      if (releaseError) {
        console.error("lesson-practice unlock error:", releaseError);
      }
    }
  } catch (e) {
    console.error("lesson-practice error:", e);
    return NextResponse.json(
      { error: "Failed to load practice" },
      { status: 500 }
    );
  }
}

function normalizePracticeQuestions(raw: unknown): PracticeQuestion[] {
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as Record<string, unknown>;
  const arr = obj.questions;
  if (!Array.isArray(arr)) return [];
  return arr.filter((item): item is PracticeQuestion => {
    if (!item || typeof item !== "object") return false;
    const o = item as Record<string, unknown>;
    const question = o.question;
    const options = o.options;
    const correctIndex = o.correctIndex;
    if (typeof question !== "string" || !Array.isArray(options)) return false;
    const opts = options.filter((x): x is string => typeof x === "string");
    if (opts.length < 2) return false;
    const idx =
      typeof correctIndex === "number" && Number.isInteger(correctIndex)
        ? correctIndex
        : -1;
    if (idx < 0 || idx >= opts.length) return false;
    return true;
  }).map((item) => ({
    question: item.question,
    options: item.options.filter((x): x is string => typeof x === "string"),
    correctIndex: item.correctIndex,
  }));
}
