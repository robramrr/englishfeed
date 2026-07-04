export interface SubtitleWord {
  word: string;
  start: number;
  end: number;
}

export interface SubtitleSegmentOutput {
  id: number;
  start: number;
  end: number;
  text: string;
  words: SubtitleWord[];
}

interface WhisperWord {
  word?: string;
  start?: number;
  end?: number;
}

interface WhisperSegment {
  start?: number;
  end?: number;
  text?: string;
  words?: WhisperWord[];
}

interface WhisperTranscription {
  segments?: WhisperSegment[];
  words?: WhisperWord[];
}

function roundTime(value: number): number {
  return Math.round(value * 100) / 100;
}

function endsSentence(word: string): boolean {
  return /[.!?]["']?$/.test(word.trim());
}

function endsClause(word: string): boolean {
  return /[,;]["']?$/.test(word.trim());
}

function normalizeWhisperWords(raw: WhisperWord[]): SubtitleWord[] {
  const words: SubtitleWord[] = [];
  for (const w of raw) {
    const word = (w.word ?? "").trim();
    if (!word) continue;
    if (typeof w.start !== "number" || typeof w.end !== "number") continue;
    words.push({ word, start: w.start, end: w.end });
  }
  return words;
}

function collectWordsFromTranscription(data: WhisperTranscription): SubtitleWord[] {
  const rootWords = normalizeWhisperWords(data.words ?? []);
  if (rootWords.length > 0) return rootWords;

  const segmentWords: SubtitleWord[] = [];
  for (const seg of data.segments ?? []) {
    segmentWords.push(...normalizeWhisperWords(seg.words ?? []));
  }
  return segmentWords;
}

function evenWordTimings(
  text: string,
  start: number,
  end: number
): SubtitleWord[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const slot = (end - start) / tokens.length;
  return tokens.map((word, i) => ({
    word,
    start: start + i * slot,
    end: start + (i + 1) * slot,
  }));
}

function shouldFlushBucket(
  word: string,
  bucketLength: number,
  maxWords: number,
  clauseBreakAfter: number
): boolean {
  if (endsSentence(word)) return true;
  if (bucketLength >= maxWords) return true;
  if (bucketLength >= clauseBreakAfter && endsClause(word)) return true;
  return false;
}

/** Split Whisper output into short blocks timed by real word start/end. */
export function buildSubtitleSegmentsFromWhisper(
  data: WhisperTranscription,
  options?: { maxWordsPerSegment?: number; clauseBreakAfter?: number }
): SubtitleSegmentOutput[] {
  const maxWords = options?.maxWordsPerSegment ?? 6;
  const clauseBreakAfter = options?.clauseBreakAfter ?? 3;
  const allWords = collectWordsFromTranscription(data);

  if (allWords.length === 0) {
    return (data.segments ?? [])
      .filter((seg) => (seg.text ?? "").trim())
      .map((seg, id) => {
        const text = (seg.text ?? "").trim();
        const start = roundTime(seg.start ?? 0);
        const end = roundTime(seg.end ?? 0);
        return {
          id,
          start,
          end,
          text,
          words: evenWordTimings(text, start, end),
        };
      });
  }

  const output: SubtitleSegmentOutput[] = [];
  let bucket: SubtitleWord[] = [];

  const flush = () => {
    if (bucket.length === 0) return;
    output.push({
      id: output.length,
      start: roundTime(bucket[0]!.start),
      end: roundTime(bucket[bucket.length - 1]!.end),
      text: bucket.map((w) => w.word).join(" "),
      words: bucket.map((w) => ({
        word: w.word,
        start: roundTime(w.start),
        end: roundTime(w.end),
      })),
    });
    bucket = [];
  };

  const gapSplitSec = 0.35;

  for (const w of allWords) {
    if (bucket.length > 0) {
      const prev = bucket[bucket.length - 1]!;
      if (w.start - prev.end > gapSplitSec) {
        flush();
      }
    }
    bucket.push(w);
    if (shouldFlushBucket(w.word, bucket.length, maxWords, clauseBreakAfter)) {
      flush();
    }
  }
  flush();

  return output;
}
