export const CLIP_STORAGE_KEY = "englishfeed_clips";

export interface SavedClip {
  sentence: string;
  videoId: string;
  timestamp: number;
  savedAt: number;
}

export function getClips(): SavedClip[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CLIP_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const list = parsed.filter(
      (item): item is SavedClip =>
        typeof item === "object" &&
        item !== null &&
        "sentence" in item &&
        typeof (item as SavedClip).sentence === "string" &&
        "videoId" in item &&
        typeof (item as SavedClip).videoId === "string" &&
        "timestamp" in item &&
        typeof (item as SavedClip).timestamp === "number"
    );
    return list.sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

export function saveClip(item: {
  sentence: string;
  videoId: string;
  timestamp: number;
}): void {
  const list = getClips();
  const sentenceLower = item.sentence.trim().toLowerCase();
  const now = Date.now();
  const existingIndex = list.findIndex(
    (e) => e.sentence.trim().toLowerCase() === sentenceLower
  );
  if (existingIndex >= 0) {
    list[existingIndex] = {
      ...list[existingIndex],
      videoId: item.videoId,
      timestamp: item.timestamp,
      savedAt: now,
    };
  } else {
    list.push({
      ...item,
      savedAt: now,
    });
  }
  try {
    window.localStorage.setItem(CLIP_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function removeClipItem(sentence: string): void {
  const sentenceLower = sentence.trim().toLowerCase();
  const list = getClips().filter(
    (e) => e.sentence.trim().toLowerCase() !== sentenceLower
  );
  try {
    window.localStorage.setItem(CLIP_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}
