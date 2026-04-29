import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { getLessonById } from "@/lib/lessonsData";
import { checkRateLimit } from "@/lib/rateLimit";

const ROUNDS = 5;
const CHOICES = 4;

const FALLBACK_DISTRACTORS = [
  "water",
  "table",
  "friend",
  "happy",
  "street",
  "phone",
  "paper",
  "window",
  "music",
  "garden",
];

type VocabRow = { word: string };

function normalizeVocabulary(raw: unknown): VocabRow[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw
      .filter((item): item is Record<string, unknown> => item != null && typeof item === "object")
      .filter((o) => typeof o.word === "string" && o.word.trim().length > 0)
      .map((o) => ({ word: String(o.word).trim() }));
  }
  if (typeof raw === "object" && raw !== null && "vocabulary" in raw) {
    return normalizeVocabulary((raw as { vocabulary: unknown }).vocabulary);
  }
  return [];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function buildChoices(
  correct: string,
  pool: string[]
): { choices: string[]; correctIndex: number } {
  const correctLc = correct.toLowerCase();
  const others = pool
    .filter((w) => w.toLowerCase() !== correctLc)
    .slice(0, CHOICES * 2);
  const picked: string[] = [];
  for (const w of shuffle(others)) {
    if (picked.length >= CHOICES - 1) break;
    if (!picked.some((p) => p.toLowerCase() === w.toLowerCase())) {
      picked.push(w);
    }
  }
  let fi = 0;
  while (picked.length < CHOICES - 1 && fi < FALLBACK_DISTRACTORS.length) {
    const d = FALLBACK_DISTRACTORS[fi++]!;
    if (d.toLowerCase() !== correctLc && !picked.includes(d)) picked.push(d);
  }
  const choices = shuffle([correct, ...picked.slice(0, CHOICES - 1)]);
  const correctIndex = choices.findIndex(
    (c) => c.toLowerCase() === correctLc
  );
  return { choices, correctIndex: correctIndex >= 0 ? correctIndex : 0 };
}

export async function GET(request: NextRequest) {
  const rate = await checkRateLimit(request, {
    route: "camera-quiz",
    limit: 20,
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
      { error: "Database not configured" },
      { status: 503 }
    );
  }

  const { data: row, error } = await supabase
    .from("lessons")
    .select("ai_vocabulary")
    .eq("id", lessonId)
    .maybeSingle();

  if (error) {
    console.error("camera-quiz select:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  const vocab = normalizeVocabulary(row?.ai_vocabulary);
  if (vocab.length === 0) {
    return NextResponse.json(
      {
        error:
          "No vocabulary for this lesson yet. Open Vocabulary on this video once to generate words, then try again.",
      },
      { status: 400 }
    );
  }

  const words = shuffle(vocab.map((v) => v.word)).slice(
    0,
    Math.min(ROUNDS, vocab.length)
  );
  const pool = vocab.map((v) => v.word);

  const rounds = words.map((word) => {
    const { choices, correctIndex } = buildChoices(word, pool);
    return { word, choices, correctIndex };
  });

  return NextResponse.json({
    lessonId,
    lessonTitle: lesson.title ?? "",
    secondsPerRound: 45,
    rounds,
  });
}
