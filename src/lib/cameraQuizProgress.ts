const key = (lessonId: string) => `camera_quiz_best_${lessonId}`;

export function getCameraQuizBestScore(lessonId: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const v = window.localStorage.getItem(key(lessonId));
    const n = Number.parseInt(v ?? "0", 10);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function saveCameraQuizBestScore(lessonId: string, score: number): void {
  if (typeof window === "undefined") return;
  try {
    const prev = getCameraQuizBestScore(lessonId);
    if (score > prev) {
      window.localStorage.setItem(key(lessonId), String(score));
    }
  } catch {
    /* ignore */
  }
}
