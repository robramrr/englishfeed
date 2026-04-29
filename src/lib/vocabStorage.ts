export const VOCAB_STORAGE_KEY = "englishfeed_vocab";

export interface SavedVocabItem {
  word: string;
  meaning: string;
  example: string;
  savedAt: number;
  /** Number of times the user marked "I knew it" in review. */
  knownCount?: number;
  /** Number of times the user marked "I didn't know it" in review. */
  unknownCount?: number;
}

export function getSavedVocab(): SavedVocabItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(VOCAB_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const list = parsed.filter(
      (item): item is SavedVocabItem =>
        typeof item === "object" &&
        item !== null &&
        "word" in item &&
        typeof (item as SavedVocabItem).word === "string" &&
        "meaning" in item &&
        typeof (item as SavedVocabItem).meaning === "string" &&
        "example" in item &&
        typeof (item as SavedVocabItem).example === "string" &&
        "savedAt" in item &&
        typeof (item as SavedVocabItem).savedAt === "number"
    );
    return list.sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

export function incrementVocabReview(
  word: string,
  type: "known" | "unknown"
): void {
  if (typeof window === "undefined") return;
  const list = getSavedVocab();
  const wordLower = word.trim().toLowerCase();
  const idx = list.findIndex(
    (e) => e.word.trim().toLowerCase() === wordLower
  );
  if (idx < 0) return;
  const item = list[idx];
  list[idx] = {
    ...item,
    knownCount: (item.knownCount ?? 0) + (type === "known" ? 1 : 0),
    unknownCount: (item.unknownCount ?? 0) + (type === "unknown" ? 1 : 0),
  };
  try {
    window.localStorage.setItem(VOCAB_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function saveVocabItem(item: Omit<SavedVocabItem, "savedAt">): boolean {
  const list = getSavedVocab();
  const wordLower = item.word.trim().toLowerCase();
  const now = Date.now();
  const existingIndex = list.findIndex(
    (e) => e.word.trim().toLowerCase() === wordLower
  );
  if (existingIndex >= 0) {
    list[existingIndex] = {
      ...list[existingIndex],
      meaning: item.meaning,
      example: item.example,
      savedAt: now,
    };
  } else {
    list.push({
      ...item,
      savedAt: now,
    });
  }
  try {
    window.localStorage.setItem(VOCAB_STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function removeVocabItem(word: string): void {
  const wordLower = word.trim().toLowerCase();
  const list = getSavedVocab().filter(
    (e) => e.word.toLowerCase() !== wordLower
  );
  try {
    window.localStorage.setItem(VOCAB_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}
