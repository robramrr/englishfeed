"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EnglishLevel, Lesson } from "@/types/lesson";
import { FEED_SCROLL_TO_START_EVENT } from "@/lib/feedNavigation";
import { VideoSlide } from "./VideoSlide";

interface VideoFeedProps {
  initialVideoId?: string;
  initialSeekTime?: number;
  levelFilter: EnglishLevel;
  /** When set, topic preferences are fetched and used to boost preferred topics. */
  userId?: string | null;
}

type EngagementRow = {
  lessonId: string;
  score: number;
};

async function fetchLessons(
  level: EnglishLevel,
  cursor: number | null
): Promise<{ lessons: Lesson[]; nextCursor: number | null }> {
  const params = new URLSearchParams({ level });
  if (cursor != null) params.set("cursor", String(cursor));
  const res = await fetch(`/api/lessons?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch lessons");
  return res.json();
}

async function fetchTopicPreferences(userId: string): Promise<Record<string, number>> {
  try {
    const res = await fetch(`/api/user-topic-preferences?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) return {};
    const data = (await res.json()) as { topics?: Record<string, number> };
    return data.topics ?? {};
  } catch {
    return {};
  }
}

async function fetchRankedLessons(
  level: EnglishLevel,
  userId?: string | null
): Promise<Lesson[]> {
  // 1) Fetch engagement ranking
  const engagementRes = await fetch("/api/lesson-engagement");
  if (!engagementRes.ok) {
    throw new Error("Failed to fetch engagement ranking");
  }
  const engagementData: { lessons: EngagementRow[] } = await engagementRes.json();
  const scoreByLessonId = new Map<string, number>();
  for (const row of engagementData.lessons) {
    scoreByLessonId.set(String(row.lessonId), row.score);
  }

  // 2) Topic preference weights (fallback to empty = no boost)
  let topicWeights: Record<string, number> = {};
  if (userId) {
    topicWeights = await fetchTopicPreferences(userId);
  }

  // 3) Load all lessons for this level via the existing lessons API
  const allLessons: Lesson[] = [];
  let cursor: number | null = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (cursor == null) break;
    const params = new URLSearchParams({ level });
    params.set("cursor", String(cursor));
    const res = await fetch(`/api/lessons?${params.toString()}`);
    if (!res.ok) {
      throw new Error("Failed to fetch lessons for ranking");
    }
    const { lessons: batch, nextCursor } = (await res.json()) as {
      lessons: Lesson[];
      nextCursor: number | null;
    };
    allLessons.push(...batch);
    cursor = nextCursor;
  }

  // 4) Final score: engagementScore * (1 + topicPreferenceWeight); sort desc
  const topicPreferenceWeight = (lesson: Lesson) =>
    lesson.topic ? (topicWeights[lesson.topic] ?? 0) : 0;

  const withFinalScore = allLessons.map((lesson) => {
    const engagementScore = scoreByLessonId.get(String(lesson.id)) ?? 0;
    const tw = topicPreferenceWeight(lesson);
    const finalScore = engagementScore * (1 + tw);
    return { lesson, finalScore };
  });
  withFinalScore.sort((a, b) => b.finalScore - a.finalScore);

  const ordered = withFinalScore.map(({ lesson }) => lesson);
  const seenIds = new Set<string>();
  return ordered.filter((l) => {
    const id = String(l.id);
    if (seenIds.has(id)) return false;
    seenIds.add(id);
    return true;
  });
}

export function VideoFeed({
  initialVideoId,
  initialSeekTime,
  levelFilter,
  userId,
}: VideoFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerReady, setContainerReady] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const hasScrolledToInitial = useRef(false);

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(0);
  const [isLoading, setIsLoading] = useState(true);
  const loadingMoreRef = useRef(false);

  const setContainerRef = useCallback((el: HTMLDivElement | null) => {
    (containerRef as React.MutableRefObject<HTMLDivElement | null>).current =
      el;
    setContainerReady(!!el);
  }, []);

  // Load lessons when level changes; keep prior slides visible during refetch.
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    loadingMoreRef.current = false;

    fetchLessons(levelFilter, 0)
      .then(({ lessons: batch, nextCursor: next }) => {
        if (!cancelled) {
          setLessons(batch);
          setNextCursor(next);
        }
      })
      .catch(() => {
        if (!cancelled) setNextCursor(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [levelFilter, userId]);

  useEffect(() => {
    const scrollToStart = () => {
      const el = containerRef.current;
      if (!el) return;
      el.scrollTo({ top: 0, behavior: "smooth" });
      setCurrentIndex(0);
    };
    window.addEventListener(FEED_SCROLL_TO_START_EVENT, scrollToStart);
    return () =>
      window.removeEventListener(FEED_SCROLL_TO_START_EVENT, scrollToStart);
  }, []);

  // Load next batch when scroll near end
  const loadMore = useCallback(() => {
    if (nextCursor == null || loadingMoreRef.current || isLoading) return;
    loadingMoreRef.current = true;
    fetchLessons(levelFilter, nextCursor)
      .then(({ lessons: batch, nextCursor: next }) => {
        setLessons((prev) => [...prev, ...batch]);
        setNextCursor(next);
      })
      .catch(() => setNextCursor(null))
      .finally(() => {
        loadingMoreRef.current = false;
      });
  }, [levelFilter, nextCursor, isLoading]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const slideHeight = el.clientHeight;
    const index = Math.round(el.scrollTop / slideHeight);
    const len = lessons.length;
    setCurrentIndex(Math.min(index, Math.max(0, len - 1)));

    // Request next batch when within one full screen of the end
    if (len > 0 && nextCursor != null && slideHeight > 0) {
      const scrollBottom = el.scrollTop + el.clientHeight;
      const threshold = (len - 1) * slideHeight;
      if (scrollBottom >= threshold - slideHeight * 0.5) loadMore();
    }
  }, [lessons.length, nextCursor, loadMore]);

  const scrollToSlide = useCallback(
    (index: number) => {
      const el = containerRef.current;
      if (!el) return;
      const slideHeight = el.clientHeight;
      el.scrollTo({ top: index * slideHeight, behavior: "smooth" });
    },
    []
  );

  // When opening from tag page or clip link, scroll to the video (and optional seek time)
  useEffect(() => {
    if (
      !initialVideoId ||
      !containerRef.current ||
      !containerReady ||
      lessons.length === 0 ||
      hasScrolledToInitial.current
    )
      return;
    const index = lessons.findIndex((l) => l.id === initialVideoId);
    if (index < 0) return;
    hasScrolledToInitial.current = true;
    const slideHeight = containerRef.current.clientHeight;
    containerRef.current.scrollTo({
      top: index * slideHeight,
      behavior: "smooth",
    });
  }, [initialVideoId, containerReady, lessons]);

  if (isLoading && lessons.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-zinc-500">
        Loading…
      </div>
    );
  }

  if (!isLoading && lessons.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-zinc-500">
        No lessons yet. Check back soon!
      </div>
    );
  }

  /** Must match the feed shell height — use 100% of the scroll container, not a second viewport calc. */
  const slideFrameClass =
    "h-full min-h-0 w-full min-w-0 shrink-0 snap-start snap-always overflow-hidden";

  return (
    <div
      ref={setContainerRef}
      className="relative h-full min-w-0 w-full snap-y snap-mandatory overflow-y-scroll overscroll-y-contain"
      onScroll={handleScroll}
      suppressHydrationWarning
    >
      <div className="flex h-full min-h-0 flex-col" suppressHydrationWarning>
        {lessons.map((lesson, index) => (
          <div key={lesson.id} className={slideFrameClass} suppressHydrationWarning>
            <VideoSlide
              lesson={lesson}
              scrollContainerRef={containerRef}
              scrollContainerReady={containerReady}
              initialSeekTime={
                lesson.id === initialVideoId ? initialSeekTime : undefined
              }
              userId={userId}
              isActive={index === currentIndex}
            />
          </div>
        ))}
      </div>
      {/* Progress dots */}
      <div
        className="absolute right-12 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-2 md:right-16"
        suppressHydrationWarning
      >
        {lessons.map((_, index) => (
          <button
            key={index}
            type="button"
            aria-label={`Go to lesson ${index + 1}`}
            onClick={() => scrollToSlide(index)}
            className={`h-2 w-2 rounded-full transition-all ${
              index === currentIndex
                ? "h-3 bg-white"
                : "bg-white/50 hover:bg-white/70"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
