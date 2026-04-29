import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createHash } from "crypto";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { checkRateLimit } from "@/lib/rateLimit";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function getInputHash(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function normalizeThaiTranslation(raw: string): string {
  const singleLine = raw.replace(/\s+/g, " ").trim();
  if (!singleLine) return "";
  const parts = singleLine
    .split(/[.!?。！？]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return "";
  return parts[0] ?? "";
}

export async function POST(request: Request) {
  const rate = await checkRateLimit(request, {
    route: "translate-sentence-thai",
    limit: 30,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  let sentence = "";
  try {
    const body = await request.json();
    sentence =
      typeof body.sentence === "string" ? body.sentence.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!sentence) {
    return NextResponse.json({ error: "Missing sentence" }, { status: 400 });
  }

  const inputText = sentence;
  const key = getInputHash(`translation:${inputText}`);
  let supabase: ReturnType<typeof getSupabaseServer> | null = null;
  try {
    supabase = getSupabaseServer();
  } catch {
    supabase = null;
  }

  if (supabase) {
    const { data: cached } = await supabase
      .from("ai_cache")
      .select("result")
      .eq("input_hash", key)
      .maybeSingle();
    const cachedThai =
      cached &&
      typeof cached.result === "object" &&
      cached.result !== null &&
      typeof (cached.result as Record<string, unknown>).thai === "string"
        ? (cached.result as Record<string, unknown>).thai
        : null;
    if (cachedThai !== null) {
      return NextResponse.json({ thai: cachedThai });
    }
  }

  if (!openai) {
    return NextResponse.json({ thai: "" });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a professional translator. Translate the sentence into Thai. Return ONLY the Thai translation. Do not explain. Do not add extra information. Do not expand the sentence. Do not include quotes.",
        },
        {
          role: "user",
          content: sentence,
        },
      ],
      temperature: 0,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return NextResponse.json({ thai: "" });

    const thai = normalizeThaiTranslation(raw);

    const aiResult = { thai };
    if (supabase) {
      await supabase.from("ai_cache").insert({
        type: "translation",
        input_hash: key,
        input_text: inputText,
        result: aiResult,
      });
    }

    return NextResponse.json(aiResult);
  } catch {
    return NextResponse.json({ thai: "" });
  }
}
