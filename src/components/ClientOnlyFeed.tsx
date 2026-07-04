"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { EnglishLevel } from "@/types/lesson";
import { LevelPickerOverlay } from "@/components/LevelPickerOverlay";
import { useLevelFilter } from "@/lib/LevelFilterContext";
import { VideoFeed } from "./VideoFeed";

interface ClientOnlyFeedProps {
  userId: string;
}

/**
 * Renders the feed only after client mount to avoid hydration mismatch
 * when browser extensions inject attributes (e.g. bis_skin_checked) into the DOM.
 * Lesson loading is handled by VideoFeed via /api/lessons.
 * User level is loaded from and saved to Supabase user_settings.
 */
export function ClientOnlyFeed({ userId }: ClientOnlyFeedProps) {
  const [mounted, setMounted] = useState(false);
  const { levelFilter, setLevelFilter } = useLevelFilter();
  const searchParams = useSearchParams();
  useEffect(() => setMounted(true), []);

  // Load saved level from user_settings
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetch(`/api/user-settings?userId=${encodeURIComponent(userId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { level?: string } | null) => {
        if (!cancelled && data?.level) {
          const level = data.level as EnglishLevel;
          if (["beginner", "intermediate", "advanced"].includes(level)) {
            setLevelFilter(level);
          }
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId, setLevelFilter]);

  const handleLevelChange = useCallback(
    (level: EnglishLevel) => {
      setLevelFilter(level);
      if (!userId) return;
      fetch("/api/user-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, level }),
      }).catch(() => {
        // ignore
      });
    },
    [userId, setLevelFilter]
  );

  const videoId = searchParams.get("video") ?? undefined;
  const tParam = searchParams.get("t");
  const seekTime =
    tParam != null && tParam !== ""
      ? Number.parseFloat(tParam)
      : undefined;

  if (!mounted) {
    return (
      <main
        className="fixed inset-x-0 min-w-0 w-full bg-black"
        style={{
          top: "var(--header-height)",
          bottom: 0,
          height: "calc(100dvh - var(--header-height))",
        }}
        suppressHydrationWarning
      />
    );
  }

  return (
    <main
      className="fixed inset-x-0 min-w-0 w-full bg-black"
      style={{
        top: "var(--header-height)",
        bottom: 0,
        height: "calc(100dvh - var(--header-height))",
      }}
      suppressHydrationWarning
    >
      <VideoFeed
        initialVideoId={videoId}
        initialSeekTime={Number.isFinite(seekTime) ? seekTime : undefined}
        levelFilter={levelFilter}
        userId={userId}
      />
      <LevelPickerOverlay onSelect={handleLevelChange} />
    </main>
  );
}
