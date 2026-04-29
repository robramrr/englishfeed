"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getSavedVocab, type SavedVocabItem } from "@/lib/vocabStorage";

function useProgressStats() {
  const [items, setItems] = useState<SavedVocabItem[]>([]);

  const load = useCallback(() => {
    setItems(getSavedVocab());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const wordsSaved = items.length;
  const wordsReviewed = items.reduce(
    (sum, item) => sum + (item.knownCount ?? 0) + (item.unknownCount ?? 0),
    0
  );
  const wordsKnown = items.filter(
    (item) => (item.knownCount ?? 0) > (item.unknownCount ?? 0)
  ).length;
  const wordsDifficult = items.filter(
    (item) => (item.unknownCount ?? 0) > (item.knownCount ?? 0)
  ).length;
  const topDifficult = [...items]
    .sort((a, b) => (b.unknownCount ?? 0) - (a.unknownCount ?? 0))
    .filter((item) => (item.unknownCount ?? 0) > 0)
    .slice(0, 5);

  return {
    items,
    wordsSaved,
    wordsReviewed,
    wordsKnown,
    wordsDifficult,
    topDifficult,
  };
}

export default function ProgressPage() {
  const {
    items,
    wordsSaved,
    wordsReviewed,
    wordsKnown,
    wordsDifficult,
    topDifficult,
  } = useProgressStats();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/95 px-4 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <Link
            href="/"
            className="text-sm text-zinc-400 underline"
            aria-label="Back to feed"
          >
            ← Back
          </Link>
          <h1 className="text-lg font-semibold">Progress</h1>
          <span className="w-12" aria-hidden />
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6 pb-8">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
            <p className="text-base text-zinc-300">No progress yet.</p>
            <p className="text-sm text-zinc-500">
              Save and review words to start tracking your learning.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            <section>
              <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500 mb-4">
                Summary
              </h2>
              <ul className="space-y-4">
                <li className="flex items-baseline justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
                  <span className="text-zinc-300">Words Saved</span>
                  <span className="text-2xl font-semibold tabular-nums text-white">
                    {wordsSaved}
                  </span>
                </li>
                <li className="flex items-baseline justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
                  <span className="text-zinc-300">Words Reviewed</span>
                  <span className="text-2xl font-semibold tabular-nums text-white">
                    {wordsReviewed}
                  </span>
                </li>
                <li className="flex items-baseline justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
                  <span className="text-zinc-300">Words Known</span>
                  <span className="text-2xl font-semibold tabular-nums text-emerald-400">
                    {wordsKnown}
                  </span>
                </li>
                <li className="flex items-baseline justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
                  <span className="text-zinc-300">Words Difficult</span>
                  <span className="text-2xl font-semibold tabular-nums text-amber-400">
                    {wordsDifficult}
                  </span>
                </li>
              </ul>
            </section>

            {wordsKnown + wordsDifficult > 0 && (
              <section>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
                    Mastery
                  </h2>
                  <span className="text-sm font-semibold tabular-nums text-emerald-400">
                    {Math.round(
                      (wordsKnown / (wordsKnown + wordsDifficult)) * 100
                    )}
                    %
                  </span>
                </div>
                <div
                  className="h-3 w-full overflow-hidden rounded-full bg-zinc-800"
                  role="progressbar"
                  aria-valuenow={
                    wordsKnown + wordsDifficult > 0
                      ? Math.round(
                          (wordsKnown / (wordsKnown + wordsDifficult)) * 100
                        )
                      : 0
                  }
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Mastery progress"
                >
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-[width] duration-300 ease-out"
                    style={{
                      width: `${(wordsKnown / (wordsKnown + wordsDifficult)) * 100}%`,
                    }}
                  />
                </div>
              </section>
            )}

            <p className="text-center text-sm text-zinc-500">
              {wordsSaved > 0 && (
                <>
                  You have {wordsSaved} word{wordsSaved === 1 ? "" : "s"} in
                  your vocabulary.
                  {wordsKnown + wordsDifficult > 0 &&
                    (wordsDifficult === 0 ? (
                      <> All reviewed words are in your known set — keep it up!</>
                    ) : (
                      <> Review difficult words to grow your mastery.</>
                    ))}
                </>
              )}
            </p>

            {topDifficult.length > 0 && (
              <section>
                <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500 mb-4">
                  Words to Review More
                </h2>
                <ul className="space-y-3">
                  {topDifficult.map((item) => (
                    <li
                      key={`${item.word}-${item.savedAt}`}
                      className="flex items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3"
                    >
                      <span className="font-medium capitalize text-white">
                        {item.word}
                      </span>
                      <span className="text-sm text-amber-400 tabular-nums">
                        unknown: {item.unknownCount ?? 0}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
