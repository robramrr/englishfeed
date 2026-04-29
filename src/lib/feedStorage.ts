export const LIKED_STORAGE_KEY = "englishfeed_liked";
export const SAVED_STORAGE_KEY = "englishfeed_saved";

export interface StoredLessonItem {
  id: string;
  title: string;
  videoUrl: string;
  /** URL to a thumbnail image. Optional for backwards compatibility. */
  thumbnailUrl?: string;
  savedAt: number;
}

function getStored(key: string): StoredLessonItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const list = parsed.filter(
      (item): item is StoredLessonItem =>
        typeof item === "object" &&
        item !== null &&
        "id" in item &&
        typeof (item as StoredLessonItem).id === "string" &&
        "title" in item &&
        typeof (item as StoredLessonItem).title === "string" &&
        "videoUrl" in item &&
        typeof (item as StoredLessonItem).videoUrl === "string" &&
        "savedAt" in item &&
        typeof (item as StoredLessonItem).savedAt === "number"
    );
    return list.sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

function setStored(key: string, list: StoredLessonItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function getLikedLessons(): StoredLessonItem[] {
  return getStored(LIKED_STORAGE_KEY);
}

export function addLikedLesson(item: {
  id: string;
  title: string;
  videoUrl: string;
  thumbnailUrl?: string;
}): void {
  const list = getLikedLessons().filter((e) => e.id !== item.id);
  list.unshift({
    ...item,
    savedAt: Date.now(),
  });
  setStored(LIKED_STORAGE_KEY, list);
}

export function removeLikedLesson(id: string): void {
  setStored(
    LIKED_STORAGE_KEY,
    getLikedLessons().filter((e) => e.id !== id)
  );
}

export function isLiked(id: string): boolean {
  return getLikedLessons().some((e) => e.id === id);
}

export function getSavedLessons(): StoredLessonItem[] {
  return getStored(SAVED_STORAGE_KEY);
}

export function addSavedLesson(item: {
  id: string;
  title: string;
  videoUrl: string;
  thumbnailUrl?: string;
}): void {
  const list = getSavedLessons().filter((e) => e.id !== item.id);
  list.unshift({
    ...item,
    savedAt: Date.now(),
  });
  setStored(SAVED_STORAGE_KEY, list);
}

export function removeSavedLesson(id: string): void {
  setStored(
    SAVED_STORAGE_KEY,
    getSavedLessons().filter((e) => e.id !== id)
  );
}

export function isSaved(id: string): boolean {
  return getSavedLessons().some((e) => e.id === id);
}
