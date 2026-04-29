"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Mic } from "lucide-react";
import { cancelSpeech, speakWord } from "@/lib/pronunciation";

export type TutorRoleplayContext = {
  lessonTitle: string;
  lessonDescription: string;
  topic?: string;
  tags?: string[];
  subtitleSnippet?: string;
};

type Turn = { role: "tutor" | "user"; text: string };
type PronunciationCheckData = {
  score?: number;
  transcript?: string;
  error?: string;
};
type PracticeStatus = "idle" | "recording" | "processing" | "result" | "error";

type Props = {
  context: TutorRoleplayContext;
  onClose: () => void;
};

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

export function TutorRoleplayModal({ context, onClose }: Props) {
  const PASSING_SCORE = 75;
  const MIN_COHERENT_WORDS = 3;
  const MIN_RECORDING_MS = 1200;
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [practiceSentence, setPracticeSentence] = useState<string | null>(null);
  const [practiceStatus, setPracticeStatus] = useState<PracticeStatus>("idle");
  const [practiceError, setPracticeError] = useState<string | null>(null);
  const [practiceScore, setPracticeScore] = useState<number | null>(null);
  const [practiceTranscript, setPracticeTranscript] = useState<string>("");
  const [isCurrentInputValidated, setIsCurrentInputValidated] = useState(false);
  const [showTutorThai, setShowTutorThai] = useState(false);
  const [tutorThai, setTutorThai] = useState<string | null>(null);
  const [tutorThaiLoading, setTutorThaiLoading] = useState(false);
  const [showPracticeThai, setShowPracticeThai] = useState(false);
  const [practiceThai, setPracticeThai] = useState<string | null>(null);
  const [practiceThaiLoading, setPracticeThaiLoading] = useState(false);
  const [spellingChecking, setSpellingChecking] = useState(false);
  const [spellingPass, setSpellingPass] = useState(true);
  const [spellingFail, setSpellingFail] = useState<{
    corrected: string;
    issues: string[];
  } | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef(0);
  const mimeTypeRef = useRef("audio/webm");
  const thaiCacheRef = useRef<Map<string, string>>(new Map());
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastSpokenTutorRef = useRef("");

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handleClose = useCallback(() => {
    cancelSpeech();
    onClose();
  }, [onClose]);

  useEffect(() => {
    return () => {
      cancelSpeech();
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [turns, scrollToBottom]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setTurns([]);
    fetch("/api/tutor-roleplay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context, start: true, messages: [] }),
    })
      .then(async (res) => {
        const data = (await res.json()) as { reply?: string; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Failed to start");
        const reply = typeof data.reply === "string" ? data.reply : "";
        if (!reply) throw new Error("Empty reply");
        if (!cancelled) {
          setTurns([{ role: "tutor", text: reply }]);
          setShowTutorThai(false);
          setTutorThai(null);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not start tutor");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    context.lessonTitle,
    context.lessonDescription,
    context.topic,
    context.tags?.join(","),
    context.subtitleSnippet,
  ]);

  const latestTutorLine =
    [...turns].reverse().find((t) => t.role === "tutor")?.text.trim() ?? "";

  useEffect(() => {
    if (loading || !latestTutorLine) return;
    if (lastSpokenTutorRef.current === latestTutorLine) return;
    lastSpokenTutorRef.current = latestTutorLine;
    speakWord(latestTutorLine);
  }, [latestTutorLine, loading]);

  const fetchThai = useCallback(async (sentence: string): Promise<string> => {
    const normalized = sentence.trim();
    if (!normalized) return "";
    const cached = thaiCacheRef.current.get(normalized);
    if (cached !== undefined) return cached;
    const res = await fetch("/api/translate-sentence-thai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sentence: normalized }),
    });
    if (!res.ok) throw new Error("Translation failed");
    const data = (await res.json()) as { thai?: string };
    const thai = typeof data.thai === "string" ? data.thai : "";
    thaiCacheRef.current.set(normalized, thai);
    return thai;
  }, []);

  const handleTutorThaiToggle = useCallback(async () => {
    if (!latestTutorLine) return;
    if (showTutorThai) {
      setShowTutorThai(false);
      return;
    }
    setShowTutorThai(true);
    setTutorThaiLoading(true);
    try {
      setTutorThai(await fetchThai(latestTutorLine));
    } catch {
      setTutorThai("");
    } finally {
      setTutorThaiLoading(false);
    }
  }, [fetchThai, latestTutorLine, showTutorThai]);

  const handlePracticeThaiToggle = useCallback(async () => {
    if (!practiceSentence) return;
    if (showPracticeThai) {
      setShowPracticeThai(false);
      return;
    }
    setShowPracticeThai(true);
    setPracticeThaiLoading(true);
    try {
      setPracticeThai(await fetchThai(practiceSentence));
    } catch {
      setPracticeThai("");
    } finally {
      setPracticeThaiLoading(false);
    }
  }, [fetchThai, practiceSentence, showPracticeThai]);

  const sendUser = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || loading) return;
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    if (wordCount < MIN_COHERENT_WORDS) {
      setError(`Please type a full sentence (${MIN_COHERENT_WORDS}+ words).`);
      return;
    }
    if (!isCurrentInputValidated || practiceSentence !== text) {
      setError("Tap record and pass pronunciation before sending.");
      return;
    }
    if (spellingChecking || !spellingPass) {
      setError("Fix spelling or wait for the spelling check to finish.");
      return;
    }
    const historyForApi = turns.map((t) => ({
      role: t.role === "user" ? ("user" as const) : ("assistant" as const),
      content: t.text,
    }));
    historyForApi.push({ role: "user", content: text });
    setInput("");
    setTurns((prev) => [...prev, { role: "user", text }]);
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/tutor-roleplay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context,
          messages: historyForApi,
        }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      const reply = typeof data.reply === "string" ? data.reply : "";
      if (!reply) throw new Error("Empty reply");
      setTurns((prev) => [...prev, { role: "tutor", text: reply }]);
      setPracticeSentence(null);
      setPracticeStatus("idle");
      setPracticeError(null);
      setPracticeScore(null);
      setPracticeTranscript("");
      setIsCurrentInputValidated(false);
      setInput("");
      setShowPracticeThai(false);
      setPracticeThai(null);
      setShowTutorThai(false);
      setTutorThai(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
      setTurns((prev) => prev.slice(0, -1));
      setInput(text);
    } finally {
      setSending(false);
    }
  }, [
    context,
    input,
    isCurrentInputValidated,
    loading,
    practiceSentence,
    sending,
    spellingChecking,
    spellingPass,
    turns,
  ]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (!practiceSentence) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      mimeTypeRef.current = mime;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      setPracticeError(null);
      setPracticeStatus("recording");
      recordingStartedAtRef.current = Date.now();
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const elapsed = Date.now() - recordingStartedAtRef.current;
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (elapsed < MIN_RECORDING_MS) {
          setPracticeStatus("idle");
          setPracticeError("Please speak a little longer.");
          return;
        }
        setPracticeStatus("processing");
        try {
          const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
          const formData = new FormData();
          formData.append("audio", blob, "tutor-practice.webm");
          formData.append("expectedSentence", practiceSentence);
          const res = await fetch("/api/pronunciation-check", {
            method: "POST",
            body: formData,
          });
          const data = (await res.json()) as PronunciationCheckData;
          if (!res.ok) throw new Error(data.error ?? "Pronunciation check failed");
          const score = Number.isFinite(data.score) ? Number(data.score) : 0;
          setPracticeScore(score);
          setPracticeTranscript(
            typeof data.transcript === "string" ? data.transcript : ""
          );
          setPracticeStatus("result");
          if (score >= PASSING_SCORE) {
            setIsCurrentInputValidated(true);
            setPracticeError(null);
          } else {
            setIsCurrentInputValidated(false);
            setPracticeError(`Score ${score}/100. Try once more to continue.`);
          }
        } catch (e) {
          setPracticeStatus("error");
          setIsCurrentInputValidated(false);
          setPracticeError(
            e instanceof Error ? e.message : "Could not check pronunciation."
          );
        }
      };
      recorder.start(100);
    } catch {
      setPracticeStatus("error");
      setPracticeError("Microphone access denied or unavailable.");
    }
  }, [practiceSentence]);

  useEffect(() => {
    const text = input.trim();
    const coherent = text.split(/\s+/).filter(Boolean).length >= MIN_COHERENT_WORDS;
    if (!coherent) {
      setPracticeSentence(null);
      setPracticeStatus("idle");
      setPracticeError(null);
      setPracticeScore(null);
      setPracticeTranscript("");
      setIsCurrentInputValidated(false);
      setSpellingChecking(false);
      setSpellingPass(true);
      setSpellingFail(null);
      return;
    }
    if (practiceSentence !== text) {
      setPracticeSentence(text);
      setPracticeStatus("idle");
      setPracticeError(null);
      setPracticeScore(null);
      setPracticeTranscript("");
      setIsCurrentInputValidated(false);
      setShowPracticeThai(false);
      setPracticeThai(null);
    }
  }, [input, practiceSentence]);

  useEffect(() => {
    const text = practiceSentence?.trim() ?? "";
    if (!text || text.split(/\s+/).filter(Boolean).length < MIN_COHERENT_WORDS) {
      setSpellingChecking(false);
      setSpellingPass(true);
      setSpellingFail(null);
      return;
    }
    setSpellingChecking(true);
    setSpellingPass(false);
    setSpellingFail(null);
    const id = window.setTimeout(() => {
      fetch("/api/tutor-spelling", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      })
        .then(async (res) => {
          const data = (await res.json()) as {
            ok?: boolean;
            corrected?: string;
            issues?: unknown;
          };
          if (data.ok === true) {
            setSpellingPass(true);
            setSpellingFail(null);
          } else {
            const corrected =
              typeof data.corrected === "string" && data.corrected.trim()
                ? data.corrected.trim()
                : text;
            const issues = Array.isArray(data.issues)
              ? data.issues.filter((x): x is string => typeof x === "string")
              : [];
            setSpellingPass(false);
            setSpellingFail({ corrected, issues });
          }
        })
        .catch(() => {
          setSpellingPass(true);
          setSpellingFail(null);
        })
        .finally(() => setSpellingChecking(false));
    }, 450);
    return () => window.clearTimeout(id);
  }, [practiceSentence]);

  const canRecord =
    !!practiceSentence &&
    spellingPass &&
    !spellingChecking &&
    !loading &&
    !sending &&
    (practiceStatus === "idle" || practiceStatus === "result" || practiceStatus === "error");
  const hasCoherentInput = !!practiceSentence;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="AI role-play tutor"
      onClick={handleClose}
      suppressHydrationWarning
    >
      <div
        className="flex max-h-[min(90dvh,640px)] w-full max-w-md flex-col rounded-none border-2 border-black bg-white text-black shadow-[3px_3px_0px_black]"
        onClick={(e) => e.stopPropagation()}
        suppressHydrationWarning
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b-2 border-black p-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-base font-bold text-black">
              <Bot className="h-4 w-4 shrink-0" aria-hidden />
              Role-play tutor
            </div>
            <div className="mt-1 truncate text-sm font-medium text-zinc-600">
              {context.lessonTitle}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-none border-2 border-black bg-white px-2 py-1 text-sm font-bold shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none"
            aria-label="Close tutor"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading && (
            <p className="text-center text-base font-bold text-zinc-600">
              Starting scene from this video…
            </p>
          )}
          {error && !loading && turns.length === 0 && (
            <div className="space-y-3 text-center">
              <p className="text-base font-bold text-red-700">{error}</p>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-none border-2 border-black bg-white px-4 py-2 text-sm font-bold shadow-[3px_3px_0px_black]"
              >
                Close
              </button>
            </div>
          )}
          {error && turns.length > 0 && (
            <p className="mb-2 text-center text-sm font-bold text-red-700">{error}</p>
          )}
          {!!latestTutorLine && (
            <div className="mb-3 rounded-none border-2 border-black bg-white px-3 py-2">
              <div className="flex items-start gap-2">
                <p className="min-w-0 flex-1 text-base font-semibold leading-snug text-black">
                  {latestTutorLine}
                </p>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => speakWord(latestTutorLine)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-none border-2 border-black bg-white text-black shadow-[2px_2px_0px_black] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
                    aria-label="Play tutor line audio"
                  >
                    <SpeakerIcon className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleTutorThaiToggle()}
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-none border-2 border-black bg-white text-base text-black shadow-[2px_2px_0px_black] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none ${
                      showTutorThai ? "opacity-100" : "opacity-70"
                    }`}
                    aria-label={
                      showTutorThai
                        ? "Hide Thai translation"
                        : "Show Thai translation"
                    }
                  >
                    🇹🇭
                  </button>
                </div>
              </div>
              {showTutorThai && (
                <div className="mt-2 border-t-2 border-black pt-2">
                  {tutorThaiLoading ? (
                    <p className="text-sm font-medium text-black">Translating…</p>
                  ) : tutorThai ? (
                    <p className="text-sm font-medium text-black">{tutorThai}</p>
                  ) : (
                    <p className="text-sm font-medium text-zinc-500">
                      Translation unavailable.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="space-y-3">
            {turns.filter((t) => t.role === "user").map((t, i) => (
              <div
                key={`${t.role}-${i}`}
                className="ml-4 rounded-none border-2 border-black bg-zinc-100 px-3 py-2 text-base leading-snug text-black"
              >
                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-500">
                  You
                </span>
                {t.text}
              </div>
            ))}
          </div>
          <div ref={bottomRef} />
        </div>

        <div className="shrink-0 border-t-2 border-black p-3">
          <div className="mb-3 space-y-2 rounded-none border-2 border-black bg-white p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (isCurrentInputValidated && practiceSentence === input.trim()) {
                    void sendUser();
                  }
                }
              }}
              disabled={loading || sending}
              placeholder={`Type your line in English (at least ${MIN_COHERENT_WORDS} words)…`}
              className="w-full border-2 border-black bg-white px-2 py-2 text-base outline-none disabled:opacity-50"
            />
              <>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (practiceSentence) speakWord(practiceSentence);
                  }}
                  disabled={!practiceSentence}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-none border-2 border-black bg-white text-black shadow-[2px_2px_0px_black] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none disabled:opacity-40"
                  aria-label="Play your sentence audio"
                >
                  <SpeakerIcon className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => void handlePracticeThaiToggle()}
                  disabled={!practiceSentence}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-none border-2 border-black bg-white text-base text-black shadow-[2px_2px_0px_black] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none disabled:opacity-40 ${
                    showPracticeThai ? "opacity-100" : "opacity-70"
                  }`}
                  aria-label={
                    showPracticeThai
                      ? "Hide Thai translation"
                      : "Show Thai translation"
                  }
                >
                  🇹🇭
                </button>
                <div className="min-w-0 flex-1">
                  {isCurrentInputValidated ? (
                    <div className="flex min-h-[42px] w-full items-center justify-center rounded-none border-2 border-black bg-emerald-50 px-2 py-2 text-center text-sm font-bold text-emerald-900">
                      Ready — tap Send
                    </div>
                  ) : (
                    <>
                      {practiceStatus === "idle" && (
                        <button
                          type="button"
                          onClick={() => void startRecording()}
                          disabled={!canRecord}
                          className="flex w-full items-center justify-center gap-2 rounded-none border-2 border-black bg-white py-2.5 text-sm font-bold text-black shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none disabled:opacity-50"
                        >
                          <Mic className="h-5 w-5 shrink-0 stroke-[2.5]" aria-hidden />
                          Tap to record
                        </button>
                      )}
                      {practiceStatus === "recording" && (
                        <button
                          type="button"
                          onClick={stopRecording}
                          className="flex w-full items-center justify-center gap-2 rounded-none border-2 border-black bg-red-500 py-2.5 text-sm font-bold text-white shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none"
                        >
                          <Mic className="h-5 w-5 shrink-0 stroke-[2.5]" aria-hidden />
                          Recording… tap to stop
                        </button>
                      )}
                      {practiceStatus === "processing" && (
                        <div className="flex min-h-[42px] w-full items-center justify-center rounded-none border-2 border-black bg-white px-2 py-2 text-center text-sm font-bold text-black">
                          Checking pronunciation…
                        </div>
                      )}
                      {(practiceStatus === "result" || practiceStatus === "error") && (
                        <button
                          type="button"
                          onClick={() => void startRecording()}
                          disabled={!canRecord}
                          className="flex w-full items-center justify-center gap-2 rounded-none border-2 border-black bg-white py-2.5 text-sm font-bold text-black shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none disabled:opacity-50"
                        >
                          <Mic className="h-5 w-5 shrink-0 stroke-[2.5]" aria-hidden />
                          Tap to record again
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
              {showPracticeThai && (
                <div className="rounded-none border-2 border-black bg-white px-3 py-2">
                  {practiceThaiLoading ? (
                    <p className="text-sm font-medium text-black">Translating…</p>
                  ) : practiceThai ? (
                    <p className="text-sm font-medium text-black">{practiceThai}</p>
                  ) : (
                    <p className="text-sm font-medium text-zinc-500">
                      Translation unavailable.
                    </p>
                  )}
                </div>
              )}
              {spellingChecking && hasCoherentInput && (
                <p className="text-xs font-medium text-zinc-600">
                  Checking spelling…
                </p>
              )}
              {spellingFail && hasCoherentInput && (
                <div className="rounded-none border-2 border-amber-600 bg-amber-50 px-3 py-2 text-sm">
                  <p className="font-bold text-black">Spelling check</p>
                  {spellingFail.issues.length > 0 && (
                    <ul className="mt-1 list-inside list-disc font-medium text-black">
                      {spellingFail.issues.map((issue, i) => (
                        <li key={`${i}-${issue}`}>{issue}</li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-1 font-medium text-black">
                    Suggested:{" "}
                    <span className="font-semibold">{spellingFail.corrected}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setInput(spellingFail.corrected)}
                    className="mt-2 w-full rounded-none border-2 border-black bg-white py-2 text-sm font-bold text-black shadow-[2px_2px_0px_black] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
                  >
                    Use correction
                  </button>
                </div>
              )}
              {practiceStatus === "result" && (
                <p className="text-sm font-bold text-black">
                  Score: {practiceScore ?? 0}/100
                  {practiceTranscript ? ` - Heard: ${practiceTranscript}` : ""}
                </p>
              )}
              {practiceError && (
                <p className="text-sm font-bold text-red-700">{practiceError}</p>
              )}
              {!practiceSentence && practiceScore !== null && practiceScore >= PASSING_SCORE && (
                <p className="text-sm font-bold text-emerald-700">
                  Great pronunciation. Continue the conversation.
                </p>
              )}
              {isCurrentInputValidated && (
                <p className="text-sm font-bold text-emerald-700">
                  Great pronunciation. Tap Send to submit your line.
                </p>
              )}
              <button
                type="button"
                onClick={() => void sendUser()}
                disabled={
                  loading ||
                  sending ||
                  !input.trim() ||
                  !isCurrentInputValidated ||
                  practiceSentence !== input.trim() ||
                  spellingChecking ||
                  !spellingPass
                }
                className="w-full border-2 border-black bg-black px-3 py-2 text-base font-bold text-white disabled:opacity-50"
              >
                {sending ? "…" : "Send"}
              </button>
              </>
          </div>
        </div>
      </div>
    </div>
  );
}
