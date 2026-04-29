import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { checkRateLimit } from "@/lib/rateLimit";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const MAX_LEN = 600;

type SpellResult = {
  ok: boolean;
  corrected?: string;
  issues?: string[];
};

function parseSpellJson(raw: string | null | undefined): SpellResult {
  if (!raw) return { ok: true };
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (data.ok === true) return { ok: true };
    if (data.ok === false) {
      const corrected =
        typeof data.corrected === "string" ? data.corrected.trim() : "";
      const issues = Array.isArray(data.issues)
        ? data.issues.filter((x): x is string => typeof x === "string")
        : [];
      return { ok: false, corrected, issues };
    }
  } catch {
    /* ignore */
  }
  return { ok: true };
}

export async function POST(request: NextRequest) {
  const rate = await checkRateLimit(request, {
    route: "tutor-spelling",
    limit: 40,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
    );
  }

  let text = "";
  try {
    const body = await request.json();
    text = typeof body.text === "string" ? body.text.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!text) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }
  if (text.length > MAX_LEN) {
    return NextResponse.json({ error: "Text too long" }, { status: 400 });
  }

  if (!openai) {
    return NextResponse.json({ ok: true as const });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0,
      messages: [
        {
          role: "system",
          content: [
            "You check English spelling and obvious typos in short learner messages for a conversation tutor.",
            "Return ONLY valid JSON, no markdown.",
            'If the text is fine (including informal but correct English like "Gimme"), respond: {"ok":true}',
            'If there are clear spelling mistakes or accidental letter errors, respond: {"ok":false,"corrected":"<full corrected sentence>","issues":["short note"]}',
            "Preserve meaning and casual tone. Use American English. corrected must be a single sentence when possible.",
          ].join("\n"),
        },
        { role: "user", content: text },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    const parsed = parseSpellJson(raw);
    if (!parsed.ok && !parsed.corrected) {
      return NextResponse.json({ ok: true as const });
    }
    return NextResponse.json(parsed);
  } catch (e) {
    console.error("tutor-spelling:", e);
    return NextResponse.json({ ok: true as const });
  }
}
