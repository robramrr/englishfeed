export interface WordTiming {
  word: string;
  start: number;
  end: number;
}

export interface PlaybackSubtitleSegment {
  start: number;
  end: number;
  displayStart: number;
  displayEnd: number;
  words: WordTiming[];
}

interface RawSubtitleWord {
  word?: string;
  start?: number;
  end?: number;
}

interface RawSubtitleSegment {
  start?: number;
  end?: number;
  text?: string;
  words?: RawSubtitleWord[];
}

const LEAD_PAD_SEC = 0.05;
const TAIL_PAD_SEC = 0.12;
/** Bridge tiny gaps between consecutive blocks so speech does not flicker off. */
const BRIDGE_GAP_SEC = 0.4;
const MAX_WORDS_PER_BLOCK = 6;
const MAX_BLOCK_DURATION_SEC = 5.5;

function parseWords(seg: RawSubtitleSegment): WordTiming[] {
  const embedded =
    Array.isArray(seg.words) && seg.words.length > 0
      ? seg.words
          .filter(
            (w): w is WordTiming =>
              typeof w.word === "string" &&
              typeof w.start === "number" &&
              typeof w.end === "number"
          )
          .map((w) => ({ word: w.word, start: w.start, end: w.end }))
      : null;

  if (embedded && embedded.length > 0) return embedded;

  const text = (seg.text ?? "").trim();
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const start = typeof seg.start === "number" ? seg.start : 0;
  const end = typeof seg.end === "number" ? seg.end : start;
  const slot = Math.max((end - start) / words.length, 0.01);
  return words.map((word, i) => ({
    word,
    start: start + i * slot,
    end: start + (i + 1) * slot,
  }));
}

function chunkWords(words: WordTiming[]): WordTiming[][] {
  const chunks: WordTiming[][] = [];
  let bucket: WordTiming[] = [];

  const flush = () => {
    if (bucket.length === 0) return;
    chunks.push(bucket);
    bucket = [];
  };

  for (const w of words) {
    if (bucket.length > 0) {
      const prev = bucket[bucket.length - 1]!;
      const gap = w.start - prev.end;
      const span = w.end - bucket[0]!.start;
      if (
        gap > BRIDGE_GAP_SEC ||
        bucket.length >= MAX_WORDS_PER_BLOCK ||
        span > MAX_BLOCK_DURATION_SEC
      ) {
        flush();
      }
    }
    bucket.push(w);
  }
  flush();
  return chunks;
}

function toPlaybackSegment(words: WordTiming[]): PlaybackSubtitleSegment | null {
  if (words.length === 0) return null;
  const start = words[0]!.start;
  const end = words[words.length - 1]!.end;
  return {
    start,
    end,
    displayStart: start,
    displayEnd: end,
    words,
  };
}

/** Normalize any subtitle JSON into short, gap-aware playback blocks. */
export function buildPlaybackSubtitleSegments(
  segments: RawSubtitleSegment[]
): PlaybackSubtitleSegment[] {
  const blocks: PlaybackSubtitleSegment[] = [];

  for (const seg of segments) {
    const words = parseWords(seg);
    if (words.length === 0) continue;

    const duration = words[words.length - 1]!.end - words[0]!.start;
    const needsSplit =
      words.length > MAX_WORDS_PER_BLOCK || duration > MAX_BLOCK_DURATION_SEC;

    const chunks = needsSplit ? chunkWords(words) : [words];
    for (const chunk of chunks) {
      const block = toPlaybackSegment(chunk);
      if (block) blocks.push(block);
    }
  }

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!;
    const next = blocks[i + 1];
    const gap = next ? next.start - block.end : Infinity;
    const bridge = next && gap <= BRIDGE_GAP_SEC;

    block.displayStart = Math.max(0, block.start - LEAD_PAD_SEC);
    block.displayEnd = bridge
      ? next!.start
      : block.end + TAIL_PAD_SEC;
  }

  return blocks;
}

function activeWordIndex(words: WordTiming[], timeSec: number): number {
  if (words.length === 0) return -1;

  for (let i = words.length - 1; i >= 0; i--) {
    const w = words[i]!;
    if (timeSec >= w.start - LEAD_PAD_SEC && timeSec <= w.end + TAIL_PAD_SEC) {
      return i;
    }
  }

  for (let i = words.length - 1; i >= 0; i--) {
    if (timeSec >= words[i]!.start) return i;
  }

  return 0;
}

/** Pick the subtitle block that should be on screen at `timeSec`. */
export function findActiveSubtitle(
  segments: PlaybackSubtitleSegment[],
  timeSec: number
): { segmentIndex: number; wordIndex: number } {
  if (!segments.length || !Number.isFinite(timeSec) || timeSec < 0) {
    return { segmentIndex: -1, wordIndex: -1 };
  }

  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i]!;
    if (timeSec >= seg.displayStart && timeSec < seg.displayEnd) {
      return { segmentIndex: i, wordIndex: activeWordIndex(seg.words, timeSec) };
    }
  }

  return { segmentIndex: -1, wordIndex: -1 };
}
