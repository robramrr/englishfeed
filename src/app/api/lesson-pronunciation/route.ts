import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { getLessonById } from "@/lib/lessonsData";
import { getLessonTranscript } from "@/lib/lessonTranscript";
import { checkRateLimit } from "@/lib/rateLimit";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;
const LOCK_POLL_MS = 300;
const LOCK_MAX_RETRIES = 8;

function normalizeSentence(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().replace(/^["'\s]+|["'\s]+$/g, "");
}

async function waitForPronunciationCache(
  supabase: ReturnType<typeof getSupabaseServer>,
  lessonId: string
): Promise<string | null> {
  for (let i = 0; i < LOCK_MAX_RETRIES; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, LOCK_POLL_MS));
    const { data } = await supabase
      .from("lessons")
      .select("pronunciation_target")
      .eq("id", lessonId)
      .maybeSingle();
    const sentence =
      data && typeof data.pronunciation_target === "string"
        ? normalizeSentence(data.pronunciation_target)
        : "";
    if (sentence) return sentence;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const rate = await checkRateLimit(request, {
    route: "lesson-pronunciation",
    limit: 10,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  const lessonId = request.nextUrl.searchParams.get("lessonId")?.trim() ?? "";
  if (!lessonId) {
    return NextResponse.json({ error: "Missing lessonId" }, { status: 400 });
  }

  const lesson = getLessonById(lessonId);
  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  let supabase: ReturnType<typeof getSupabaseServer>;
  try {
    supabase = getSupabaseServer();
  } catch {
    return NextResponse.json(
      { error: "Supabase is not configured on the server" },
      { status: 503 }
    );
  }

  const { data, error } = await supabase
    .from("lessons")
    .select("pronunciation_target, is_generating")
    .eq("id", lessonId)
    .maybeSingle();

  if (error) {
    console.error("lesson-pronunciation select:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  const cached =
    data && typeof data.pronunciation_target === "string"
      ? normalizeSentence(data.pronunciation_target)
      : "";
  if (cached) {
    return NextResponse.json({ sentence: cached });
  }

  // Lock is active: wait briefly for the other request to finish generation.
  if (data?.is_generating === true) {
    const waited = await waitForPronunciationCache(supabase, lessonId);
    if (waited) {
      return NextResponse.json({ sentence: waited });
    }
    return NextResponse.json(
      { error: "Pronunciation generation in progress. Please try again." },
      { status: 503 }
    );
  }

  // Ensure row exists so lock acquisition can succeed for new lessons.
  if (!data) {
    const { error: ensureRowError } = await supabase
      .from("lessons")
      .upsert({ id: lessonId }, { onConflict: "id" });
    if (ensureRowError) {
      console.error("lesson-pronunciation ensure row:", ensureRowError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }
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
    console.error("lesson-pronunciation lock:", lockError);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
  if (!lockRow) {
    const waited = await waitForPronunciationCache(supabase, lessonId);
    if (waited) {
      return NextResponse.json({ sentence: waited });
    }
    return NextResponse.json(
      { error: "Pronunciation generation in progress. Please try again." },
      { status: 503 }
    );
  }

  try {
  const transcript = getLessonTranscript(lesson);
  if (!transcript) {
    return NextResponse.json(
      { error: "No transcript available for pronunciation generation" },
      { status: 400 }
    );
  }

  if (!openai) {
    return NextResponse.json({ error: "OpenAI not configured" }, { status: 500 });
  }

  const prompt = `You are an English teacher.

From the following lesson transcript, extract ONE clear, natural, and useful sentence for pronunciation practice.

Rules:
- Must be a complete, grammatically correct sentence
- Must sound natural in spoken English
- Avoid filler words (um, uh, like, you know)
- Keep it between 6–12 words
- It should represent the main idea of the lesson
- Make it easy for a learner to repeat

Return ONLY the sentence.

Transcript:
${transcript.slice(0, 2000)}
`;

  let sentence = "";
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Return only one clean sentence for pronunciation practice.",
        },
        { role: "user", content: prompt },
      ],
    });
    sentence = normalizeSentence(completion.choices[0]?.message?.content ?? "");
  } catch (aiError) {
    console.error("lesson-pronunciation generate:", aiError);
    return NextResponse.json(
      { error: "Pronunciation sentence generation failed" },
      { status: 500 }
    );
  }

  if (!sentence) {
    return NextResponse.json(
      { error: "No sentence generated" },
      { status: 500 }
    );
  }

  const { error: upsertError } = await supabase.from("lessons").upsert(
    {
      id: lessonId,
      pronunciation_target: sentence,
    },
    { onConflict: "id" }
  );
  if (upsertError) {
    console.error("lesson-pronunciation upsert:", upsertError);
  }

  return NextResponse.json({ sentence });
  } finally {
    // Always release generation lock, even on failures.
    const { error: releaseError } = await supabase
      .from("lessons")
      .update({ is_generating: false })
      .eq("id", lessonId);
    if (releaseError) {
      console.error("lesson-pronunciation unlock:", releaseError);
    }
  }
}
