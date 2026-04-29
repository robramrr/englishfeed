import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { getLessonById } from "@/lib/lessonsData";
import { getLessonTranscript } from "@/lib/lessonTranscript";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  extractVocabularyFromSentence,
  type ExtractedWord,
} from "@/lib/extractVocabularyOpenAI";

const LOCK_POLL_MS = 300;
const LOCK_MAX_RETRIES = 8;

async function waitForVocabularyCache(
  supabase: ReturnType<typeof getSupabaseServer>,
  lessonId: string
): Promise<ExtractedWord[] | null> {
  for (let i = 0; i < LOCK_MAX_RETRIES; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, LOCK_POLL_MS));
    const { data } = await supabase
      .from("lessons")
      .select("ai_vocabulary")
      .eq("id", lessonId)
      .maybeSingle();
    const cached = normalizeVocabulary(data?.ai_vocabulary);
    if (cached.length > 0) return cached;
  }
  return null;
}

function normalizeVocabulary(raw: unknown): ExtractedWord[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw
      .filter((item): item is Record<string, unknown> => item != null && typeof item === "object")
      .filter(
        (o) => typeof o.word === "string" && typeof o.definition === "string"
      )
      .map((o) => ({
        word: String(o.word ?? ""),
        partOfSpeech: typeof o.partOfSpeech === "string" ? o.partOfSpeech : "",
        definition: String(o.definition ?? ""),
        example: typeof o.example === "string" ? o.example : "",
        thai: typeof o.thai === "string" ? o.thai : "",
      }));
  }
  if (typeof raw === "object" && raw !== null && "vocabulary" in raw) {
    return normalizeVocabulary(
      (raw as { vocabulary: unknown }).vocabulary
    );
  }
  return [];
}

/**
 * GET /api/lesson-vocabulary?lessonId=
 * Reads precomputed vocabulary from Supabase `lessons.ai_vocabulary` (jsonb).
 * If null/empty: one-time OpenAI extract from lesson transcript, upsert, then return.
 */
export async function GET(request: NextRequest) {
  const rate = await checkRateLimit(request, {
    route: "lesson-vocabulary",
    limit: 10,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  const lessonId =
    request.nextUrl.searchParams.get("lessonId")?.trim() ?? "";
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

  const { data: row, error: selectError } = await supabase
    .from("lessons")
    .select("ai_vocabulary, is_generating")
    .eq("id", lessonId)
    .maybeSingle();

  if (selectError) {
    console.error("lesson-vocabulary select:", selectError);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  const cached = normalizeVocabulary(row?.ai_vocabulary);
  if (cached.length > 0) {
    return NextResponse.json({ vocabulary: cached });
  }

  // Lock is active: wait briefly for the other request to finish generation.
  if (row?.is_generating === true) {
    const waited = await waitForVocabularyCache(supabase, lessonId);
    if (waited && waited.length > 0) {
      return NextResponse.json({ vocabulary: waited });
    }
    return NextResponse.json(
      { error: "Vocabulary generation in progress. Please try again." },
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
    console.error("lesson-vocabulary lock:", lockError);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
  if (!lockRow) {
    const waited = await waitForVocabularyCache(supabase, lessonId);
    if (waited && waited.length > 0) {
      return NextResponse.json({ vocabulary: waited });
    }
    return NextResponse.json(
      { error: "Vocabulary generation in progress. Please try again." },
      { status: 503 }
    );
  }

  try {
  const transcript = getLessonTranscript(lesson);
  if (!transcript) {
    return NextResponse.json(
      {
        error:
          "No vocabulary in database and lesson has no subtitles for one-time generation",
      },
      { status: 400 }
    );
  }

  let extracted: ExtractedWord[];
  try {
    extracted = await extractVocabularyFromSentence(transcript.slice(0, 1000));
  } catch (e) {
    console.error("lesson-vocabulary extract:", e);
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Vocabulary extraction failed",
      },
      { status: 500 }
    );
  }

  if (extracted.length === 0) {
    return NextResponse.json({ vocabulary: [] });
  }

  const { error: upsertError } = await supabase.from("lessons").upsert(
    { id: lessonId, ai_vocabulary: extracted },
    { onConflict: "id" }
  );

  if (upsertError) {
    console.error("lesson-vocabulary upsert:", upsertError);
  }

  return NextResponse.json({ vocabulary: extracted });
  } finally {
    // Always release generation lock, even on failures.
    const { error: releaseError } = await supabase
      .from("lessons")
      .update({ is_generating: false })
      .eq("id", lessonId);
    if (releaseError) {
      console.error("lesson-vocabulary unlock:", releaseError);
    }
  }
}
