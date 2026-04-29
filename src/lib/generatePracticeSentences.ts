import OpenAI from "openai";

const openai =
  process.env.OPENAI_API_KEY != null
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

type PracticeSentencesResponse = {
  sentences?: unknown;
};

/**
 * Generate 5–8 short, clean sentences from a transcript that are ideal for
 * pronunciation practice.
 *
 * NOTE: This is a server-only helper. It requires OPENAI_API_KEY and should be
 * called from build scripts or API routes, not from the client.
 */
export async function generatePracticeSentences(
  transcript: string
): Promise<string[]> {
  const text = transcript.replace(/\s+/g, " ").trim();
  if (!text || !openai) return [];

  const prompt = `You are helping English learners practice pronunciation.

From the transcript below, extract 5 short sentences that are clearly spoken in the video.

Rules:
• 4–10 words
• grammatically correct
• natural spoken English
• add punctuation if needed
• keep the meaning of the original speech

Return JSON:
{
  "sentences": string[]
}

Transcript:
${text.slice(0, 8000)}
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You respond only with valid JSON in the exact shape requested: an object with a 'sentences' array of strings.",
      },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) return [];

  let parsed: PracticeSentencesResponse;
  try {
    parsed = JSON.parse(content) as PracticeSentencesResponse;
  } catch {
    return [];
  }

  const raw = Array.isArray(parsed.sentences) ? parsed.sentences : [];
  const cleaned: string[] = [];
  for (const s of raw) {
    if (typeof s !== "string") continue;
    const sentence = s.replace(/\s+/g, " ").trim();
    if (!sentence) continue;
    const count = sentence.split(/\s+/).filter(Boolean).length;
    if (count < 4 || count > 10) continue;
    cleaned.push(sentence);
    if (cleaned.length >= 8) break;
  }

  return cleaned;
}

