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

const quickLinkClass =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-none border-2 border-black bg-white text-sm font-bold text-black shadow-[2px_2px_0px_black] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none active:scale-95";

const actionBtnClass =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-none border-2 border-black bg-white text-black shadow-[2px_2px_0px_black] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none active:scale-95 active:shadow-none disabled:opacity-60 disabled:pointer-events-none";

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
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Vocabulary cards"
      onClick={onClose}
      suppressHydrationWarning
    >
      <div
        className="flex max-h-[min(88dvh,720px)] w-full max-w-md flex-col overflow-hidden rounded-none border-2 border-black bg-white text-black shadow-[3px_3px_0px_black]"
        onClick={(e) => e.stopPropagation()}
        suppressHydrationWarning
      >
        <div className="flex shrink-0 items-center gap-2 border-b-2 border-black p-3">
          <h2 className="min-w-0 truncate text-base font-bold text-black sm:text-lg">
            Vocabulary
          </h2>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <Link
              href="/profile/vocabulary"
              className={quickLinkClass}
              onClick={(e) => e.stopPropagation()}
              aria-label="My vocabulary"
              title="My vocabulary"
            >
              📘
            </Link>
            <Link
              href="/profile/clips"
              className={quickLinkClass}
              onClick={(e) => e.stopPropagation()}
              aria-label="My clips"
              title="My clips"
            >
              ✂
            </Link>
            <Link
              href="/profile/review"
              className={quickLinkClass}
              onClick={(e) => e.stopPropagation()}
              aria-label="Review"
              title="Review"
            >
              🧠
            </Link>
            <button
              type="button"
              onClick={onClose}
              className={quickLinkClass}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-8 font-bold text-black">
              <p>Extracting vocabulary…</p>
            </div>
          )}
          {error && !loading && (
            <div className="py-4 text-center text-red-700 font-bold">
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
            <div className="space-y-3">
              <p className="text-xs font-bold text-black sm:text-sm">
                {index + 1} / {total}
              </p>
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 flex-1 break-words text-xl font-bold text-black sm:text-2xl">
                  {card.word}
                </p>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => speakWord(card.word)}
                    className={actionBtnClass}
                    aria-label="Hear word"
                  >
                    <Volume2 className="h-4 w-4 stroke-[2.5] sm:h-5 sm:w-5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPronunciationOpen(true)}
                    className={actionBtnClass}
                    aria-label="Practice pronunciation"
                  >
                    <Mic className="h-4 w-4 stroke-[2.5] sm:h-5 sm:w-5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowThaiTranslation((prev) => !prev)}
                    className={`${actionBtnClass} text-base ${
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
                    className={actionBtnClass}
                    aria-label={isSaved ? "Saved" : "Save word"}
                  >
                    <Bookmark
                      className={`h-4 w-4 stroke-[2.5] sm:h-5 sm:w-5 ${isSaved ? "fill-black" : ""}`}
                      aria-hidden
                    />
                  </button>
                </div>
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
            <div className="py-4 text-center font-bold text-black">
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
          <div className="flex shrink-0 items-center justify-between border-t-2 border-black p-3">
            <button
              type="button"
              onClick={handlePrev}
              disabled={index === 0}
              className="rounded-none border-2 border-black bg-white px-3 py-1.5 text-sm font-bold text-black shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none disabled:opacity-50 disabled:pointer-events-none sm:px-4 sm:py-2"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={index === total - 1}
              className="rounded-none border-2 border-black bg-white px-3 py-1.5 text-sm font-bold text-black shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none disabled:opacity-50 disabled:pointer-events-none sm:px-4 sm:py-2"
            >
              Next
            </button>
          </div>
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
