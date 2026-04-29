export async function trackEvent(
  event: string,
  lessonId: string,
  data: Record<string, unknown> = {},
  userId: string | null = null
): Promise<void> {
  try {
    await fetch("/api/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event,
        lessonId,
        userId,
        timestamp: Date.now(),
        ...data,
      }),
    });
  } catch (err) {
    console.error("Analytics error", err);
  }
}
