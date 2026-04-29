"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import {
  getSavedVocab,
  removeVocabItem,
  type SavedVocabItem,
} from "@/lib/vocabStorage";

export default function VocabularyPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [items, setItems] = useState<SavedVocabItem[]>([]);

  const load = useCallback(() => {
    setItems(getSavedVocab());
  }, []);

  useEffect(() => {
    if (!loading && !user) router.replace("/auth");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    load();
  }, [user, load]);

  const handleRemove = useCallback(
    (word: string) => {
      if (!user) return;
      removeVocabItem(word);
      setItems(getSavedVocab());
    },
    [user]
  );

  if (loading || !user) return null;

  return (
    <div className="flex min-h-screen flex-col overflow-y-auto bg-white text-black">
      <header className="shrink-0 border-b-2 border-black bg-white px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <Link
            href="/profile"
            className="text-sm font-bold text-black underline"
            aria-label="Back to profile"
          >
            ← Back
          </Link>
          <h1 className="text-lg font-bold text-black">My vocabulary</h1>
          <span className="w-12" aria-hidden />
        </div>
      </header>

      <main className="min-h-0 flex-1">
        <div className="mx-auto max-w-lg px-4 py-6 pb-8">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
            <p className="text-base font-bold text-black">
              You haven&apos;t saved any words yet.
            </p>
            <p className="text-sm font-bold text-black">
              Tap &quot;Save Word&quot; in the subtitle popup to build your
              vocabulary.
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {items.map((item) => (
              <li
                key={`${item.word}-${item.savedAt}`}
                className="rounded-none border-2 border-black bg-white p-4 shadow-[3px_3px_0px_black]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-bold capitalize leading-snug text-black">
                      {item.word}
                    </p>
                    <p className="mt-2 text-[15px] leading-relaxed font-bold text-black">
                      {item.meaning}
                    </p>
                    {item.example ? (
                      <p className="mt-2 text-sm italic leading-relaxed font-bold text-black">
                        {item.example}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(item.word)}
                    className="shrink-0 rounded-none border-2 border-black bg-white px-3 py-2 text-sm font-bold text-black shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label={`Remove ${item.word}`}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        </div>
      </main>
    </div>
  );
}
