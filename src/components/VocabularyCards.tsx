"use client";

import { useState } from "react";
import Link from "next/link";
import { Bookmark, Mic, Volume2 } from "lucide-react";
import { speakWord } from "@/lib/pronunciation";
import { getSavedVocab, saveVocabItem } from "@/lib/vocabStorage";
import { PronunciationPractice } from "@/components/PronunciationPractice";

export type VocabularyCardItem = {
  word: string;
  partOfSpeech: string;
  definition: string;
  example: string;
  thai: string;
};

type VocabularyCardsProps = {
  vocabulary: VocabularyCardItem[];
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
};

export function VocabularyCards({
  vocabulary,
  loading = false,
  error = null,
  onClose,
}: VocabularyCardsProps) {
  const [index, setIndex] = useState(0);
  const [showThaiTranslation, setShowThaiTranslation] = useState(false);
  const [pronunciationOpen, setPronunciationOpen] = useState(false);
  const [savedInSession, setSavedInSession] = useState<Set<string>>(new Set());
  const total = vocabulary.length;
  const card = total > 0 ? vocabulary[index] : null;

  const isSaved = card
    ? getSavedVocab().some(
        (e) => e.word.trim().toLowerCase() === card.word.trim().toLowerCase()
      ) || savedInSession.has(card.word.trim().toLowerCase())
    : false;

  const handlePrev = () => {
    setIndex((i) => Math.max(0, i - 1));
    setShowThaiTranslation(false);
  };
  const handleNext = () => {
    setIndex((i) => Math.min(total - 1, i + 1));
    setShowThaiTranslation(false);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Vocabulary cards"
      onClick={onClose}
      suppressHydrationWarning
    >
      <div
        className="w-full max-w-md rounded-none border-2 border-black bg-white text-black shadow-[3px_3px_0px_black]"
        onClick={(e) => e.stopPropagation()}
        suppressHydrationWarning
      >
        <div className="flex items-center justify-between border-b-2 border-black p-4">
          <h2 className="text-lg font-bold text-black">Vocabulary</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-none border-2 border-black bg-white px-2 py-1 text-sm font-bold text-black shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="min-h-[280px] p-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 font-bold text-black">
              <p>Extracting vocabulary…</p>
            </div>
          )}
          {error && !loading && (
            <div className="py-6 text-center text-red-700 font-bold">
              <p>{error}</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-4 rounded-none border-2 border-black bg-white px-4 py-2 text-sm font-bold text-black shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none"
              >
                Close
              </button>
            </div>
          )}
          {!loading && !error && card && (
            <div className="space-y-4">
              <p className="text-sm font-bold text-black">
                {index + 1} / {total}
              </p>
              <p className="text-2xl font-bold text-black">{card.word}</p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => speakWord(card.word)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-none border-2 border-black bg-white text-black shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none"
                  aria-label="Hear word"
                >
                  <Volume2 className="h-5 w-5 stroke-[2.5]" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => setPronunciationOpen(true)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-none border-2 border-black bg-white text-black shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none"
                  aria-label="Practice pronunciation"
                >
                  <Mic className="h-5 w-5 stroke-[2.5]" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => setShowThaiTranslation((prev) => !prev)}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-none border-2 border-black bg-white text-base shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none ${
                    showThaiTranslation ? "opacity-100" : "opacity-60"
                  }`}
                  aria-label={showThaiTranslation ? "Hide Thai" : "Show Thai"}
                >
                  🇹🇭
                </button>
                <button
                  type="button"
                  onClick={() => {
                    saveVocabItem({
                      word: card.word,
                      meaning: card.definition,
                      example: card.example,
                    });
                    setSavedInSession((prev) =>
                      new Set(prev).add(card.word.trim().toLowerCase())
                    );
                  }}
                  disabled={isSaved}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-none border-2 border-black bg-white text-black shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none disabled:opacity-60 disabled:pointer-events-none"
                  aria-label={isSaved ? "Saved" : "Save word"}
                >
                  <Bookmark
                    className={`h-5 w-5 stroke-[2.5] ${isSaved ? "fill-black" : ""}`}
                    aria-hidden
                  />
                </button>
              </div>

              {card.partOfSpeech && (
                <p className="text-sm italic font-bold text-black">
                  {card.partOfSpeech}
                </p>
              )}
              <p className="text-sm font-bold text-black">{card.definition}</p>
              {card.example && (
                <p className="text-sm italic font-bold text-black">
                  &ldquo;{card.example}&rdquo;
                </p>
              )}
              {showThaiTranslation && card.thai && (
                <p className="text-sm font-bold text-black">{card.thai}</p>
              )}
            </div>
          )}
          {!loading && !error && total === 0 && (
            <div className="py-6 text-center font-bold text-black">
              <p>No vocabulary extracted.</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-4 rounded-none border-2 border-black bg-white px-4 py-2 text-sm font-bold text-black shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none"
              >
                Close
              </button>
            </div>
          )}
        </div>

        {!loading && !error && total > 0 && (
          <>
            <div className="flex items-center justify-between border-t-2 border-black p-4">
              <button
                type="button"
                onClick={handlePrev}
                disabled={index === 0}
                className="rounded-none border-2 border-black bg-white px-4 py-2 text-sm font-bold text-black shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none disabled:opacity-50 disabled:pointer-events-none"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={index === total - 1}
                className="rounded-none border-2 border-black bg-white px-4 py-2 text-sm font-bold text-black shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none disabled:opacity-50 disabled:pointer-events-none"
              >
                Next
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 border-t-2 border-black p-4">
              <Link
                href="/profile/vocabulary"
                className="rounded-none border-2 border-black bg-white px-3 py-2 text-sm font-bold text-black shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none"
                onClick={(e) => e.stopPropagation()}
              >
                📘 Vocabulary
              </Link>
              <Link
                href="/profile/clips"
                className="rounded-none border-2 border-black bg-white px-3 py-2 text-sm font-bold text-black shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none"
                onClick={(e) => e.stopPropagation()}
              >
                ✂ Clips
              </Link>
              <Link
                href="/profile/review"
                className="rounded-none border-2 border-black bg-white px-3 py-2 text-sm font-bold text-black shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none"
                onClick={(e) => e.stopPropagation()}
              >
                🧠 Review
              </Link>
            </div>
          </>
        )}
      </div>

      {pronunciationOpen && card && (
        <PronunciationPractice
          expectedSentence={card.word}
          onClose={() => setPronunciationOpen(false)}
        />
      )}
    </div>
  );
}
