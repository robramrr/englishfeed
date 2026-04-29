/**
 * DEPRECATED — ingestion / tooling only. Runtime practice uses GET /api/lesson-practice.
 */
import path from "path";
import fs from "fs";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { getLessonById } from "@/lib/lessonsData";
import { checkRateLimit } from "@/lib/rateLimit";
import type { PracticeQuestion } from "@/types/lesson";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

type SubtitleSegment = { id?: number; start?: number; end?: number; text: string };

/**
 * POST /api/generate-practice
 * Body: { lessonId: string }
 * Loads lesson subtitles, generates 3 practice questions via AI, stores in lesson_practice, returns questions.
 */
export async function POST(request: NextRequest) {
  const rate = await checkRateLimit(request, {
    route: "generate-practice",
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
    let lessonId: string;
    try {
      const body = await request.json();
      lessonId = typeof body?.lessonId === "string" ? body.lessonId.trim() : "";
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }
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

    const subtitlesPath = path.join(
      process.cwd(),
      "public",
      lesson.subtitlesUrl.replace(/^\//, "")
    );
    let raw: string;
    try {
      raw = fs.readFileSync(subtitlesPath, "utf-8");
    } catch (e) {
      console.error("generate-practice: read subtitles", e);
      return NextResponse.json(
        { error: "Subtitles file not found or unreadable" },
        { status: 400 }
      );
    }

    let data: { segments?: SubtitleSegment[] };
    try {
      data = JSON.parse(raw) as { segments?: SubtitleSegment[] };
    } catch {
      return NextResponse.json(
        { error: "Invalid subtitles JSON" },
        { status: 400 }
      );
    }
    const segments = Array.isArray(data.segments) ? data.segments : [];
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

    if (!openai) {
      return NextResponse.json(
        { error: "OpenAI not configured" },
        { status: 500 }
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

    let completion;
    try {
      completion = await openai.chat.completions.create({
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
    } catch (aiError) {
      console.error("Practice generation error (AI request):", aiError);
      throw aiError;
    }

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
    const questions = normalizeQuestions(parsed.questions);
    if (questions.length === 0) {
      return NextResponse.json(
        { error: "AI did not return valid questions" },
        { status: 500 }
      );
    }

    const supabase = getSupabaseServer();
    const { error: dbError } = await supabase.from("lesson_practice").upsert(
      {
        lesson_id: lessonId,
        questions_json: { questions },
      },
      { onConflict: "lesson_id" }
    );
    if (dbError) {
      console.error("Practice generation error (Supabase):", dbError);
      const message =
        process.env.NODE_ENV === "development" && dbError.message
          ? dbError.message
          : "Failed to store practice questions";
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json({ questions });
  } catch (error) {
    console.error("Practice generation error:", error);
    const message =
      process.env.NODE_ENV === "development" &&
      error instanceof Error &&
      error.message
        ? error.message
        : "Practice generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function normalizeQuestions(raw: unknown): PracticeQuestion[] {
  if (!Array.isArray(raw)) return [];
  const out: PracticeQuestion[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const typeRaw = typeof o.type === "string" ? o.type : "";
    const type: PracticeQuestion["type"] =
      typeRaw === "grammar" || typeRaw === "vocabulary" || typeRaw === "comprehension"
        ? typeRaw
        : undefined;
    const question = typeof o.question === "string" ? o.question : "";
    const options = Array.isArray(o.options)
      ? (o.options as unknown[]).filter((x): x is string => typeof x === "string")
      : [];
    if (question === "" || options.length < 2) continue;
    let correctIndex = typeof o.correctIndex === "number" ? o.correctIndex : 0;
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
      correctIndex = 0;
    }
    out.push({
      type,
      question,
      options: options.slice(0, 3),
      correctIndex,
    });
  }
  return out.slice(0, 3);
}
