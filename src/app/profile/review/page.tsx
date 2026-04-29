"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Mic, Volume2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { speakWord, usePronunciationCheck } from "@/lib/pronunciation";
import {
  getSavedVocab,
  incrementVocabReview,
  type SavedVocabItem,
} from "@/lib/vocabStorage";

function shuffle<T>(array: T[]): T[] {
  const out = [...array];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

type ThaiCache = {
  definitionThai: string;
  exampleThai: string;
};

export default function ReviewPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [items, setItems] = useState<SavedVocabItem[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [thaiCache, setThaiCache] = useState<Record<string, ThaiCache>>({});
  const [thaiLoading, setThaiLoading] = useState(false);
  const {
    startListening,
    recognizedText,
    pronunciationFeedback,
    isListening,
    reset: resetPronunciation,
  } = usePronunciationCheck();

  useEffect(() => {
    if (!loading && !user) router.replace("/auth");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    const list = getSavedVocab();
    setItems(shuffle(list));
    setIndex(0);
    setRevealed(false);
  }, [user]);

  if (loading || !user) return null;

  const current = items[index];

  const loadThai = useCallback(async (item: SavedVocabItem) => {
    const key = item.word.trim().toLowerCase();
    if (thaiCache[key]) return;
    setThaiLoading(true);
    try {
      const res = await fetch("/api/translate-thai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: item.word,
          definition: item.meaning,
          synonyms: "",
          example: item.example || "",
        }),
      });
      if (!res.ok) throw new Error("Translate failed");
      const data = await res.json();
      setThaiCache((prev) => ({
        ...prev,
        [key]: {
          definitionThai: data.definitionThai ?? "",
          exampleThai: data.exampleThai ?? "",
        },
      }));
    } catch {
      setThaiCache((prev) => ({
        ...prev,
        [key]: { definitionThai: "", exampleThai: "" },
      }));
    } finally {
      setThaiLoading(false);
    }
  }, [thaiCache]);

  const handleReveal = useCallback(() => {
    if (!current) return;
    setRevealed(true);
    loadThai(current);
  }, [current, loadThai]);

  const advanceToNext = useCallback(() => {
    setRevealed(false);
    resetPronunciation();
    setIndex((i) => (i + 1) % Math.max(items.length, 1));
  }, [items.length, resetPronunciation]);

  const handleKnown = useCallback(() => {
    if (current) incrementVocabReview(current.word, "known");
    advanceToNext();
  }, [current, advanceToNext]);

  const handleUnknown = useCallback(() => {
    if (current) incrementVocabReview(current.word, "unknown");
    advanceToNext();
  }, [current, advanceToNext]);

  if (items.length === 0) {
    return (
      <div className="flex min-h-screen flex-col overflow-y-auto bg-white text-black">
        <header className="sticky top-0 z-10 border-b-2 border-black bg-white px-4 py-3">
          <div className="mx-auto flex max-w-lg items-center justify-between">
            <Link
              href="/profile"
              className="text-sm font-bold text-black underline"
              aria-label="Back to profile"
            >
              ← Back
            </Link>
            <h1 className="text-lg font-bold text-black">Vocabulary Review</h1>
            <span className="w-12" aria-hidden />
          </div>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
          <p className="text-base font-bold text-black">
            You don&apos;t have any saved words yet.
          </p>
          <p className="mt-2 text-sm font-bold text-black text-center">
            Save words from subtitles to start reviewing.
          </p>
        </main>
      </div>
    );
  }

  const cacheKey = current?.word.trim().toLowerCase() ?? "";
  const thai = cacheKey ? thaiCache[cacheKey] : null;

  return (
    <div className="flex min-h-screen flex-col overflow-y-auto bg-white text-black">
      <header className="sticky top-0 z-10 border-b-2 border-black bg-white px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <Link
            href="/profile"
            className="text-sm font-bold text-black underline"
            aria-label="Back to profile"
          >
            ← Back
          </Link>
          <h1 className="text-lg font-bold text-black">Vocabulary Review</h1>
          <span className="w-12 text-right text-sm font-bold text-black/70">
            {index + 1} / {items.length}
          </span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg flex flex-col items-center">
          {!revealed ? (
            <>
              <p className="text-2xl sm:text-3xl font-bold capitalize text-black text-center">
                {current.word}
              </p>
              <button
                type="button"
                onClick={handleReveal}
                className="mt-8 w-full max-w-xs min-h-[48px] rounded-none border-2 border-black bg-white px-6 py-3 text-base font-bold text-black shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none"
              >
                Reveal Meaning
              </button>
            </>
          ) : (
            <div className="mt-0 w-full max-w-lg space-y-6 text-center sm:text-left">
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <p className="text-2xl sm:text-3xl font-bold capitalize text-black">
                  {current.word}
                </p>
                <button
                  type="button"
                  onClick={() => speakWord(current.word)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-black bg-white text-black shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none"
                  aria-label="Pronounce word"
                >
                  <Volume2 className="h-5 w-5 stroke-[2.5]" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => startListening(current.word)}
                  disabled={isListening}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-black bg-white text-black shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Repeat word for pronunciation check"
                >
                  <Mic className="h-5 w-5 stroke-[2.5]" aria-hidden />
                </button>
              </div>
              {(recognizedText || pronunciationFeedback) && (
                <div className="space-y-0.5">
                  {recognizedText && (
                    <p className="text-xs text-zinc-500">
                      Heard: &quot;{recognizedText}&quot;
                    </p>
                  )}
                  {pronunciationFeedback && (
                    <p
                      className={
                        pronunciationFeedback === "Good pronunciation"
                          ? "text-xs text-emerald-400"
                          : "text-xs text-amber-400"
                      }
                    >
                      {pronunciationFeedback}
                    </p>
                  )}
                </div>
              )}
              {isListening && (
                <p className="text-xs text-zinc-500">
                  🎤 Say the word: &quot;{current.word}&quot;
                </p>
              )}
              <section>
                <p className="text-xs font-bold uppercase tracking-wide text-black mb-1">
                  Definition
                </p>
                <p className="text-lg font-bold text-black">{current.meaning}</p>
                {thaiLoading && !thai ? (
                  <p className="mt-1 text-xs text-zinc-500">Translating…</p>
                ) : thai?.definitionThai ? (
                  <p className="mt-1 text-xs text-zinc-500">
                    {thai.definitionThai}
                  </p>
                ) : null}
              </section>
              {current.example ? (
                <section>
                  <p className="text-xs font-bold uppercase tracking-wide text-black mb-1">
                    Example
                  </p>
                  <p className="text-base font-bold text-black">{current.example}</p>
                  {thaiLoading && !thai ? null : thai?.exampleThai ? (
                    <p className="mt-1 text-xs text-zinc-500">
                      {thai.exampleThai}
                    </p>
                  ) : null}
                </section>
              ) : null}
              <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center w-full max-w-sm mx-auto">
                <button
                  type="button"
                  onClick={handleKnown}
                  className="min-h-[48px] flex-1 rounded-none border-2 border-black bg-emerald-200 px-6 py-3 text-base font-bold text-black shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none"
                >
                  ✓ I knew it
                </button>
                <button
                  type="button"
                  onClick={handleUnknown}
                  className="min-h-[48px] flex-1 rounded-none border-2 border-black bg-amber-200 px-6 py-3 text-base font-bold text-black shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none"
                >
                  ✗ I didn&apos;t know it
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
