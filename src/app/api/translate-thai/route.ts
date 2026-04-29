import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createHash } from "crypto";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { checkRateLimit } from "@/lib/rateLimit";

export type TranslateThaiResponse = {
  wordThai: string;
  definitionThai: string;
  synonymsThai: string;
  exampleThai: string;
};

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function getInputHash(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export async function POST(request: Request) {
  const rate = await checkRateLimit(request, {
    route: "translate-thai",
    limit: 30,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  let word: string;
  let definition: string;
  let synonyms: string;
  let example: string;

  try {
    const body = await request.json();
    word = typeof body.word === "string" ? body.word : "";
    definition = typeof body.definition === "string" ? body.definition : "";
    synonyms = typeof body.synonyms === "string" ? body.synonyms : "";
    example = typeof body.example === "string" ? body.example : "";
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const fallback: TranslateThaiResponse = {
    wordThai: "",
    definitionThai: "",
    synonymsThai: "",
    exampleThai: "",
  };
  const inputText = `word:${word}\ndefinition:${definition}\nsynonyms:${synonyms}\nexample:${example}`;
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
    const cachedResult = cached?.result as Partial<TranslateThaiResponse> | undefined;
    if (cachedResult && typeof cachedResult === "object") {
      return NextResponse.json({
        wordThai: typeof cachedResult.wordThai === "string" ? cachedResult.wordThai : "",
        definitionThai:
          typeof cachedResult.definitionThai === "string"
            ? cachedResult.definitionThai
            : "",
        synonymsThai:
          typeof cachedResult.synonymsThai === "string"
            ? cachedResult.synonymsThai
            : "",
        exampleThai:
          typeof cachedResult.exampleThai === "string" ? cachedResult.exampleThai : "",
      } satisfies TranslateThaiResponse);
    }
  }

  if (!openai) {
    return NextResponse.json(fallback);
  }

  const prompt = `Translate the following English vocabulary content into Thai. Respond with only a JSON object in this exact shape (no other text):
{
  "wordThai": "Thai translation of the word",
  "definitionThai": "Thai translation of the definition",
  "synonymsThai": "Thai translation of the synonym list as a comma-separated list",
  "exampleThai": "Thai translation of the example sentence"
}

Content to translate:
Word: ${word}
Definition: ${definition}
Synonyms (comma-separated): ${synonyms}
Example sentence: ${example}

If a field is empty, use an empty string for its translation.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You respond only with valid JSON. Translate English to Thai accurately and naturally.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return NextResponse.json(fallback);

    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) {
      return NextResponse.json(fallback);
    }

    const parsedRecord = parsed as Record<string, unknown>;
    const wordThai = typeof parsedRecord.wordThai === "string" ? parsedRecord.wordThai : "";
    const definitionThai =
      typeof parsedRecord.definitionThai === "string" ? parsedRecord.definitionThai : "";
    const synonymsThai =
      typeof parsedRecord.synonymsThai === "string" ? parsedRecord.synonymsThai : "";
    const exampleThai =
      typeof parsedRecord.exampleThai === "string" ? parsedRecord.exampleThai : "";

    const aiResult = {
      wordThai,
      definitionThai,
      synonymsThai,
      exampleThai,
    } satisfies TranslateThaiResponse;

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
    return NextResponse.json(fallback);
  }
}
