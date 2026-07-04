"use client";

import { useCallback, useEffect, useState } from "react";
import type { EnglishLevel } from "@/types/lesson";
import { LevelPickerOverlay } from "@/components/LevelPickerOverlay";
import { useLevelFilter } from "@/lib/LevelFilterContext";
import { VideoFeed } from "./VideoFeed";

interface ClientOnlyFeedProps {
  userId: string;
}

function readFeedSearchParams() {
  if (typeof window === "undefined") {
    return { videoId: undefined as string | undefined, seekTime: undefined as number | undefined };
  }
  const params = new URLSearchParams(window.location.search);
  const videoId = params.get("video") ?? undefined;
  const tParam = params.get("t");
  const seekTime =
    tParam != null && tParam !== "" ? Number.parseFloat(tParam) : undefined;
  return {
    videoId,
    seekTime: Number.isFinite(seekTime) ? seekTime : undefined,
  };
}

const feedShellStyle = {
  top: "var(--header-height)",
  bottom: 0,
  height: "calc(100dvh - var(--header-height))",
} as const;

/**
 * User level is loaded from Supabase before the feed mounts so lessons are
 * only fetched once (avoids empty refetch flicker when settings arrive).
 */
export function ClientOnlyFeed({ userId }: ClientOnlyFeedProps) {
  const { levelFilter, setLevelFilter } = useLevelFilter();
  const [settingsReady, setSettingsReady] = useState(false);
  const [{ videoId, seekTime }] = useState(readFeedSearchParams);

  useEffect(() => {
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
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSettingsReady(true);
      });
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
      }).catch(() => {});
    },
    [userId, setLevelFilter]
  );

  return (
    <div
      className="fixed inset-x-0 z-10"
      style={feedShellStyle}
      suppressHydrationWarning
    >
      <div
        className="comic-bg-edtech-innovations pointer-events-none absolute inset-0"
        aria-hidden
      />
      <main
        className="relative z-10 mr-auto h-full min-w-0 w-[var(--feed-max-width)] bg-black md:mx-auto"
        suppressHydrationWarning
      >
        {settingsReady ? (
          <>
            <VideoFeed
              initialVideoId={videoId}
              initialSeekTime={seekTime}
              levelFilter={levelFilter}
              userId={userId}
            />
            <LevelPickerOverlay onSelect={handleLevelChange} />
          </>
        ) : null}
      </main>
    </div>
  );
}

/** Black feed-area placeholder matching ClientOnlyFeed layout (auth bootstrap). */
export function FeedShellPlaceholder() {
  return (
    <div
      className="fixed inset-x-0 z-10"
      style={feedShellStyle}
      suppressHydrationWarning
    >
      <div
        className="comic-bg-edtech-innovations pointer-events-none absolute inset-0"
        aria-hidden
      />
      <main
        className="relative z-10 mr-auto h-full min-w-0 w-[var(--feed-max-width)] bg-black md:mx-auto"
        suppressHydrationWarning
      />
    </div>
  );
}
