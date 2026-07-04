"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import {
  getClips,
  removeClipItem,
  type SavedClip,
} from "@/lib/clipStorage";

function buildPlayUrl(clip: SavedClip): string {
  const params = new URLSearchParams({ video: clip.videoId, t: String(clip.timestamp) });
  return `/?${params.toString()}`;
}

export default function ClipsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [clips, setClips] = useState<SavedClip[]>([]);

  const load = useCallback(() => {
    setClips(getClips());
  }, []);

  useEffect(() => {
    if (!loading && !user) router.replace("/auth");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    load();
  }, [user, load]);

  const handleRemove = useCallback((sentence: string) => {
    if (!user) return;
    removeClipItem(sentence);
    setClips(getClips());
  }, [user]);

  const handleShare = useCallback(async (clip: SavedClip) => {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}${buildPlayUrl(clip)}`
        : "";
    const text = `${clip.sentence}\n\nWatch at ${url}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          text,
          url,
          title: "EnglishFeed clip",
        });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          await copyToClipboard(url);
        }
      }
    } else {
      await copyToClipboard(url);
    }
  }, []);

  async function copyToClipboard(url: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // ignore
    }
  }

  if (loading || !user) return null;

  return (
    <div className="min-h-[var(--feed-viewport-height)] overflow-y-auto text-brand-navy">
      <header className="sticky top-0 z-10 comic-border-b-4 comic-bg-header-stripes px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <Link
            href="/profile"
            className="text-sm font-bold text-brand-navy underline"
            aria-label="Back to profile"
          >
            ← Back
          </Link>
          <h1 className="text-lg font-bold text-brand-navy">My clips</h1>
          <span className="w-12" aria-hidden />
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6 pb-8">
        {clips.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
            <p className="text-base font-bold text-brand-navy">
              You haven&apos;t saved any clips yet.
            </p>
            <p className="text-sm font-bold text-brand-navy">
              Tap &quot;Clip Sentence&quot; in the subtitle popup to save useful
              English phrases.
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {clips.map((clip, i) => (
              <li
                key={`${clip.videoId}-${clip.timestamp}-${clip.savedAt}-${i}`}
                className="rounded-none comic-border bg-white p-4 comic-shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 flex-1 text-[15px] leading-relaxed font-bold text-brand-navy">
                    {clip.sentence}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleRemove(clip.sentence)}
                    className="shrink-0 rounded-none comic-border bg-white px-3 py-2 text-sm font-bold text-brand-navy comic-shadow-sm transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label="Remove clip"
                  >
                    Remove
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Link
                    href={buildPlayUrl(clip)}
                    className="min-h-[44px] min-w-[44px] rounded-none comic-border bg-white px-4 py-3 text-sm font-bold text-brand-navy comic-shadow-sm transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none inline-flex items-center justify-center"
                  >
                    Play from timestamp
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleShare(clip)}
                    className="min-h-[44px] min-w-[44px] rounded-none comic-border bg-white px-4 py-3 text-sm font-bold text-brand-navy comic-shadow-sm transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none inline-flex items-center justify-center"
                  >
                    Share
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
