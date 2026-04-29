import OpenAI from "openai";

export type ExtractedWord = {
  word: string;
  partOfSpeech: string;
  definition: string;
  example: string;
  thai: string;
};

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

/**
 * One OpenAI call: extract up to 5 vocabulary items from English text (sentence or transcript slice).
 * Used by GET /api/lesson-vocabulary fallback and (ingestion-only) POST /api/extract-vocabulary.
 */
export async function extractVocabularyFromSentence(
  sentence: string
): Promise<ExtractedWord[]> {
  const trimmed = sentence.replace(/\s+/g, " ").trim();
  if (!trimmed) return [];
  if (!openai) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const prompt = `Extract 5 useful English vocabulary words from this sentence for English learners.

Rules:
- Prefer nouns, verbs, adjectives.
- Avoid pronouns and articles.
- Avoid very basic words like "the", "a", "is".
- Return useful learning vocabulary.

For each word return: word, partOfSpeech, definition, example, thai (Thai translation).

Return valid JSON only. Use this exact format:
{
  "vocabulary": [
    {
      "word": "order",
      "partOfSpeech": "verb",
      "definition": "to ask for food or drinks at a restaurant",
      "example": "I ordered a sandwich.",
      "thai": "สั่งอาหาร"
    }
  ]
}

Sentence:
${trimmed.slice(0, 1000)}
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You respond only with valid JSON. An object with a 'vocabulary' array. Each item has word (string), partOfSpeech (string), definition (string), example (string), thai (string).",
      },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) return [];

  const parsed = JSON.parse(content) as { vocabulary?: unknown[] };
  const raw = Array.isArray(parsed.vocabulary) ? parsed.vocabulary : [];
  return raw.slice(0, 5).filter((item) => {
    if (!item || typeof item !== "object") return false;
    const o = item as Record<string, unknown>;
    return typeof o.word === "string" && typeof o.definition === "string";
  }).map((item) => {
    const o = item as Record<string, unknown>;
    return {
      word: String(o.word ?? ""),
      partOfSpeech: typeof o.partOfSpeech === "string" ? o.partOfSpeech : "",
      definition: String(o.definition ?? ""),
      example: typeof o.example === "string" ? o.example : "",
      thai: typeof o.thai === "string" ? o.thai : "",
    };
  });
}
