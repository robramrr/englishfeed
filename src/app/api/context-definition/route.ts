import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createHash } from "crypto";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { checkRateLimit } from "@/lib/rateLimit";

export type ContextDefinitionResponse = {
  contextDefinition: string;
  synonyms: string[];
  examples: string[];
};

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function getInputHash(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export async function POST(request: Request) {
  const rate = await checkRateLimit(request, {
    route: "context-definition",
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
  let sentence: string;
  let definitions: string[];

  try {
    const body = await request.json();
    word = typeof body.word === "string" ? body.word : "";
    sentence = typeof body.sentence === "string" ? body.sentence : "";
    definitions = Array.isArray(body.definitions)
      ? body.definitions.filter((d: unknown) => typeof d === "string")
      : [];
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const fallbackResponse: ContextDefinitionResponse = {
    contextDefinition:
      definitions[0] || "a word used in spoken or written English",
    synonyms: [],
    examples: sentence ? [sentence] : [],
  };
  const inputText = `word:${word}\nsentence:${sentence}\ndefinitions:${definitions.join("|")}`;
  const key = getInputHash(`context:${inputText}`);
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
    if (cached && typeof cached.result === "object" && cached.result !== null) {
      const result = cached.result as Record<string, unknown>;
      const contextDefinition =
        typeof result.contextDefinition === "string"
          ? result.contextDefinition
          : fallbackResponse.contextDefinition;
      const synonyms = Array.isArray(result.synonyms)
        ? (result.synonyms as unknown[]).filter(
            (s): s is string => typeof s === "string"
          )
        : [];
      const examples = Array.isArray(result.examples)
        ? (result.examples as unknown[]).filter(
            (e): e is string => typeof e === "string"
          )
        : sentence
          ? [sentence]
          : [];
      return NextResponse.json({
        contextDefinition,
        synonyms,
        examples,
      } satisfies ContextDefinitionResponse);
    }
  }

  if (!openai) {
    return NextResponse.json(fallbackResponse);
  }

  const definitionsList =
    definitions.length > 0
      ? definitions.map((d, i) => `${i + 1}. ${d}`).join("\n")
      : "No definitions provided.";

  const prompt = `You are an English vocabulary assistant. Given a word, the sentence where it appears, and dictionary definitions, respond with exactly this JSON (no other text):
{
  "contextDefinition": "one short phrase explaining the meaning of the word specifically in this sentence (e.g. 'big in size' for 'large' in 'Russia is a large country')",
  "synonyms": ["word1", "word2", "word3"],
  "examples": ["the given sentence or a very similar example sentence"]
}

Word: ${word}
Sentence: ${sentence}
Dictionary definitions:
${definitionsList}

Respond with only the JSON object.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You respond only with valid JSON in the exact shape requested: contextDefinition (string), synonyms (array of strings), examples (array of strings).",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return NextResponse.json(fallbackResponse);

    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) {
      return NextResponse.json(fallbackResponse);
    }

    const parsedRecord = parsed as Record<string, unknown>;
    const rawContextDefinition = parsedRecord.contextDefinition;
    const contextDefinition =
      typeof rawContextDefinition === "string"
        ? rawContextDefinition
        : fallbackResponse.contextDefinition;
    const synonyms = Array.isArray(parsedRecord.synonyms)
      ? (parsedRecord.synonyms as unknown[]).filter(
          (s): s is string => typeof s === "string"
        )
      : [];
    const examples = Array.isArray(parsedRecord.examples)
      ? (parsedRecord.examples as unknown[]).filter(
          (e): e is string => typeof e === "string"
        )
      : sentence
        ? [sentence]
        : [];

    const aiResult = {
      contextDefinition,
      synonyms,
      examples,
    } satisfies ContextDefinitionResponse;

    if (supabase) {
      await supabase.from("ai_cache").insert({
        type: "context",
        input_hash: key,
        input_text: inputText,
        result: aiResult,
      });
    }

    return NextResponse.json(aiResult);
  } catch {
    return NextResponse.json(fallbackResponse);
  }
}
