"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PracticeQuestion } from "@/types/lesson";
import { speakWord } from "@/lib/pronunciation";

/** Same speaker icon as the subtitle word popup (stereo / volume waves). */
function SpeakerIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06Zm5.084 1.046a.75.75 0 0 1 1.06 0 8.25 8.25 0 0 1 0 11.668.75.75 0 0 1-1.06-1.06 6.75 6.75 0 0 0 0-9.548.75.75 0 0 1 0-1.06Zm-3.182 3.182a.75.75 0 0 1 1.06 0 4.5 4.5 0 0 1 0 6.364.75.75 0 0 1-1.06-1.06 3 3 0 0 0 0-4.244.75.75 0 0 1 0-1.06Z" />
    </svg>
  );
}

type PracticeQuizProps = {
  title?: string;
  questions: PracticeQuestion[] | null;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
};

export function PracticeQuiz({
  title,
  questions,
  loading = false,
  error = null,
  onClose,
}: PracticeQuizProps) {
  const total = questions?.length ?? 0;
  const [index, setIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [showThaiTranslation, setShowThaiTranslation] = useState(false);
  const [thaiSentence, setThaiSentence] = useState<string | null>(null);
  const [thaiLoading, setThaiLoading] = useState(false);
  const thaiCacheRef = useRef<Map<string, string>>(new Map());

  const current = questions?.[index];
  const isAnswered = selectedIndex != null;
  const isCorrect =
    isAnswered && selectedIndex === (current?.correctIndex ?? -1);

  const canContinue = isAnswered || completed;

  const progressLabel = useMemo(() => {
    if (completed) return "Complete";
    return `${index + 1} / ${total}`;
  }, [completed, index, total]);

  const handleSelect = useCallback(
    (i: number) => {
      if (completed || !current) return;
      if (selectedIndex != null) return;
      setSelectedIndex(i);
      if (i === current.correctIndex) setCorrectCount((c) => c + 1);
    },
    [completed, selectedIndex, current]
  );

  const handleNext = useCallback(() => {
    if (completed) {
      onClose();
      return;
    }
    if (selectedIndex == null) return;
    const nextIndex = index + 1;
    if (nextIndex >= total) {
      setCompleted(true);
      return;
    }
    setIndex(nextIndex);
    setSelectedIndex(null);
  }, [completed, index, onClose, selectedIndex, total]);

  useEffect(() => {
    setShowThaiTranslation(false);
    setThaiSentence(null);
    setThaiLoading(false);
  }, [index]);

  const handleThaiToggle = useCallback(() => {
    if (!current) return;
    const q = current.question;
    if (showThaiTranslation) {
      setShowThaiTranslation(false);
      return;
    }
    setShowThaiTranslation(true);
    const cached = thaiCacheRef.current.get(q);
    if (cached !== undefined) {
      setThaiSentence(cached);
      return;
    }
    setThaiLoading(true);
    setThaiSentence(null);
    fetch("/api/translate-sentence-thai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sentence: q }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("fail"))))
      .then((data: { thai?: string }) => {
        const t = typeof data.thai === "string" ? data.thai : "";
        thaiCacheRef.current.set(q, t);
        setThaiSentence(t);
      })
      .catch(() => {
        thaiCacheRef.current.set(q, "");
        setThaiSentence("");
      })
      .finally(() => setThaiLoading(false));
  }, [current, showThaiTranslation]);

  if (loading) {
    return (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3 sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Practice quiz"
        onClick={onClose}
        suppressHydrationWarning
      >
        <div
          className="w-full max-w-md rounded-none border-2 border-black bg-white p-6 text-center text-black shadow-[3px_3px_0px_black]"
          onClick={(e) => e.stopPropagation()}
          suppressHydrationWarning
        >
          <div className="text-black font-bold">Loading practice questions…</div>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 rounded-none border-2 border-black bg-white px-4 py-2 text-sm font-bold text-black shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3 sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Practice quiz"
        onClick={onClose}
        suppressHydrationWarning
      >
        <div
          className="w-full max-w-md rounded-none border-2 border-black bg-white p-6 text-center text-black shadow-[3px_3px_0px_black]"
          onClick={(e) => e.stopPropagation()}
          suppressHydrationWarning
        >
          <div className="text-red-700 font-bold">{error}</div>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 rounded-none border-2 border-black bg-white px-4 py-2 text-sm font-bold text-black shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (!questions || questions.length === 0 || !current) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Practice quiz"
      onClick={onClose}
      suppressHydrationWarning
    >
        <div
          className="flex max-h-[min(88dvh,720px)] w-full max-w-md flex-col overflow-hidden rounded-none border-2 border-black bg-white text-black shadow-[3px_3px_0px_black]"
          onClick={(e) => e.stopPropagation()}
          suppressHydrationWarning
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b-2 border-black p-3 sm:p-4">
          <div className="min-w-0">
            <div className="text-sm font-bold">{progressLabel}</div>
            <div className="truncate text-base font-bold text-black">
              {title ?? "Practice"}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-none border-2 border-black bg-white px-2 py-1 text-sm font-bold text-black shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none"
            aria-label="Close practice"
          >
            ✕
          </button>
        </div>

          <div className="min-h-0 flex-1 overflow-y-auto space-y-4 p-3 sm:p-4">
          {!completed ? (
            <>
              <div className="flex items-start gap-2">
                <p className="min-w-0 flex-1 text-lg font-bold leading-snug text-black">
                  {current.question}
                </p>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => speakWord(current.question)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-none border-2 border-black bg-white text-black shadow-[2px_2px_0px_black] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
                    aria-label="Play question audio"
                  >
                    <SpeakerIcon className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleThaiToggle}
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-none border-2 border-black bg-white text-base text-black shadow-[2px_2px_0px_black] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none ${
                      showThaiTranslation ? "opacity-100" : "opacity-70"
                    }`}
                    aria-label={
                      showThaiTranslation
                        ? "Hide Thai translation"
                        : "Show Thai translation"
                    }
                  >
                    🇹🇭
                  </button>
                </div>
              </div>
              {showThaiTranslation && (
                <div className="rounded-none border-2 border-black bg-zinc-50 px-3 py-2 shadow-[2px_2px_0px_black]">
                  {thaiLoading ? (
                    <p className="text-sm font-medium text-black">Translating…</p>
                  ) : thaiSentence ? (
                    <p className="text-sm font-medium text-black">{thaiSentence}</p>
                  ) : (
                    <p className="text-sm font-medium text-zinc-500">
                      Translation unavailable.
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                {current.options.map((opt, i) => {
                  const chosen = selectedIndex === i;
                  const correct = i === current.correctIndex;
                  const showCorrect = isAnswered && correct;
                  const showWrong = isAnswered && chosen && !correct;

                  const base =
                    "w-full rounded-none border-2 border-black bg-white px-3 py-2.5 text-left font-bold text-black shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none disabled:cursor-not-allowed";
                  const stateClass = showCorrect
                    ? "bg-emerald-400 text-black hover:bg-emerald-400"
                    : showWrong
                      ? "bg-red-400 text-black hover:bg-red-400"
                      : chosen
                        ? "bg-zinc-100 text-black"
                        : "hover:bg-zinc-50";

                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSelect(i)}
                      disabled={isAnswered}
                      className={`${base} ${stateClass}`}
                      aria-pressed={chosen}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>

              {isAnswered && (
                <div
                  className={`rounded-none border-2 border-black p-3 shadow-[3px_3px_0px_black] ${
                    isCorrect ? "bg-emerald-400" : "bg-white"
                  }`}
                >
                  <div
                    className={`text-sm font-semibold ${
                      isCorrect ? "text-black" : "text-red-800"
                    }`}
                  >
                    {isCorrect ? "Correct!" : "Incorrect"}
                  </div>
                  {!isCorrect && (
                    <div className="mt-1 text-sm font-bold">
                      Correct answer:{" "}
                      <span className="font-bold">
                        {current.options[current.correctIndex]}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <div className="text-xl font-bold">Practice complete!</div>
              <div className="text-sm font-bold">
                Score:{" "}
                <span className="font-bold">
                  {correctCount} / {total}
                </span>
              </div>
            </div>
          )}
        </div>

          <div className="flex shrink-0 items-center justify-end gap-2 border-t-2 border-black p-3 sm:p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-none border-2 border-black bg-white px-4 py-2 text-sm font-bold text-black shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none"
          >
            {completed ? "Close" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={!canContinue}
            className="rounded-none border-2 border-black bg-white px-4 py-2 text-sm font-bold text-black shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {completed ? "Done" : index + 1 >= total ? "Finish" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}

