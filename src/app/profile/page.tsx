"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
    <div className="min-h-screen overflow-y-auto bg-white text-black">
      <header className="shrink-0 border-b-2 border-black bg-white px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <Link
            href="/"
            className="text-sm font-bold text-black underline"
            aria-label="Back to feed"
          >
            ← Back
          </Link>
          <h1 className="text-lg font-bold text-black">Profile</h1>
          <span className="w-12" aria-hidden />
        </div>
      </header>
      <main>
        <div className="mx-auto flex max-w-lg flex-col px-4 py-8">
          <section className="mb-10">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-black">
              Account
            </h2>
            <div className="rounded-none border-2 border-black bg-white px-4 py-5 text-sm font-bold text-black shadow-[3px_3px_0px_black]">
              <div className="mb-4 flex justify-center">
                {user.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt=""
                    className="h-16 w-16 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full border-2 border-black bg-white text-2xl font-bold text-black shadow-[2px_2px_0px_black]"
                    aria-hidden
                  >
                    {user.email?.charAt(0).toUpperCase() ?? "?"}
                  </div>
                )}
              </div>
              <p className="mb-1 text-center">
                <span className="block text-xs font-bold uppercase tracking-wide text-black">
                  Email
                </span>
                <span className="mt-1 block break-all">
                  {user.email ?? "—"}
                </span>
              </p>
              {user.created_at && (
                <p className="mt-3 text-center text-black/80">
                  <span className="font-bold text-black">
                    Account Created:{" "}
                  </span>
                  {formatAccountDate(user.created_at) ?? "—"}
                </p>
              )}
            </div>
          </section>

          <section className="mb-10">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-black">
              Study Tools
            </h2>
            <nav className="flex flex-col gap-1" aria-label="Study tools">
              <Link
                href="/profile/vocabulary"
                className="flex items-center gap-3 rounded-none border-2 border-black bg-white px-4 py-3 font-bold text-black shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none"
              >
                <span className="text-xl" role="img" aria-hidden>
                  📘
                </span>
                <span>Vocabulary</span>
              </Link>
              <Link
                href="/profile/clips"
                className="flex items-center gap-3 rounded-none border-2 border-black bg-white px-4 py-3 font-bold text-black shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none"
              >
                <span className="text-xl" role="img" aria-hidden>
                  ✂
                </span>
                <span>Sentence Clips</span>
              </Link>
              <Link
                href="/profile/review"
                className="flex items-center gap-3 rounded-none border-2 border-black bg-white px-4 py-3 font-bold text-black shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none"
              >
                <span className="text-xl" role="img" aria-hidden>
                  🧠
                </span>
                <span>Flashcards Review</span>
              </Link>
            </nav>
          </section>

          <section className="mb-10">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-black">
              Your Learning
            </h2>
            <nav className="flex flex-col gap-1" aria-label="Your learning">
              <Link
                href="/profile/liked-videos"
                className="flex items-center gap-3 rounded-none border-2 border-black bg-white px-4 py-3 font-bold text-black shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none"
              >
                <span className="text-xl" role="img" aria-hidden>
                  ❤️
                </span>
                <span>Liked Videos</span>
              </Link>
              <Link
                href="/profile/saved-videos"
                className="flex items-center gap-3 rounded-none border-2 border-black bg-white px-4 py-3 font-bold text-black shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none"
              >
                <span className="text-xl" role="img" aria-hidden>
                  💾
                </span>
                <span>Saved Videos</span>
              </Link>
            </nav>
          </section>

          {user && (
            <button
              type="button"
              onClick={handleSignOut}
              className="mt-auto w-full rounded-none border-2 border-black bg-white px-4 py-3 text-sm font-bold text-red-700 shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none"
            >
              Sign out
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
