"use client";

import { Camera, Mic, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { CameraVocabExerciseApi } from "@/hooks/useCameraVocabExercise";

type Props = {
  api: CameraVocabExerciseApi;
  onClose: () => void;
};

/**
 * Quiz UI only (MCQ, mic, timer, score). Camera + flashcard render on the lesson video layer.
 * Rendered via a portal so the feed slide’s overflow-hidden does not clip fixed UI.
 */
export function CameraVocabQuizModal({ api, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const {
    loadingQuiz,
    quizError,
    quiz,
    round,
    roundIndex,
    totalRounds,
    secondsLeft,
    score,
    feedback,
    listening,
    speechHint,
    awaitingSpeechAfterCorrectChoice,
    pronunciationFeedback,
    waitingForRoundImage,
    finished,
    onPickChoice,
    startSpeechAnswer,
    bestBefore,
    lessonId,
    getCameraQuizBestScore: getBest,
  } = api;

  const showMicFooter =
    !loadingQuiz &&
    !quizError &&
    quiz &&
    !finished &&
    !!round;

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-end bg-black/45 pt-[env(safe-area-inset-top,0px)] pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] sm:px-3 sm:pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
      role="dialog"
      aria-modal="true"
      aria-label="Camera vocabulary exercise"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(92dvh,calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-1rem))] w-full max-w-lg flex-col overflow-hidden rounded-lg comic-border bg-white text-brand-navy comic-shadow-md sm:max-h-[min(88dvh,720px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="comic-border-b-4 flex shrink-0 items-center justify-between gap-2 p-3">
          <div className="flex min-w-0 items-center gap-2">
            <Camera className="h-5 w-5 shrink-0" aria-hidden />
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold">Camera vocab</h2>
              {quiz?.lessonTitle && (
                <p className="truncate text-xs font-medium text-zinc-600">
                  {quiz.lessonTitle}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-none comic-border bg-white px-2 py-1 text-sm font-bold comic-shadow-sm"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-3 [-webkit-overflow-scrolling:touch]">
            {loadingQuiz && (
              <p className="text-center text-sm font-bold text-zinc-600">
                Loading quiz…
              </p>
            )}
            {quizError && (
              <div className="space-y-2 text-center">
                <p className="text-sm font-bold text-red-700">{quizError}</p>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-none comic-border bg-white px-4 py-2 text-sm font-bold"
                >
                  Close
                </button>
              </div>
            )}

            {!loadingQuiz && !quizError && quiz && (
              <>
                {!finished && round && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold">
                        Round {roundIndex + 1} / {totalRounds}
                      </p>
                      <p
                        className={`text-sm font-bold ${
                          waitingForRoundImage
                            ? "text-zinc-500"
                            : secondsLeft <= 10
                              ? "text-red-600"
                              : "text-brand-navy"
                        }`}
                        title={
                          waitingForRoundImage
                            ? "Timer starts when the picture is ready"
                            : undefined
                        }
                      >
                        {waitingForRoundImage ? "Picture…" : `${secondsLeft}s`}
                      </p>
                      <p className="text-sm font-bold">Score: {score}</p>
                    </div>

                    {pronunciationFeedback === "correct" && (
                      <p className="text-center text-base font-bold text-emerald-700">
                        Pronunciation correct — well done!
                      </p>
                    )}
                    {pronunciationFeedback === "wrong" && round && (
                      <div className="space-y-1 text-center">
                        <p className="text-base font-bold text-red-700">
                          {`That didn’t match “${round.word}” — try again.`}
                        </p>
                        {awaitingSpeechAfterCorrectChoice && (
                          <p className="text-xs font-bold text-zinc-600">
                            You picked the right word — try the pronunciation
                            once more.
                          </p>
                        )}
                      </div>
                    )}
                    {!pronunciationFeedback && feedback && (
                      <p
                        className={`text-center text-base font-bold ${
                          feedback === "correct"
                            ? "text-emerald-700"
                            : "text-red-700"
                        }`}
                      >
                        {feedback === "correct" &&
                        awaitingSpeechAfterCorrectChoice
                          ? "Correct! Say the word into the mic to continue."
                          : feedback === "correct"
                            ? "Correct!"
                            : "Not quite."}
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      {round.choices.map((label, idx) => (
                        <button
                          key={`${roundIndex}-${label}-${idx}`}
                          type="button"
                          disabled={feedback !== null || waitingForRoundImage}
                          onClick={() => onPickChoice(idx)}
                          className="rounded-none comic-border bg-white py-3 text-sm font-bold comic-shadow-sm transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none disabled:opacity-50"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {finished && (
                  <div className="space-y-3 text-center">
                    <p className="text-lg font-bold">Finished</p>
                    <p className="text-sm font-bold">
                      Score: {score} / {totalRounds * 10}
                    </p>
                    <p className="text-xs text-zinc-600">
                      Best for this lesson:{" "}
                      {Math.max(
                        bestBefore.current,
                        score,
                        getBest(lessonId)
                      )}
                    </p>
                    <button
                      type="button"
                      onClick={onClose}
                      className="w-full rounded-none comic-border bg-white py-3 text-sm font-bold comic-shadow-sm"
                    >
                      Done
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {showMicFooter && (
            <div className="shrink-0 space-y-2 comic-border-t-4 bg-white p-3">
              <button
                type="button"
                onClick={startSpeechAnswer}
                disabled={
                  listening ||
                  waitingForRoundImage ||
                  (feedback !== null && !awaitingSpeechAfterCorrectChoice)
                }
                className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-none comic-border bg-black py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                <Mic className="h-5 w-5 shrink-0 stroke-[2.5]" aria-hidden />
                {listening ? "Listening…" : "Say the word"}
              </button>
              {speechHint ? (
                <p className="text-center text-xs font-bold text-zinc-600">
                  {speechHint}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modal, document.body);
}
