"use client";

import type { CSSProperties, MutableRefObject, RefObject } from "react";
import type { CameraQuizRound } from "@/hooks/useCameraVocabExercise";

type Props = {
  selfieVideoRef: RefObject<HTMLVideoElement | null>;
  flashcardWordRef: MutableRefObject<string | null>;
  imageUrl: string | null;
  imageLoading: boolean;
  imageError: string | null;
  imagePaintReady: boolean;
  setImagePaintReady: (v: boolean) => void;
  onImageDecodeError: () => void;
  overlayStyle: CSSProperties;
  faceReady: boolean;
  camError: string | null;
  finished: boolean;
  round: CameraQuizRound | null;
};

/**
 * Selfie camera + floating flashcard image, absolutely stacked on the lesson video area.
 */
export function CameraVocabFeedOverlay({
  selfieVideoRef,
  flashcardWordRef,
  imageUrl,
  imageLoading,
  imageError,
  imagePaintReady,
  setImagePaintReady,
  onImageDecodeError,
  overlayStyle,
  faceReady,
  camError,
  finished,
  round,
}: Props) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[35] overflow-hidden bg-black"
      aria-hidden
    >
      <video
        ref={selfieVideoRef}
        className="h-full w-full scale-x-[-1] object-cover"
        playsInline
        muted
        autoPlay
      />
      {imageUrl && !imageLoading && (
        <div style={overlayStyle}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt=""
            className="w-full rounded-lg border-2 border-white shadow-lg"
            onLoad={() => {
              const w = round?.word;
              if (w && flashcardWordRef.current === w) {
                setImagePaintReady(true);
              }
            }}
            onError={() => {
              const w = round?.word;
              if (w && flashcardWordRef.current === w) {
                onImageDecodeError();
              }
            }}
          />
        </div>
      )}
      {(imageLoading || (!!imageUrl && !imagePaintReady && !imageError)) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm font-bold text-white">
          {imageLoading ? "Loading picture…" : "Preparing picture…"}
        </div>
      )}
      {imageError && (
        <div className="pointer-events-none absolute bottom-2 left-2 right-2 rounded border-2 border-amber-500 bg-amber-50 px-2 py-1 text-xs font-bold text-amber-900">
          {imageError}
        </div>
      )}
      {!faceReady && !camError && !finished && (
        <div className="pointer-events-none absolute bottom-2 left-2 rounded comic-border bg-white/90 px-2 py-1 text-[10px] font-bold text-brand-navy">
          Starting camera…
        </div>
      )}
      {camError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-3 text-center text-sm font-bold text-white">
          {camError}
        </div>
      )}
    </div>
  );
}
