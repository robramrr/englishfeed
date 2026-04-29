"use client";

import { useEffect, useRef, useState } from "react";

interface VideoThumbnailImageProps {
  thumbnailUrl?: string | null;
  /** When provided and image is missing/broken, show a video frame at 1s as thumbnail. */
  videoUrl?: string | null;
  title?: string;
  variant?: "default" | "brutalist";
}

const SEEK_TIME = 1;

/**
 * Shared thumbnail for lesson/liked/saved grids.
 * 1) If thumbnailUrl loads → show <img>
 * 2) Else if videoUrl provided → show <video> paused at 1s (real frame)
 * 3) Else → placeholder with ▶ and title
 */
export default function VideoThumbnailImage({
  thumbnailUrl,
  videoUrl,
  title = "",
  variant = "default",
}: VideoThumbnailImageProps) {
  const [broken, setBroken] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const showImage = thumbnailUrl && !broken;
  const useVideoFallback = !showImage && !!videoUrl;

  useEffect(() => {
    if (!useVideoFallback || !videoRef.current) return;
    const video = videoRef.current;
    const seekToFrame = () => {
      const t = video.duration >= SEEK_TIME ? SEEK_TIME : video.duration * 0.2;
      video.currentTime = t;
    };
    const onCanPlay = seekToFrame;
    const onSeeked = () => {
      video.pause();
      setVideoReady(true);
    };
    const onError = () => {
      setVideoReady(false);
    };
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    if (video.readyState >= 2) {
      seekToFrame();
    }
    return () => {
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
  }, [useVideoFallback, videoUrl]);

  if (showImage) {
    return (
      <img
        src={thumbnailUrl!}
        alt={title}
        className={`aspect-[9/16] w-full object-cover ${
          variant === "brutalist" ? "rounded-none" : "rounded-md"
        }`}
        onError={() => setBroken(true)}
      />
    );
  }

  if (useVideoFallback) {
    return (
      <div
        className={`relative aspect-[9/16] w-full overflow-hidden ${
          variant === "brutalist" ? "rounded-none bg-white" : "rounded-md bg-zinc-900"
        }`}
      >
        <video
          ref={videoRef}
          src={videoUrl!}
          muted
          playsInline
          preload="auto"
          className={`aspect-[9/16] w-full object-cover ${
            variant === "brutalist" ? "rounded-none" : "rounded-md"
          }`}
        />
        {!videoReady && (
          <div
            className={`absolute inset-0 flex items-center justify-center ${
              variant === "brutalist" ? "bg-white" : "bg-zinc-800"
            }`}
          >
            <span
              className={`text-lg ${
                variant === "brutalist" ? "text-black/60" : "text-zinc-500"
              }`}
              role="img"
            >
              ▶
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative flex aspect-[9/16] w-full items-end justify-center px-1 pb-1 ${
        variant === "brutalist"
          ? "rounded-none bg-white"
          : "rounded-md bg-gradient-to-t from-zinc-900 via-zinc-800 to-zinc-700"
      }`}
      aria-hidden
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className={`text-lg ${variant === "brutalist" ? "text-black/60" : "text-zinc-500"}`}
          role="img"
        >
          ▶
        </span>
      </div>
      {title ? (
        <p
          className={`relative z-10 line-clamp-2 w-full px-1 py-0.5 text-[10px] font-bold ${
            variant === "brutalist"
              ? "rounded-none border-2 border-black bg-white text-black shadow-[2px_2px_0px_black]"
              : "rounded-sm bg-black/40 text-zinc-100"
          }`}
        >
          {title}
        </p>
      ) : null}
    </div>
  );
}
