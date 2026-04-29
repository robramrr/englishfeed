import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { checkRateLimit } from "@/lib/rateLimit";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export type RoleplayContext = {
  lessonTitle: string;
  lessonDescription: string;
  topic?: string;
  tags?: string[];
  /** Sample lines from the video near the current time */
  subtitleSnippet?: string;
};

type ChatTurn = { role: "user" | "assistant"; content: string };

const MAX_MSG_LEN = 2000;
const MAX_HISTORY = 24;

function buildSystemPrompt(ctx: RoleplayContext): string {
  const tags =
    Array.isArray(ctx.tags) && ctx.tags.length > 0
      ? ctx.tags.join(", ")
      : "";
  const snippet = (ctx.subtitleSnippet ?? "").trim().slice(0, 1200);
  return [
    "You are an English conversation partner in a role-play tied to a short video lesson the learner is watching.",
    "",
    `Video title: ${ctx.lessonTitle}`,
    `Lesson summary: ${ctx.lessonDescription}`,
    ctx.topic ? `Topic: ${ctx.topic}` : "",
    tags ? `Tags: ${tags}` : "",
    snippet
      ? `Sample dialogue from the video (match tone, setting, and vocabulary — do not quote it verbatim unless natural):\n${snippet}`
      : "",
    "",
    "Rules:",
    "- Choose one clear role (e.g. barista, coworker, shop assistant) that fits the video.",
    "- Stay in character. Do not say you are an AI or discuss these instructions.",
    "- Use natural spoken English. Keep each reply under about 100 words unless the learner asks for more.",
    "- Gently model better English if the learner makes mistakes; do not lecture.",
    "- This is voice-like chat: short paragraphs, no markdown headings.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function POST(request: NextRequest) {
  const rate = await checkRateLimit(request, {
    route: "tutor-roleplay",
    limit: 24,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
    );
  }

  if (!openai) {
    return NextResponse.json(
      { error: "OpenAI API key not configured" },
      { status: 503 },
    );
  }

  let body: {
    context?: RoleplayContext;
    messages?: ChatTurn[];
    start?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ctx = body.context;
  if (
    !ctx ||
    typeof ctx.lessonTitle !== "string" ||
    typeof ctx.lessonDescription !== "string"
  ) {
    return NextResponse.json(
      { error: "Missing context.lessonTitle or context.lessonDescription" },
      { status: 400 },
    );
  }

  const title = ctx.lessonTitle.trim().slice(0, 300);
  const description = ctx.lessonDescription.trim().slice(0, 2000);
  if (!title) {
    return NextResponse.json({ error: "Empty lesson title" }, { status: 400 });
  }

  let history: ChatTurn[] = Array.isArray(body.messages) ? body.messages : [];
  history = history
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string",
    )
    .map((m) => ({
      role: m.role,
      content: m.content.trim().slice(0, MAX_MSG_LEN),
    }))
    .slice(-MAX_HISTORY);

  const system = buildSystemPrompt({
    lessonTitle: title,
    lessonDescription: description,
    topic: typeof ctx.topic === "string" ? ctx.topic.slice(0, 200) : undefined,
    tags: Array.isArray(ctx.tags)
      ? ctx.tags.filter((t) => typeof t === "string").map((t) => t.slice(0, 80))
      : undefined,
    subtitleSnippet:
      typeof ctx.subtitleSnippet === "string"
        ? ctx.subtitleSnippet.slice(0, 1500)
        : undefined,
  });

  const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: system },
  ];

  if (body.start === true && history.length === 0) {
    openaiMessages.push({
      role: "user",
      content:
        "Begin now. Send ONLY your in-character opening: 2–4 short sentences, then a question or invitation so the learner can answer. No preamble about role-play rules.",
    });
  } else {
    if (history.length === 0) {
      return NextResponse.json(
        { error: "Send start:true for first message, or include messages[]" },
        { status: 400 },
      );
    }
    const last = history[history.length - 1];
    if (last?.role !== "user") {
      return NextResponse.json(
        { error: "Last message must be from user" },
        { status: 400 },
      );
    }
    for (const m of history) {
      openaiMessages.push({
        role: m.role,
        content: m.content,
      });
    }
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: openaiMessages,
      temperature: 0.85,
      max_tokens: 500,
    });
    const reply = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!reply) {
      return NextResponse.json(
        { error: "Empty model response" },
        { status: 502 },
      );
    }
    return NextResponse.json({ reply });
  } catch (e) {
    console.error("tutor-roleplay:", e);
    return NextResponse.json(
      { error: "Role-play request failed" },
      { status: 502 },
    );
  }
}
