"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ComicButton, ComicCard, ComicText, ComicTitle } from "@/components/comic";
import { supabaseBrowserClient } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthContext";

function formatAccountDate(isoString: string | undefined): string | null {
  if (!isoString) return null;
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

const navLinkClass =
  "comic-card flex items-center gap-3 rounded-lg px-4 py-3 font-bold text-brand-navy transition hover:-translate-y-0.5 hover:comic-shadow-lg active:translate-x-0.5 active:translate-y-0.5 active:comic-shadow-sm";

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace("/auth");
  }, [loading, user, router]);

  async function handleSignOut() {
    if (!supabaseBrowserClient) return;
    await supabaseBrowserClient.auth.signOut();
    router.replace("/auth");
  }

  if (loading || !user) return null;

  return (
    <div className="min-h-[var(--feed-viewport-height)] overflow-y-auto text-brand-navy">
      <div className="mx-auto flex max-w-lg flex-col px-4 py-8">
        <ComicTitle level={2} className="mb-8 text-center">
          Profile
        </ComicTitle>

        <section className="mb-10">
          <ComicText bold className="mb-4 text-sm uppercase tracking-wide">
            Account
          </ComicText>
          <ComicCard className="px-4 py-5">
            <div className="mb-4 flex justify-center">
              {user.user_metadata?.avatar_url ? (
                <img
                  src={user.user_metadata.avatar_url}
                  alt=""
                  className="comic-border h-16 w-16 rounded-full object-cover comic-shadow-sm"
                />
              ) : (
                <div
                  className="comic-border flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-white text-2xl font-bungee text-brand-navy comic-shadow-sm"
                  aria-hidden
                >
                  {user.email?.charAt(0).toUpperCase() ?? "?"}
                </div>
              )}
            </div>
            <p className="mb-1 text-center">
              <ComicText
                as="span"
                bold
                className="block text-xs uppercase tracking-wide"
              >
                Email
              </ComicText>
              <ComicText as="span" className="mt-1 block break-all">
                {user.email ?? "—"}
              </ComicText>
            </p>
            {user.created_at && (
              <ComicText className="mt-3 text-center text-brand-navy/80">
                <ComicText as="span" bold>
                  Account Created:{" "}
                </ComicText>
                {formatAccountDate(user.created_at) ?? "—"}
              </ComicText>
            )}
          </ComicCard>
        </section>

        <section className="mb-10">
          <ComicText bold className="mb-4 text-sm uppercase tracking-wide">
            Study Tools
          </ComicText>
          <nav className="flex flex-col gap-2" aria-label="Study tools">
            <Link href="/profile/vocabulary" className={navLinkClass}>
              <span className="text-xl" role="img" aria-hidden>
                📘
              </span>
              <span>Vocabulary</span>
            </Link>
            <Link href="/profile/clips" className={navLinkClass}>
              <span className="text-xl" role="img" aria-hidden>
                ✂
              </span>
              <span>Sentence Clips</span>
            </Link>
            <Link href="/profile/review" className={navLinkClass}>
              <span className="text-xl" role="img" aria-hidden>
                🧠
              </span>
              <span>Flashcards Review</span>
            </Link>
          </nav>
        </section>

        <section className="mb-10">
          <ComicText bold className="mb-4 text-sm uppercase tracking-wide">
            Your Learning
          </ComicText>
          <nav className="flex flex-col gap-2" aria-label="Your learning">
            <Link href="/profile/liked-videos" className={navLinkClass}>
              <span className="text-xl" role="img" aria-hidden>
                ❤️
              </span>
              <span>Liked Videos</span>
            </Link>
            <Link href="/profile/saved-videos" className={navLinkClass}>
              <span className="text-xl" role="img" aria-hidden>
                💾
              </span>
              <span>Saved Videos</span>
            </Link>
          </nav>
        </section>

        {user && (
          <ComicButton
            type="button"
            variant="ghost"
            size="md"
            className="mt-auto w-full text-brand-red"
            onClick={handleSignOut}
          >
            Sign out
          </ComicButton>
        )}
      </div>
    </div>
  );
}
