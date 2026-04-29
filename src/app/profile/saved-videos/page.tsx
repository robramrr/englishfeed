"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import VideoThumbnailImage from "@/components/VideoThumbnailImage";
import { getSavedLessons, type StoredLessonItem } from "@/lib/feedStorage";
import { useAuth } from "@/lib/AuthContext";
import { supabaseBrowserClient } from "@/lib/supabaseClient";

function VideoThumbnail({ item }: { item: StoredLessonItem }) {
  const href = `/?video=${encodeURIComponent(item.id)}`;
  return (
    <Link
      href={href}
      className="block overflow-hidden rounded-none border-2 border-black bg-white shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none"
      aria-label={`Play ${item.title}`}
    >
      <VideoThumbnailImage
        thumbnailUrl={item.thumbnailUrl}
        videoUrl={item.videoUrl}
        title={item.title}
        variant="brutalist"
      />
    </Link>
  );
}

export default function SavedVideosPage() {
  const [items, setItems] = useState<StoredLessonItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth");
  }, [authLoading, user, router]);

  if (authLoading || !user) return null;

  useEffect(() => {
    let cancelled = false;
    // Optional cache: show localStorage data immediately while fetching
    const cached = getSavedLessons();
    if (cached.length > 0) setItems(cached);

    const run = async () => {
      setItemsLoading(true);
      try {
        const session = await supabaseBrowserClient?.auth.getSession();
        const token = session?.data.session?.access_token;
        if (!token) {
          if (!cancelled) setItems([]);
          return;
        }

        const res = await fetch(
          `/api/saves?userId=${encodeURIComponent(user.id)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = (res.ok ? await res.json() : null) as
          | { items?: StoredLessonItem[] }
          | null;

        if (!cancelled && data && Array.isArray(data.items)) {
          setItems(data.items);
        }
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setItemsLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div className="min-h-screen overflow-y-auto bg-white text-black">
      <header className="shrink-0 border-b-2 border-black bg-white px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <Link
            href="/profile"
            className="text-sm font-bold text-black underline"
            aria-label="Back to profile"
          >
            ← Back
          </Link>
          <h1 className="text-lg font-bold text-black">Saved Videos</h1>
          <span className="w-12" aria-hidden />
        </div>
      </header>
      <main>
        <div className="mx-auto max-w-lg px-4 py-6">
          {items.length === 0 ? (
            <p className="text-sm font-bold text-black">
              Save videos from the feed to see them here.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {items.map((item) => (
                <VideoThumbnail key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
