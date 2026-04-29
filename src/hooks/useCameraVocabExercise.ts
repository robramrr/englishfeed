"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { trackEvent } from "@/lib/analytics";
import {
  getCameraQuizBestScore,
  saveCameraQuizBestScore,
} from "@/lib/cameraQuizProgress";
import { normalizeWord } from "@/lib/pronunciation";

function installMediapipeTfLiteConsoleFilter(): () => void {
  const c = globalThis.console;
  const origErr = c.error;
  const origWarn = c.warn;
  const origLog = c.log;
  const origInfo = c.info;
  const isTfLiteNoise = (args: unknown[]) => {
    const text = args
      .map((a) => (typeof a === "string" ? a : String(a)))
      .join(" ");
    return /TensorFlow Lite|XNNPACK|tflite|Created TensorFlow/i.test(text);
  };
  const forward = (orig: (...x: unknown[]) => void, args: unknown[]) => {
    if (!isTfLiteNoise(args)) orig.apply(c, args);
  };
  c.error = (...args: unknown[]) => forward(origErr as typeof c.error, args);
  c.warn = (...args: unknown[]) => forward(origWarn as typeof c.warn, args);
  c.log = (...args: unknown[]) => forward(origLog as typeof c.log, args);
  c.info = (...args: unknown[]) => forward(origInfo as typeof c.info, args);
  let done = false;
  return () => {
    if (done) return;
    done = true;
    c.error = origErr;
    c.warn = origWarn;
    c.log = origLog;
    c.info = origInfo;
  };
}

export type CameraQuizRound = {
  word: string;
  choices: string[];
  correctIndex: number;
};

export type QuizPayload = {
  lessonId: string;
  lessonTitle: string;
  secondsPerRound: number;
  rounds: CameraQuizRound[];
};

/** cx = face center X; anchorY = where the bottom of the flashcard sits (forehead line), normalized 0–1. */
type OverlayPos = { cx: number; anchorY: number } | null;

export type UseCameraVocabExerciseOptions = {
  lessonId: string;
  userId?: string | null;
  isActive: boolean;
};

export function useCameraVocabExercise({
  lessonId,
  userId,
  isActive,
}: UseCameraVocabExerciseOptions) {
  const [quiz, setQuiz] = useState<QuizPayload | null>(null);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [loadingQuiz, setLoadingQuiz] = useState(true);

  const [roundIndex, setRoundIndex] = useState(0);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imagePaintReady, setImagePaintReady] = useState(true);

  const [overlayPos, setOverlayPos] = useState<OverlayPos>(null);
  const [faceReady, setFaceReady] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);

  const [secondsLeft, setSecondsLeft] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [finished, setFinished] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechHint, setSpeechHint] = useState<string | null>(null);
  const [awaitingSpeechAfterCorrectChoice, setAwaitingSpeechAfterCorrectChoice] =
    useState(false);
  const [pronunciationFeedback, setPronunciationFeedback] = useState<
    "correct" | "wrong" | null
  >(null);

  const selfieVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceLandmarkerRef = useRef<
    import("@mediapipe/tasks-vision").FaceLandmarker | null
  >(null);
  const rafRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const roundsLenRef = useRef(0);
  const mountedRef = useRef(true);
  const flashcardWordRef = useRef<string | null>(null);

  const round = quiz?.rounds[roundIndex] ?? null;
  const totalRounds = quiz?.rounds.length ?? 0;
  const bestBefore = useRef(getCameraQuizBestScore(lessonId));

  roundsLenRef.current = totalRounds;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const stopCameraLoop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const teardown = useCallback(() => {
    stopCameraLoop();
    void faceLandmarkerRef.current?.close();
    faceLandmarkerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setFaceReady(false);
  }, [stopCameraLoop]);

  useEffect(() => {
    if (!isActive) {
      teardown();
      setQuiz(null);
      setQuizError(null);
      setLoadingQuiz(true);
      setRoundIndex(0);
      setImageUrl(null);
      setImageLoading(false);
      setImageError(null);
      setImagePaintReady(true);
      setOverlayPos(null);
      setCamError(null);
      setSecondsLeft(0);
      setScore(0);
      setFeedback(null);
      setFinished(false);
      setListening(false);
      setSpeechHint(null);
      setAwaitingSpeechAfterCorrectChoice(false);
      setPronunciationFeedback(null);
      flashcardWordRef.current = null;
    }
  }, [isActive, teardown]);

  useEffect(() => {
    setAwaitingSpeechAfterCorrectChoice(false);
    setPronunciationFeedback(null);
  }, [roundIndex]);

  const clearRoundTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isActive) return;
    let cancelled = false;
    setLoadingQuiz(true);
    setQuizError(null);
    fetch(`/api/camera-quiz?lessonId=${encodeURIComponent(lessonId)}`)
      .then(async (res) => {
        const data = (await res.json()) as QuizPayload & { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Failed to load quiz");
        if (!cancelled) setQuiz(data);
      })
      .catch((e) => {
        if (!cancelled) {
          setQuizError(e instanceof Error ? e.message : "Failed to load quiz");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingQuiz(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lessonId, isActive]);

  useEffect(() => {
    if (!isActive || !quiz?.rounds?.length) return;
    let cancelled = false;
    const seen = new Set<string>();
    const words: string[] = [];
    for (const r of quiz.rounds) {
      const w = r.word.trim();
      if (!w || seen.has(w)) continue;
      seen.add(w);
      words.push(w);
    }
    void (async () => {
      for (const w of words) {
        if (cancelled) return;
        try {
          await fetch(
            `/api/vocab-flashcard-image?word=${encodeURIComponent(w)}`
          );
        } catch {
          /* best-effort warm cache; round effect still loads each image */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [quiz, isActive]);

  useEffect(() => {
    if (!isActive || !round?.word) {
      flashcardWordRef.current = null;
      setImageUrl(null);
      setImagePaintReady(true);
      setImageLoading(false);
      return;
    }
    let cancelled = false;
    flashcardWordRef.current = round.word;
    setImageUrl(null);
    setImagePaintReady(false);
    setImageLoading(true);
    setImageError(null);
    fetch(`/api/vocab-flashcard-image?word=${encodeURIComponent(round.word)}`)
      .then(async (res) => {
        const data = (await res.json()) as { imageUrl?: string; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Image failed");
        const url = typeof data.imageUrl === "string" ? data.imageUrl : "";
        if (!url) throw new Error("No image URL");
        if (!cancelled) setImageUrl(url);
      })
      .catch((e) => {
        if (!cancelled) {
          setImageError(e instanceof Error ? e.message : "Image error");
          setImageUrl(null);
          setImagePaintReady(true);
        }
      })
      .finally(() => {
        if (!cancelled) setImageLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [round?.word, isActive]);

  useEffect(() => () => teardown(), [teardown]);

  useEffect(() => {
    if (
      !isActive ||
      loadingQuiz ||
      quizError ||
      !quiz ||
      finished
    ) {
      return;
    }

    let cancelled = false;
    let releaseTfLiteFilter: (() => void) | undefined;

    async function start() {
      setCamError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = selfieVideoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        if (cancelled) return;

        releaseTfLiteFilter = installMediapipeTfLiteConsoleFilter();

        const { FaceLandmarker, FilesetResolver } = await import(
          "@mediapipe/tasks-vision"
        );
        const fileset = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm"
        );
        const modelAssetPath =
          "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
        let landmarker: import("@mediapipe/tasks-vision").FaceLandmarker;
        try {
          landmarker = await FaceLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath, delegate: "GPU" },
            runningMode: "VIDEO",
            numFaces: 1,
          });
        } catch {
          landmarker = await FaceLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath, delegate: "CPU" },
            runningMode: "VIDEO",
            numFaces: 1,
          });
        }
        if (cancelled) {
          void landmarker.close();
          return;
        }
        faceLandmarkerRef.current = landmarker;
        setFaceReady(true);

        const tick = () => {
          const lm = faceLandmarkerRef.current;
          const v = selfieVideoRef.current;
          if (!lm || !v || v.readyState < 2) {
            rafRef.current = requestAnimationFrame(tick);
            return;
          }
          const ts = performance.now();
          const result = lm.detectForVideo(v, ts);
          const marks = result.faceLandmarks?.[0];
          if (marks && marks.length > 0) {
            let minX = 1;
            let maxX = 0;
            let minY = 1;
            let maxY = 0;
            for (const p of marks) {
              minX = Math.min(minX, p.x);
              maxX = Math.max(maxX, p.x);
              minY = Math.min(minY, p.y);
              maxY = Math.max(maxY, p.y);
            }
            const faceH = maxY - minY;
            const cx = (minX + maxX) / 2;
            // Hairline is near minY; forehead sits lower—anchor the card there so less is clipped off-screen.
            const foreheadY = minY + faceH * 0.14;
            setOverlayPos({ cx, anchorY: foreheadY });
          } else {
            setOverlayPos(null);
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch (e) {
        releaseTfLiteFilter?.();
        releaseTfLiteFilter = undefined;
        if (!cancelled) {
          setCamError(
            e instanceof Error
              ? e.message
              : "Camera or face tracking unavailable."
          );
        }
      }
    }

    void start();
    return () => {
      cancelled = true;
      releaseTfLiteFilter?.();
      teardown();
    };
  }, [isActive, loadingQuiz, quizError, quiz, finished, teardown]);

  const perRoundSeconds = quiz?.secondsPerRound ?? 45;

  const waitingForRoundImage =
    !!round &&
    !finished &&
    !awaitingSpeechAfterCorrectChoice &&
    (imageLoading || (!!imageUrl && !imagePaintReady && !imageError));

  useEffect(() => {
    if (!isActive) return;
    clearRoundTimer();
    if (!round || finished) return;

    if (awaitingSpeechAfterCorrectChoice) {
      return () => clearRoundTimer();
    }

    if (waitingForRoundImage) {
      return () => clearRoundTimer();
    }

    setFeedback(null);
    setSpeechHint(null);
    let s = perRoundSeconds;
    setSecondsLeft(s);
    intervalRef.current = setInterval(() => {
      s -= 1;
      setSecondsLeft(s);
      if (s <= 0) {
        clearRoundTimer();
        setFeedback("wrong");
        setSpeechHint("Time's up");
        window.setTimeout(() => {
          setFeedback(null);
          setSpeechHint(null);
          setRoundIndex((i) => {
            if (i + 1 >= roundsLenRef.current) {
              setFinished(true);
              return i;
            }
            return i + 1;
          });
        }, 1600);
      }
    }, 1000);
    return () => clearRoundTimer();
  }, [
    isActive,
    roundIndex,
    round?.word,
    finished,
    perRoundSeconds,
    clearRoundTimer,
    awaitingSpeechAfterCorrectChoice,
    waitingForRoundImage,
  ]);

  const advanceRoundAfterDelay = useCallback(
    (deltaScore: number, wasCorrect: boolean) => {
      clearRoundTimer();
      setScore((prev) => prev + deltaScore);
      setFeedback(wasCorrect ? "correct" : "wrong");
      window.setTimeout(() => {
        setFeedback(null);
        setSpeechHint(null);
        setPronunciationFeedback(null);
        setRoundIndex((i) => {
          if (i + 1 >= roundsLenRef.current) {
            setFinished(true);
            return i;
          }
          return i + 1;
        });
      }, 1400);
    },
    [clearRoundTimer]
  );

  const advanceToNextRoundImmediate = useCallback(() => {
    setFeedback(null);
    setSpeechHint(null);
    setPronunciationFeedback(null);
    setAwaitingSpeechAfterCorrectChoice(false);
    setRoundIndex((i) => {
      if (i + 1 >= roundsLenRef.current) {
        setFinished(true);
        return i;
      }
      return i + 1;
    });
  }, []);

  const onPickChoice = useCallback(
    (idx: number) => {
      if (!round || feedback !== null || finished) return;
      const ok = idx === round.correctIndex;
      if (ok) {
        clearRoundTimer();
        setScore((p) => p + 10);
        setFeedback("correct");
        setPronunciationFeedback(null);
        setAwaitingSpeechAfterCorrectChoice(true);
      } else {
        advanceRoundAfterDelay(0, false);
      }
    },
    [round, feedback, finished, advanceRoundAfterDelay, clearRoundTimer]
  );

  const startSpeechAnswer = useCallback(() => {
    if (
      !round ||
      finished ||
      listening ||
      (feedback !== null && !awaitingSpeechAfterCorrectChoice)
    ) {
      return;
    }
    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRec;
      webkitSpeechRecognition?: new () => SpeechRec;
    };
    type SpeechRec = {
      lang: string;
      continuous: boolean;
      interimResults: boolean;
      maxAlternatives: number;
      onresult:
        | ((e: { results: { 0: { 0: { transcript: string } } } }) => void)
        | null;
      onerror: (() => void) | null;
      onend: (() => void) | null;
      start: () => void;
      stop: () => void;
    };
    const SR = win.SpeechRecognition ?? win.webkitSpeechRecognition;
    if (!SR) {
      setSpeechHint("Speech recognition not supported in this browser.");
      return;
    }
    setSpeechHint(null);
    setPronunciationFeedback(null);
    setListening(true);
    const rec = new SR();
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const text = e.results[0]?.[0]?.transcript?.trim() ?? "";
      const heard = normalizeWord(text);
      const target = normalizeWord(round.word);
      const ok =
        heard === target ||
        heard.includes(target) ||
        target.includes(heard);
      setListening(false);
      if (awaitingSpeechAfterCorrectChoice) {
        if (ok) {
          setPronunciationFeedback("correct");
          setSpeechHint(null);
          window.setTimeout(() => {
            if (!mountedRef.current) return;
            advanceToNextRoundImmediate();
          }, 1400);
        } else {
          setPronunciationFeedback("wrong");
          setSpeechHint("Try again — say the word clearly.");
        }
        return;
      }
      if (ok) {
        setPronunciationFeedback("correct");
      } else {
        setPronunciationFeedback("wrong");
      }
      advanceRoundAfterDelay(ok ? 10 : 0, ok);
    };
    rec.onerror = () => {
      setListening(false);
      setSpeechHint("Could not hear you — try again.");
    };
    rec.onend = () => {
      setListening(false);
    };
    try {
      rec.start();
    } catch {
      setListening(false);
      setSpeechHint("Could not start microphone for speech.");
    }
  }, [
    round,
    feedback,
    finished,
    listening,
    advanceRoundAfterDelay,
    awaitingSpeechAfterCorrectChoice,
    advanceToNextRoundImmediate,
  ]);

  useEffect(() => {
    if (!isActive || !finished || !quiz) return;
    const maxScore = totalRounds * 10;
    saveCameraQuizBestScore(lessonId, score);
    void trackEvent(
      "camera_quiz_complete",
      lessonId,
      { score, maxScore, rounds: totalRounds },
      userId ?? null
    );
  }, [isActive, finished, quiz, lessonId, score, totalRounds, userId]);

  const overlayStyle: CSSProperties =
    overlayPos && imageUrl
      ? (() => {
          const rawPct = overlayPos.anchorY * 100;
          // Bottom of card aligns to anchorY via translate(-50%,-100%). Clamp so the card body stays in frame.
          const topPct = Math.min(42, Math.max(14, rawPct));
          return {
            position: "absolute",
            left: `${overlayPos.cx * 100}%`,
            top: `${topPct}%`,
            transform: "translate(-50%, -100%)",
            width: "min(36vw, 152px)",
            maxWidth: "152px",
            pointerEvents: "none",
            zIndex: 10,
          };
        })()
      : {
          position: "absolute",
          left: "50%",
          top: "22%",
          transform: "translate(-50%, -50%)",
          width: "min(36vw, 152px)",
          maxWidth: "152px",
          pointerEvents: "none",
          zIndex: 10,
        };

  const showFeedLayer =
    isActive &&
    !loadingQuiz &&
    !quizError &&
    quiz !== null &&
    !finished;

  const onFlashcardImageDecodeError = useCallback(() => {
    setImagePaintReady(true);
    setImageError("Could not display picture");
  }, []);

  return {
    selfieVideoRef,
    flashcardWordRef,
    showFeedLayer,
    overlayStyle,
    imageUrl,
    imageLoading,
    imageError,
    imagePaintReady,
    setImagePaintReady,
    faceReady,
    camError,
    finished,
    round,
    loadingQuiz,
    quizError,
    quiz,
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
    onPickChoice,
    startSpeechAnswer,
    bestBefore,
    lessonId,
    getCameraQuizBestScore,
    onFlashcardImageDecodeError,
  };
}

export type CameraVocabExerciseApi = ReturnType<typeof useCameraVocabExercise>;
