"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Mic } from "lucide-react";
import {
  connectAnalyserForMonitoring,
  createMediaRecorder,
  createTimeDomainBuffer,
  openMicStream,
  peakFromTimeDomain,
  recordingFilenameForMime,
  stopMediaRecorder,
  stopStream,
} from "@/lib/audioRecording";
import { speakWord } from "@/lib/pronunciation";

/** Stereo / volume waves — same as quiz & subtitle popup */
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

export type PronunciationResult = {
  score: number;
  transcript: string;
  feedback: { word: string; correct: boolean }[];
  accentInsight?: {
    shortLine: string;
    likelyAccent: string;
    confidence: "low" | "medium" | "high";
    summary: string;
    tips: string[];
  };
};

type PronunciationPracticeProps = {
  expectedSentence: string;
  onClose: () => void;
};

type Status = "idle" | "recording" | "processing" | "result" | "error";

const WAVE_CANVAS_LOGICAL_H = 56;

function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ||
    (
      window as unknown as {
        webkitAudioContext?: typeof AudioContext;
      }
    ).webkitAudioContext ||
    null
  );
}

function normalizeShortLine(text: string, maxChars: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  const clean = normalized.replace(/[.!?]+$/, "");
  const fallback = "Accent influence is subtle; keep practicing key contrast sounds.";
  if (!clean) return fallback;
  if (clean.length <= maxChars) return `${clean}.`;
  return fallback;
}

export function PronunciationPractice({
  expectedSentence,
  onClose,
}: PronunciationPracticeProps) {
  const API_COOLDOWN_MS = 3000;
  const MIN_RECORDING_MS = 1500;
  const MIN_AUDIO_BYTES = 500;
  const MIN_AUDIO_PEAK = 6;
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<PronunciationResult | null>(null);
  const [showThaiTranslation, setShowThaiTranslation] = useState(false);
  const [thaiSentence, setThaiSentence] = useState<string | null>(null);
  const [thaiLoading, setThaiLoading] = useState(false);
  const [micInputWarning, setMicInputWarning] = useState(false);
  const thaiCacheRef = useRef<Map<string, string>>(new Map());
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartedAtMsRef = useRef<number>(0);
  const lastApiCallAtMsRef = useRef<number>(0);
  const lastCheckedSentenceRef = useRef<string>("");
  const lastCheckedResultRef = useRef<PronunciationResult | null>(null);

  const waveCanvasRef = useRef<HTMLCanvasElement>(null);
  const waveContainerRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const visualizationActiveRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const waveDataArrayRef = useRef<Uint8Array | null>(null);
  const peakLevelRef = useRef(0);
  const recordingBusyRef = useRef(false);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const monitorStreamRef = useRef<MediaStream | null>(null);

  const teardownLiveWaveform = useCallback(() => {
    visualizationActiveRef.current = false;
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    try {
      mediaStreamSourceRef.current?.disconnect();
    } catch {
      /* already disconnected */
    }
    mediaStreamSourceRef.current = null;
    analyserRef.current = null;
    waveDataArrayRef.current = null;
    void audioContextRef.current?.close();
    audioContextRef.current = null;
  }, []);

  useEffect(() => {
    return () => teardownLiveWaveform();
  }, [teardownLiveWaveform]);

  useEffect(() => {
    setShowThaiTranslation(false);
    setThaiSentence(null);
    setThaiLoading(false);
  }, [expectedSentence]);

  const handleThaiToggle = useCallback(() => {
    const s = expectedSentence.trim();
    if (!s) return;
    if (showThaiTranslation) {
      setShowThaiTranslation(false);
      return;
    }
    setShowThaiTranslation(true);
    const cached = thaiCacheRef.current.get(s);
    if (cached !== undefined) {
      setThaiSentence(cached);
      return;
    }
    setThaiLoading(true);
    setThaiSentence(null);
    fetch("/api/translate-sentence-thai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sentence: s }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("fail"))))
      .then((data: { thai?: string }) => {
        const t = typeof data.thai === "string" ? data.thai : "";
        thaiCacheRef.current.set(s, t);
        setThaiSentence(t);
      })
      .catch(() => {
        thaiCacheRef.current.set(s, "");
        setThaiSentence("");
      })
      .finally(() => setThaiLoading(false));
  }, [expectedSentence, showThaiTranslation]);

  const startRecording = useCallback(async () => {
    if (recordingBusyRef.current) return;
    recordingBusyRef.current = true;
    let micStream: MediaStream | null = null;
    try {
      micStream = await openMicStream();
      const recordStream = micStream.clone();
      const monitorStream = micStream.clone();
      recordStreamRef.current = recordStream;
      monitorStreamRef.current = monitorStream;
      peakLevelRef.current = 0;
      setMicInputWarning(false);

      flushSync(() => setStatus("recording"));

      const { recorder, mimeType: mime } = createMediaRecorder(recordStream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onerror = () => {
        setErrorMessage("Recording failed. Try again.");
        setStatus("error");
      };
      recorder.onstop = async () => {
        teardownLiveWaveform();
        stopStream(micStream);
        stopStream(recordStreamRef.current);
        stopStream(monitorStreamRef.current);
        recordStreamRef.current = null;
        monitorStreamRef.current = null;
        recordingBusyRef.current = false;

        const recordingDurationMs = Date.now() - recordingStartedAtMsRef.current;
        if (recordingDurationMs < MIN_RECORDING_MS) {
          setStatus("idle");
          return;
        }

        const normalizedSentence = expectedSentence.trim();
        if (
          lastCheckedSentenceRef.current === normalizedSentence &&
          lastCheckedResultRef.current
        ) {
          setResult(lastCheckedResultRef.current);
          setStatus("result");
          return;
        }

        const now = Date.now();
        if (now - lastApiCallAtMsRef.current < API_COOLDOWN_MS) {
          setStatus("idle");
          return;
        }
        lastApiCallAtMsRef.current = now;

        const totalBytes = chunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0);
        if (totalBytes < MIN_AUDIO_BYTES || peakLevelRef.current < MIN_AUDIO_PEAK) {
          setErrorMessage(
            "No speech detected. Check Chrome's mic permission (lock icon in the address bar), speak louder, and watch for the waveform to move."
          );
          setStatus("error");
          return;
        }

        const blob = new Blob(chunksRef.current, { type: mime });
        setStatus("processing");
        setErrorMessage(null);
        setResult(null);

        const formData = new FormData();
        formData.append("audio", blob, recordingFilenameForMime(mime));
        formData.append("expectedSentence", expectedSentence);

        try {
          const res = await fetch("/api/pronunciation-check", {
            method: "POST",
            body: formData,
          });
          const data = await res.json();
          if (!res.ok) {
            setErrorMessage(data.error ?? "Pronunciation check failed");
            setStatus("error");
            return;
          }
          setResult({
            score: data.score ?? 0,
            transcript: data.transcript ?? "",
            feedback: Array.isArray(data.feedback) ? data.feedback : [],
            accentInsight:
              data?.accentInsight &&
              typeof data.accentInsight.shortLine === "string" &&
              typeof data.accentInsight.likelyAccent === "string" &&
              typeof data.accentInsight.summary === "string" &&
              Array.isArray(data.accentInsight.tips)
                ? {
                    shortLine: normalizeShortLine(data.accentInsight.shortLine, 75),
                    likelyAccent: data.accentInsight.likelyAccent,
                    confidence:
                      data.accentInsight.confidence === "high" ||
                      data.accentInsight.confidence === "medium" ||
                      data.accentInsight.confidence === "low"
                        ? data.accentInsight.confidence
                        : "low",
                    summary: data.accentInsight.summary,
                    tips: data.accentInsight.tips
                      .filter((tip: unknown): tip is string => typeof tip === "string")
                      .slice(0, 3),
                  }
                : undefined,
          });
          lastCheckedSentenceRef.current = normalizedSentence;
          lastCheckedResultRef.current = {
            score: data.score ?? 0,
            transcript: data.transcript ?? "",
            feedback: Array.isArray(data.feedback) ? data.feedback : [],
            accentInsight:
              data?.accentInsight &&
              typeof data.accentInsight.shortLine === "string" &&
              typeof data.accentInsight.likelyAccent === "string" &&
              typeof data.accentInsight.summary === "string" &&
              Array.isArray(data.accentInsight.tips)
                ? {
                    shortLine: normalizeShortLine(data.accentInsight.shortLine, 75),
                    likelyAccent: data.accentInsight.likelyAccent,
                    confidence:
                      data.accentInsight.confidence === "high" ||
                      data.accentInsight.confidence === "medium" ||
                      data.accentInsight.confidence === "low"
                        ? data.accentInsight.confidence
                        : "low",
                    summary: data.accentInsight.summary,
                    tips: data.accentInsight.tips
                      .filter((tip: unknown): tip is string => typeof tip === "string")
                      .slice(0, 3),
                  }
                : undefined,
          };
          setStatus("result");
        } catch (e) {
          setErrorMessage("Request failed. Try again.");
          setStatus("error");
        }
      };

      const AC = getAudioContextConstructor();
      if (!AC) {
        stopStream(micStream);
        stopStream(recordStream);
        stopStream(monitorStream);
        recordingBusyRef.current = false;
        setErrorMessage("Audio visualization is not supported in this browser.");
        setStatus("error");
        return;
      }

      const audioContext = new AC();
      await audioContext.resume();
      const source = audioContext.createMediaStreamSource(monitorStream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.35;
      connectAnalyserForMonitoring(source, analyser, audioContext);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      mediaStreamSourceRef.current = source;
      waveDataArrayRef.current = createTimeDomainBuffer(analyser);

      const syncWaveCanvasSizeIfNeeded = () => {
        const canvas = waveCanvasRef.current;
        const wrap = waveContainerRef.current;
        if (!canvas || !wrap) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.max(1, Math.floor(wrap.clientWidth));
        const h = WAVE_CANVAS_LOGICAL_H;
        const nextW = Math.floor(w * dpr);
        const nextH = Math.floor(h * dpr);
        if (canvas.width === nextW && canvas.height === nextH) return;
        canvas.width = nextW;
        canvas.height = nextH;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.scale(dpr, dpr);
        }
      };

      visualizationActiveRef.current = true;
      const drawWaveform = () => {
        if (!visualizationActiveRef.current) return;
        const canvas = waveCanvasRef.current;
        const wrap = waveContainerRef.current;
        const analyserNode = analyserRef.current;
        const data = waveDataArrayRef.current;
        if (canvas && wrap && analyserNode && data) {
          syncWaveCanvasSizeIfNeeded();
          const ctx = canvas.getContext("2d");
          if (ctx) {
            const w = Math.max(1, Math.floor(wrap.clientWidth));
            const h = WAVE_CANVAS_LOGICAL_H;
            analyserNode.getByteTimeDomainData(
              data as Uint8Array<ArrayBuffer>
            );
            const peak = peakFromTimeDomain(data);
            if (peak > peakLevelRef.current) peakLevelRef.current = peak;
            if (peak >= MIN_AUDIO_PEAK) setMicInputWarning(false);
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = 2;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.beginPath();
            const bufLen = data.length;
            const mid = h * 0.5;
            for (let i = 0; i < bufLen; i++) {
              const x = (i / Math.max(1, bufLen - 1)) * w;
              const v = (data[i] - 128) / 128;
              const y = mid + v * mid * 0.92;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.stroke();
          }
        }
        animationFrameRef.current = requestAnimationFrame(drawWaveform);
      };

      recorder.start(250);
      recordingStartedAtMsRef.current = Date.now();
      window.setTimeout(() => {
        if (peakLevelRef.current < MIN_AUDIO_PEAK) {
          setMicInputWarning(true);
        }
      }, 700);
      animationFrameRef.current = requestAnimationFrame(drawWaveform);
    } catch (e) {
      teardownLiveWaveform();
      stopStream(micStream);
      stopStream(recordStreamRef.current);
      stopStream(monitorStreamRef.current);
      recordStreamRef.current = null;
      monitorStreamRef.current = null;
      recordingBusyRef.current = false;
      setErrorMessage(
        e instanceof Error && e.message
          ? e.message
          : "Microphone access denied or unavailable."
      );
      setStatus("error");
    }
  }, [expectedSentence, teardownLiveWaveform]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && status === "recording" && recorder.state !== "inactive") {
      stopMediaRecorder(recorder);
    }
  }, [status]);

  const handleBack = useCallback(() => {
    setStatus("idle");
    setErrorMessage(null);
    setResult(null);
    setMicInputWarning(false);
  }, []);

  const label =
    status === "idle"
      ? expectedSentence.trim()
        ? "Tap to record"
        : "Loading sentence..."
      : status === "recording"
        ? "Recording..."
        : status === "processing"
          ? "Checking pronunciation..."
          : "";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Pronunciation practice"
      onClick={onClose}
      suppressHydrationWarning
    >
      <div
        className="flex max-h-[min(88dvh,720px)] w-full max-w-md flex-col overflow-hidden comic-border bg-white text-brand-navy comic-shadow-sm rounded-none"
        onClick={(e) => e.stopPropagation()}
        suppressHydrationWarning
      >
        <div className="flex shrink-0 items-center justify-between comic-border-b-4 p-3 sm:p-4">
          <h2 className="min-w-0 truncate text-base font-bold text-brand-navy sm:text-lg">
            Pronunciation Practice
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-none comic-border bg-white px-2 py-1 text-sm font-bold text-brand-navy comic-shadow-sm transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto space-y-4 p-3 sm:p-4">
          <p className="text-sm font-bold text-brand-navy">Say this sentence:</p>
          <div className="rounded-none comic-border bg-white px-3 py-2">
            <div className="flex items-start gap-2">
              <p className="min-w-0 flex-1 font-semibold leading-snug text-brand-navy">
                {expectedSentence.trim() || "Loading practice sentence…"}
              </p>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => speakWord(expectedSentence.trim())}
                  disabled={!expectedSentence.trim()}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-none comic-border bg-white text-brand-navy comic-shadow-sm transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none disabled:opacity-40"
                  aria-label="Play sentence audio"
                >
                  <SpeakerIcon className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={handleThaiToggle}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-none comic-border bg-white text-base text-brand-navy comic-shadow-sm transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none ${
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
              <div className="mt-2 comic-border-t-4 pt-2">
                {thaiLoading ? (
                  <p className="text-sm font-medium text-brand-navy">Translating…</p>
                ) : thaiSentence ? (
                  <p className="text-sm font-medium text-brand-navy">{thaiSentence}</p>
                ) : (
                  <p className="text-sm font-medium text-zinc-500">
                    Translation unavailable.
                  </p>
                )}
              </div>
            )}
          </div>

          <div
            ref={waveContainerRef}
            className={`w-full overflow-hidden bg-white transition-[height,border-width] ${
              status === "recording"
                ? "h-14 comic-border"
                : "h-0 border-0"
            }`}
            aria-hidden={status !== "recording"}
          >
            <canvas
              ref={waveCanvasRef}
              className="block h-full w-full"
              aria-label="Live input level"
            />
          </div>

          {status === "recording" && micInputWarning && (
            <p className="text-sm font-bold text-amber-700">
              No mic input detected — check Chrome&apos;s mic permission (lock icon in
              the address bar) and your system input device.
            </p>
          )}

          {status === "idle" && (
            <button
              type="button"
              onClick={startRecording}
              disabled={!expectedSentence.trim()}
              className="w-full rounded-none comic-border bg-white py-3 text-base font-bold text-brand-navy comic-shadow-sm transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none"
            >
              <Mic className="mr-2 inline-block h-5 w-5 stroke-[2.5]" aria-hidden />
              {label}
            </button>
          )}

          {status === "recording" && (
            <button
              type="button"
              onClick={stopRecording}
              className="w-full rounded-none comic-border bg-brand-red py-3 text-base font-bold text-white comic-shadow-sm transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none"
            >
              <Mic className="mr-2 inline-block h-5 w-5 stroke-[2.5]" aria-hidden />
              {label}
            </button>
          )}

          {status === "processing" && (
            <div className="py-2 text-center text-brand-navy font-bold">
              Checking pronunciation...
            </div>
          )}

          {status === "error" && errorMessage && (
            <div className="space-y-2">
              <p className="text-red-700 font-bold">{errorMessage}</p>
              <button
                type="button"
                onClick={handleBack}
                className="rounded-none comic-border bg-white px-4 py-2 text-sm font-bold text-brand-navy comic-shadow-sm transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none"
              >
                Try again
              </button>
            </div>
          )}

          {status === "result" && result && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm font-bold text-brand-navy">
                  Pronunciation Score
                </p>
                <p className="text-3xl font-bold text-brand-navy">
                  {result.score}/100
                </p>
              </div>
              {result.transcript && (
                <p className="text-sm font-bold text-brand-navy">
                  Heard:{" "}
                  <span className="text-brand-navy">{result.transcript}</span>
                </p>
              )}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {result.feedback.map((item, i) => (
                  <span
                    key={`${i}-${item.word}`}
                    className={`inline-flex items-center gap-1 rounded-none comic-border px-1.5 py-0.5 text-sm font-bold ${
                      item.correct
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {item.word} {item.correct ? "✔" : "✖"}
                  </span>
                ))}
              </div>
              {result.accentInsight && (
                <div className="space-y-2 comic-border bg-amber-50 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-brand-navy">
                    Experimental Accent Insight
                  </p>
                  <ul className="space-y-1">
                    <li className="text-sm font-medium text-brand-navy">
                      - {normalizeShortLine(result.accentInsight.shortLine, 75)}
                    </li>
                    {result.accentInsight.tips.map((tip, idx) => (
                      <li
                        key={`${idx}-${tip}`}
                        className="text-sm font-medium text-brand-navy"
                      >
                        - {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <button
                type="button"
                onClick={handleBack}
                className="w-full rounded-none comic-border bg-white py-2 text-sm font-bold text-brand-navy comic-shadow-sm transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none"
              >
                Record again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
