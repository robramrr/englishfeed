/**
 * DEPRECATED — ingestion / tooling only. Runtime vocabulary uses GET /api/lesson-vocabulary.
 * Do not call from product UI. Requires x-vocab-ingestion-secret when VOCAB_INGESTION_SECRET is set;
 * in production the secret must be set or all requests are rejected.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  extractVocabularyFromSentence,
  type ExtractedWord,
} from "@/lib/extractVocabularyOpenAI";
import { checkRateLimit } from "@/lib/rateLimit";

export type { ExtractedWord };
export type ExtractVocabularyResponse = {
  vocabulary: ExtractedWord[];
};

function allowIngestionRequest(request: NextRequest): boolean {
  const secret = process.env.VOCAB_INGESTION_SECRET;
  if (process.env.NODE_ENV === "production") {
    if (!secret) return false;
    return request.headers.get("x-vocab-ingestion-secret") === secret;
  }
  if (secret) {
    return request.headers.get("x-vocab-ingestion-secret") === secret;
  }
  return true;
}

export async function POST(request: NextRequest) {
  const rate = await checkRateLimit(request, {
    route: "extract-vocabulary",
    limit: 10,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  if (!allowIngestionRequest(request)) {
    return NextResponse.json(
      { error: "Forbidden — use GET /api/lesson-vocabulary or set x-vocab-ingestion-secret" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const sentence =
      typeof body.sentence === "string" ? body.sentence.trim() : "";
    if (!sentence) {
      return NextResponse.json(
        { error: "Missing or empty sentence" },
        { status: 400 }
      );
    }

    const vocabulary = await extractVocabularyFromSentence(sentence);
    return NextResponse.json({ vocabulary });
  } catch (error) {
    console.error("extract-vocabulary error:", error);
    const message =
      error instanceof Error ? error.message : "Extract failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
