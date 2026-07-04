"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type {
  Lesson,
  PracticeQuestion,
  VocabularyItem,
} from "@/types/lesson";
import { trackEvent } from "@/lib/analytics";
import { saveClip } from "@/lib/clipStorage";
import {
  addLikedLesson,
  isLiked as isLikedStored,
  removeLikedLesson,
} from "@/lib/feedStorage";
import { getSavedVocab, saveVocabItem } from "@/lib/vocabStorage";
import { PracticeQuiz } from "@/components/PracticeQuiz";
import { PronunciationPractice } from "@/components/PronunciationPractice";
import {
  VocabularyCards,
  type VocabularyCardItem,
} from "@/components/VocabularyCards";
import {
  TutorRoleplayModal,
  type TutorRoleplayContext,
} from "@/components/TutorRoleplayModal";
import { CameraVocabFeedOverlay } from "@/components/CameraVocabFeedOverlay";
import { CameraVocabQuizModal } from "@/components/CameraVocabQuizModal";
import { useCameraVocabExercise } from "@/hooks/useCameraVocabExercise";
import {
  buildPlaybackSubtitleSegments,
  findActiveSubtitle,
  type PlaybackSubtitleSegment,
  type WordTiming,
} from "@/lib/subtitlePlayback";
import {
  BookOpen,
  Bot,
  Camera,
  ClipboardList,
  Heart,
  Info,
  MessageCircle,
  Mic,
  Volume2,
  VolumeX,
} from "lucide-react";

interface SubtitleSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  words?: WordTiming[];
}

interface SubtitlesData {
  segments: SubtitleSegment[];
}

/** Subtitle text near `timeSec` for tutor / AI grounding (frozen when modal opens). */
function subtitleSnippetAroundTime(
  segments: SubtitleSegment[],
  timeSec: number,
  windowSec = 28,
  maxChars = 620,
): string {
  if (!segments.length || !Number.isFinite(timeSec) || timeSec < 0) return "";
  const winStart = timeSec - windowSec * 0.35;
  const winEnd = timeSec + windowSec * 0.65;
  const parts = segments
    .filter((s) => s.end >= winStart && s.start <= winEnd)
    .map((s) => s.text.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const text = parts.join(" ");
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 3).trim()}...`;
}

type ContextDefinitionData = {
  contextDefinition: string;
  synonyms: string[];
  examples: string[];
};

const CONTEXT_STOPWORDS = new Set([
  "the", "is", "a", "an", "to", "of", "and", "or", "in", "on", "at", "for",
  "with", "from", "by", "as", "it", "this", "that", "these", "those", "are",
  "was", "were", "be", "been", "being", "you", "your", "i", "we", "they",
  "he", "she", "them", "our", "us", "me", "my", "his", "her", "their"
]);

interface VideoSlideProps {
  lesson: Lesson;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
  scrollContainerReady?: boolean;
  /** When set, seek the video to this time (e.g. from a clip link). */
  initialSeekTime?: number;
  /** Authenticated Supabase user id, used for analytics. */
  userId?: string | null;
}

import { speakWord, usePronunciationCheck } from "@/lib/pronunciation";

const contractions: Record<string, string> = {
  "i'm": "i am",
  "you're": "you are",
  "he's": "he is",
  "she's": "she is",
  "it's": "it is",
  "we're": "we are",
  "they're": "they are",
  "that's": "that is",
  "that'll": "that will",
  "won't": "will not",
  "don't": "do not",
  "can't": "cannot",
};

const DEFAULT_MEANING = {
  partOfSpeech: "word",
  definitions: ["a word used in spoken or written English"],
  examples: [] as string[],
};

const commonWordFallbacks: Record<
  string,
  { partOfSpeech: string; definitions: string[]; examples: string[] }
> = {
  is: {
    partOfSpeech: "verb",
    definitions: [
      "present tense of 'be', used to describe states or identities",
    ],
    examples: ["She is happy."],
  },
  are: {
    partOfSpeech: "verb",
    definitions: ["plural present tense of 'be'"],
    examples: ["They are students."],
  },
  your: {
    partOfSpeech: "determiner",
    definitions: ["belonging to you"],
    examples: ["Is this your book?"],
  },
  the: {
    partOfSpeech: "article",
    definitions: ["used to refer to a specific thing or person"],
    examples: ["The sun is bright."],
  },
  a: {
    partOfSpeech: "article",
    definitions: ["used before a noun to refer to a single nonspecific thing"],
    examples: [],
  },
  an: {
    partOfSpeech: "article",
    definitions: ["used before a vowel sound to refer to a single nonspecific thing"],
    examples: [],
  },
  to: {
    partOfSpeech: "preposition",
    definitions: ["used to indicate direction, destination, or purpose"],
    examples: [],
  },
  of: {
    partOfSpeech: "preposition",
    definitions: ["used to indicate origin, possession, or relation"],
    examples: [],
  },
  for: {
    partOfSpeech: "preposition",
    definitions: ["used to indicate purpose, destination, or duration"],
    examples: [],
  },
  in: {
    partOfSpeech: "preposition",
    definitions: ["used to indicate location, time, or manner"],
    examples: [],
  },
  on: {
    partOfSpeech: "preposition",
    definitions: ["used to indicate position, surface, or time"],
    examples: [],
  },
  at: {
    partOfSpeech: "preposition",
    definitions: ["used to indicate location, time, or rate"],
    examples: [],
  },
  by: {
    partOfSpeech: "preposition",
    definitions: ["used to indicate agent, means, or proximity"],
    examples: [],
  },
  with: {
    partOfSpeech: "preposition",
    definitions: ["used to indicate accompaniment, means, or manner"],
    examples: [],
  },
  from: {
    partOfSpeech: "preposition",
    definitions: ["used to indicate origin, source, or separation"],
    examples: [],
  },
  about: {
    partOfSpeech: "preposition",
    definitions: ["used to indicate subject, approximate amount, or position"],
    examples: [],
  },
  as: {
    partOfSpeech: "preposition",
    definitions: ["used to indicate role, comparison, or time"],
    examples: [],
  },
  into: {
    partOfSpeech: "preposition",
    definitions: ["used to indicate movement or transformation toward the inside"],
    examples: [],
  },
  like: {
    partOfSpeech: "preposition",
    definitions: ["used to indicate similarity or manner"],
    examples: [],
  },
  through: {
    partOfSpeech: "preposition",
    definitions: ["used to indicate movement from one side to the other or completion"],
    examples: [],
  },
  after: {
    partOfSpeech: "preposition",
    definitions: ["used to indicate time or order following something"],
    examples: [],
  },
  over: {
    partOfSpeech: "preposition",
    definitions: ["used to indicate position above, across, or more than"],
    examples: [],
  },
  between: {
    partOfSpeech: "preposition",
    definitions: ["used to indicate position or relation of two or more things"],
    examples: [],
  },
  out: {
    partOfSpeech: "adverb",
    definitions: ["used to indicate movement away from inside or completion"],
    examples: [],
  },
  against: {
    partOfSpeech: "preposition",
    definitions: ["used to indicate opposition or contact"],
    examples: [],
  },
  during: {
    partOfSpeech: "preposition",
    definitions: ["used to indicate a period of time when something happens"],
    examples: [],
  },
  without: {
    partOfSpeech: "preposition",
    definitions: ["used to indicate absence or lack of something"],
    examples: [],
  },
  before: {
    partOfSpeech: "preposition",
    definitions: ["used to indicate time or order preceding something"],
    examples: [],
  },
  under: {
    partOfSpeech: "preposition",
    definitions: ["used to indicate position below or less than"],
    examples: [],
  },
  around: {
    partOfSpeech: "preposition",
    definitions: ["used to indicate position on all sides or approximate amount"],
    examples: [],
  },
  among: {
    partOfSpeech: "preposition",
    definitions: ["used to indicate position within a group"],
    examples: [],
  },
};

export function VideoSlide({
  lesson,
  scrollContainerRef,
  scrollContainerReady = false,
  initialSeekTime,
  userId,
}: VideoSlideProps) {
  const [videoError, setVideoError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [practiceQuestions, setPracticeQuestions] = useState<
    PracticeQuestion[] | null
  >(null);
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [practiceError, setPracticeError] = useState<string | null>(null);
  const [pronunciationOpen, setPronunciationOpen] = useState(false);
  const [practiceSentence, setPracticeSentence] = useState<string | null>(null);
  const [vocabularyOpen, setVocabularyOpen] = useState(false);
  const [vocabularyLoading, setVocabularyLoading] = useState(false);
  const [vocabularyError, setVocabularyError] = useState<string | null>(null);
  const [vocabularyData, setVocabularyData] = useState<VocabularyCardItem[]>([]);
  const [tutorOpen, setTutorOpen] = useState(false);
  const [tutorContext, setTutorContext] = useState<TutorRoleplayContext | null>(
    null
  );
  const [cameraExerciseOpen, setCameraExerciseOpen] = useState(false);
  const [rawSubtitleSegments, setRawSubtitleSegments] = useState<
    SubtitleSegment[]
  >([]);
  const [selectedWord, setSelectedWord] = useState<VocabularyItem | null>(null);
  const [selectedSubtitleWord, setSelectedSubtitleWord] = useState<string | null>(null);
  const [contextResult, setContextResult] = useState<ContextDefinitionData | null>(null);
  const [isLoadingDefinition, setIsLoadingDefinition] = useState(false);
  const [justSavedWord, setJustSavedWord] = useState<string | null>(null);
  const [selectedSubtitleSentence, setSelectedSubtitleSentence] = useState<
    string | null
  >(null);
  const [thaiResult, setThaiResult] = useState<{
    wordThai: string;
    definitionThai: string;
    synonymsThai: string;
    exampleThai: string;
  } | null>(null);
  const [thaiLoading, setThaiLoading] = useState(false);
  const [showThaiTranslation, setShowThaiTranslation] = useState(false);
  const [metaPanelOpen, setMetaPanelOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressDuration, setProgressDuration] = useState(0);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const {
    startListening,
    recognizedText,
    pronunciationFeedback,
    isListening,
    reset: resetPronunciation,
  } = usePronunciationCheck();
  const thaiSentenceCacheRef = useRef<Map<string, string>>(new Map());
  const thaiWordCacheRef = useRef<Map<string, string>>(new Map());
  const contextSentenceCacheRef = useRef<
    Map<string, Map<string, ContextDefinitionData>>
  >(new Map());
  const contextSentencePrefetchingRef = useRef<Set<string>>(new Set());
  const [playbackSubtitleSegments, setPlaybackSubtitleSegments] = useState<
    PlaybackSubtitleSegment[]
  >([]);
  const [currentWords, setCurrentWords] = useState<WordTiming[]>([]);
  const [activeWordIndex, setActiveWordIndex] = useState<number>(-1);
  const subtitleSyncRef = useRef({ segmentIndex: -1, wordIndex: -1 });
  const videoRef = useRef<HTMLVideoElement>(null);
  const slideRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const cameraVocab = useCameraVocabExercise({
    lessonId: lesson.id,
    userId,
    isActive: cameraExerciseOpen,
  });

  const openTutorModal = useCallback(() => {
    videoRef.current?.pause();
    const snippet =
      lesson.subtitlesUrl && rawSubtitleSegments.length > 0
        ? subtitleSnippetAroundTime(rawSubtitleSegments, progressCurrent)
        : "";
    setTutorContext({
      lessonTitle: lesson.title?.trim() ?? "",
      lessonDescription: lesson.description?.trim() ?? "",
      topic: lesson.topic,
      tags: lesson.tags,
      subtitleSnippet: snippet || undefined,
    });
    setTutorOpen(true);
  }, [
    lesson.description,
    lesson.subtitlesUrl,
    lesson.tags,
    lesson.title,
    lesson.topic,
    progressCurrent,
    rawSubtitleSegments,
  ]);

  // Fetch per-lesson subtitles; clear immediately when lesson changes so previous subtitles never persist
  useEffect(() => {
    let cancelled = false;

    setPlaybackSubtitleSegments([]);
    setRawSubtitleSegments([]);

    if (!lesson.subtitlesUrl) return;

    fetch(lesson.subtitlesUrl)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SubtitlesData | null) => {
        if (!cancelled && data?.segments && Array.isArray(data.segments)) {
          setPlaybackSubtitleSegments(buildPlaybackSubtitleSegments(data.segments));
          setRawSubtitleSegments(data.segments);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPlaybackSubtitleSegments([]);
          setRawSubtitleSegments([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [lesson.subtitlesUrl]);

  // Sync subtitles every frame while playing; also on timeupdate as a backup.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || playbackSubtitleSegments.length === 0 || !isVisible) {
      if (!isVisible) {
        subtitleSyncRef.current = { segmentIndex: -1, wordIndex: -1 };
        setCurrentWords([]);
        setActiveWordIndex(-1);
      }
      return;
    }

    let rafId = 0;

    const applySubtitle = (segmentIndex: number, wordIndex: number) => {
      const prev = subtitleSyncRef.current;
      if (prev.segmentIndex === segmentIndex && prev.wordIndex === wordIndex) {
        return;
      }
      subtitleSyncRef.current = { segmentIndex, wordIndex };
      if (segmentIndex >= 0) {
        setCurrentWords(playbackSubtitleSegments[segmentIndex]!.words);
        setActiveWordIndex(wordIndex);
      } else {
        setCurrentWords([]);
        setActiveWordIndex(-1);
      }
    };

    const syncSubtitles = () => {
      const { segmentIndex, wordIndex } = findActiveSubtitle(
        playbackSubtitleSegments,
        video.currentTime
      );
      applySubtitle(segmentIndex, wordIndex);
    };

    const tick = () => {
      syncSubtitles();
      if (!video.paused && !video.ended) {
        rafId = requestAnimationFrame(tick);
      }
    };

    const startTicking = () => {
      cancelAnimationFrame(rafId);
      syncSubtitles();
      tick();
    };

    const stopTicking = () => {
      cancelAnimationFrame(rafId);
      rafId = 0;
    };

    const onEnded = () => {
      stopTicking();
      syncSubtitles();
    };

    video.addEventListener("seeked", syncSubtitles);
    video.addEventListener("timeupdate", syncSubtitles);
    video.addEventListener("play", startTicking);
    video.addEventListener("playing", startTicking);
    video.addEventListener("pause", stopTicking);
    video.addEventListener("ended", onEnded);
    syncSubtitles();
    if (!video.paused && !video.ended) {
      startTicking();
    }

    return () => {
      stopTicking();
      video.removeEventListener("seeked", syncSubtitles);
      video.removeEventListener("timeupdate", syncSubtitles);
      video.removeEventListener("play", startTicking);
      video.removeEventListener("playing", startTicking);
      video.removeEventListener("pause", stopTicking);
      video.removeEventListener("ended", onEnded);
    };
  }, [playbackSubtitleSegments, isVisible]);

  // IntersectionObserver (root = scroll container): play when visible, pause and reset when not
  useEffect(() => {
    if (!scrollContainerReady) return;
    const slide = slideRef.current;
    const root = scrollContainerRef?.current ?? null;
    if (!slide || !root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        const visible = entry.isIntersecting;
        setIsVisible(visible);

        const video = videoRef.current;
        if (!video || videoError) return;
        if (visible) {
          trackEvent("video_view_start", lesson.id, {}, userId ?? null);
          video.play().catch(() => {});
        } else {
          const watchTime = video.currentTime;
          trackEvent("video_view_end", lesson.id, { watchTime }, userId ?? null);
          video.pause();
          video.currentTime = 0;
        }
      },
      { threshold: 0.5, root, rootMargin: "0px" }
    );

    observer.observe(slide);
    return () => observer.disconnect();
  }, [lesson.id, videoError, scrollContainerRef, scrollContainerReady]);

  // Sync like state from localStorage (client-only)
  useEffect(() => {
    setIsLiked(isLikedStored(lesson.id));
  }, [lesson.id]);

  // Seek to initial time when opening from a clip link
  useEffect(() => {
    if (initialSeekTime == null || initialSeekTime < 0) return;
    const video = videoRef.current;
    if (!video) return;
    const seek = () => {
      video.currentTime = initialSeekTime;
    };
    if (video.readyState >= 1) {
      seek();
    } else {
      video.addEventListener("loadedmetadata", seek, { once: true });
      return () => video.removeEventListener("loadedmetadata", seek);
    }
  }, [initialSeekTime]);

  // Sync play state and progress from video for custom controls
  useEffect(() => {
    const video = videoRef.current;
    if (!video || videoError) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => setProgressCurrent(video.currentTime);
    const onDurationChange = () => setProgressDuration(video.duration);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("durationchange", onDurationChange);
    setProgressDuration(video.duration);
    setProgressCurrent(video.currentTime);
    setIsPlaying(!video.paused);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("durationchange", onDurationChange);
    };
  }, [lesson.id, videoError]);

  useEffect(() => {
    setMetaPanelOpen(false);
    // Ensure modals never carry over between lessons.
    setPronunciationOpen(false);
    setPracticeSentence(null);
    setTutorOpen(false);
    setTutorContext(null);
    setCameraExerciseOpen(false);
  }, [lesson.id]);

  // If the slide is no longer visible (user swiped), forcibly close overlays.
  useEffect(() => {
    if (isVisible) return;
    if (pronunciationOpen) {
      setPronunciationOpen(false);
      setPracticeSentence(null);
    }
    if (tutorOpen) {
      setTutorOpen(false);
      setTutorContext(null);
    }
    if (cameraExerciseOpen) {
      setCameraExerciseOpen(false);
    }
  }, [isVisible, pronunciationOpen, tutorOpen, cameraExerciseOpen]);

  // Fetch or load cached Thai translation once per subtitle sentence.
  useEffect(() => {
    if (!selectedSubtitleSentence) return;
    const sentence = selectedSubtitleSentence.trim();
    if (!sentence) return;

    const cachedSentenceThai = thaiSentenceCacheRef.current.get(sentence);
    if (cachedSentenceThai !== undefined) {
      setThaiResult({
        wordThai: cachedSentenceThai,
        definitionThai: cachedSentenceThai,
        synonymsThai: "",
        exampleThai: cachedSentenceThai,
      });
      return;
    }

    setThaiLoading(true);
    fetch("/api/translate-sentence-thai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sentence }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Fail"))))
      .then((data: { thai?: string }) => {
        const thai = typeof data.thai === "string" ? data.thai : "";
        thaiSentenceCacheRef.current.set(sentence, thai);
        setThaiResult({
          wordThai: thai,
          definitionThai: thai,
          synonymsThai: "",
          exampleThai: thai,
        });
      })
      .catch(() => setThaiResult(null))
      .finally(() => setThaiLoading(false));
  }, [selectedSubtitleSentence]);

  // Keep sentence-level translation flow, but override only wordThai
  // using a separate per-word cache and one-time word API calls.
  useEffect(() => {
    if (!selectedSubtitleWord) return;
    const lookupWord = cleanWordForLookup(selectedSubtitleWord);
    if (!lookupWord) return;

    const cachedWordThai = thaiWordCacheRef.current.get(lookupWord);
    if (cachedWordThai !== undefined) {
      setThaiResult((prev) =>
        prev
          ? { ...prev, wordThai: cachedWordThai }
          : {
              wordThai: cachedWordThai,
              definitionThai: "",
              synonymsThai: "",
              exampleThai: "",
            }
      );
      return;
    }

    fetch("/api/translate-thai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        word: lookupWord,
        definition: "",
        synonyms: "",
        example: "",
      }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Fail"))))
      .then((data: { wordThai?: string }) => {
        const wordThai = typeof data.wordThai === "string" ? data.wordThai : "";
        if (!wordThai) return;
        thaiWordCacheRef.current.set(lookupWord, wordThai);
        setThaiResult((prev) =>
          prev
            ? { ...prev, wordThai }
            : {
                wordThai,
                definitionThai: "",
                synonymsThai: "",
                exampleThai: "",
              }
        );
      })
      .catch(() => {
        // Keep sentence translation as fallback for wordThai if word API fails.
      });
  }, [selectedSubtitleWord]);

  const callContextApi = useCallback(
    (
      word: string,
      sentence: string,
      definitions: string[]
    ): Promise<ContextDefinitionData> => {
      return fetch("/api/context-definition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word, sentence, definitions }),
      }).then((res) => {
        if (!res.ok) throw new Error("Context API failed");
        return res.json();
      });
    },
    []
  );

  const prefetchSentenceContexts = useCallback(
    async (sentence: string) => {
      const normalizedSentence = sentence.trim();
      if (!normalizedSentence) return;
      if (contextSentenceCacheRef.current.has(normalizedSentence)) return;
      if (contextSentencePrefetchingRef.current.has(normalizedSentence)) return;

      contextSentencePrefetchingRef.current.add(normalizedSentence);
      try {
        const words = Array.from(
          new Set(
            normalizedSentence
              .split(/\s+/)
              .map((w) => cleanWordForLookup(w))
              .filter(Boolean)
          )
        );
        const filteredWords = words
          .filter((w) => w.length > 3 && !CONTEXT_STOPWORDS.has(w))
          .slice(0, 5);
        if (filteredWords.length === 0) {
          contextSentenceCacheRef.current.set(normalizedSentence, new Map());
          return;
        }

        const pairs = await Promise.all(
          filteredWords.map(async (lookupWord) => {
            const apiLookupWord = contractions[lookupWord] ?? lookupWord;
            const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(apiLookupWord)}`;

            let definitions: string[] = [];
            try {
              const res = await fetch(url);
              if (!res.ok) throw new Error("Not found");
              const data = (await res.json()) as Array<{
                meanings?: Array<{
                  definitions?: Array<{ definition?: string }>;
                }>;
              }>;
              const first = data?.[0];
              const rawMeanings = first?.meanings ?? [];
              const meanings = rawMeanings.slice(0, 3).map((m) => {
                const defs = (m.definitions ?? [])
                  .slice(0, 2)
                  .map((d) => d.definition ?? "")
                  .filter(Boolean);
                return defs.length ? defs : ["No definition available."];
              });
              const fallback = meanings.length
                ? null
                : commonWordFallbacks[lookupWord];
              definitions = meanings.length
                ? meanings.flat()
                : fallback
                  ? fallback.definitions
                  : DEFAULT_MEANING.definitions;
            } catch {
              const fallback = commonWordFallbacks[lookupWord];
              definitions = fallback
                ? fallback.definitions
                : DEFAULT_MEANING.definitions;
            }

            try {
              const result = await callContextApi(lookupWord, normalizedSentence, definitions);
              return [lookupWord, result] as const;
            } catch {
              return [
                lookupWord,
                {
                  contextDefinition: definitions[0] ?? DEFAULT_MEANING.definitions[0],
                  synonyms: [],
                  examples: normalizedSentence ? [normalizedSentence] : [],
                } as ContextDefinitionData,
              ] as const;
            }
          })
        );

        const sentenceMap = new Map<string, ContextDefinitionData>();
        for (const [word, data] of pairs) {
          sentenceMap.set(word, data);
        }
        contextSentenceCacheRef.current.set(normalizedSentence, sentenceMap);
      } finally {
        contextSentencePrefetchingRef.current.delete(normalizedSentence);
      }
    },
    [callContextApi]
  );

  // Prefetch all word contexts in the currently visible subtitle sentence.
  useEffect(() => {
    const sentence = currentWords.map((x) => x.word).join(" ").trim();
    if (!sentence) return;
    void prefetchSentenceContexts(sentence);
  }, [currentWords, prefetchSentenceContexts]);

  // When Practice modal opens, fetch stored questions or generate and store them
  useEffect(() => {
    if (!practiceOpen || !lesson.id || !lesson.subtitlesUrl) return;
    setPracticeLoading(true);
    setPracticeError(null);
    setPracticeQuestions(null);

    const run = async () => {
      try {
        const getRes = await fetch(
          `/api/lesson-practice?lessonId=${encodeURIComponent(lesson.id)}`
        );
        if (getRes.ok) {
          const data = (await getRes.json()) as { questions?: PracticeQuestion[] };
          const list = Array.isArray(data.questions) ? data.questions : [];
          if (list.length > 0) {
            setPracticeQuestions(list);
            setPracticeLoading(false);
            return;
          }
        }
        const postRes = await fetch("/api/generate-practice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lessonId: lesson.id }),
        });
        if (!postRes.ok) {
          const err = (await postRes.json()).error ?? "Failed to generate practice";
          setPracticeError(err);
          setPracticeLoading(false);
          return;
        }
        const data = (await postRes.json()) as { questions?: PracticeQuestion[] };
        const list = Array.isArray(data.questions) ? data.questions : [];
        setPracticeQuestions(list.length > 0 ? list : null);
        if (list.length === 0) setPracticeError("No questions generated.");
      } catch (e) {
        setPracticeError("Something went wrong. Try again.");
      } finally {
        setPracticeLoading(false);
      }
    };
    run();
  }, [practiceOpen, lesson.id, lesson.subtitlesUrl]);

  const handleVideoClick = () => {
    const video = videoRef.current;
    if (!video || videoError) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  };

  const handleSoundClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video || videoError) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const handlePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video || videoError) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const video = videoRef.current;
    const bar = progressBarRef.current;
    if (!video || videoError || !bar || !Number.isFinite(progressDuration) || progressDuration <= 0) return;
    const rect = bar.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    video.currentTime = ratio * progressDuration;
  };

  const handleWordClick = useCallback(
    (word: string, sentence: string) => {
      videoRef.current?.pause();
      setShowThaiTranslation(false);
      setSelectedSubtitleWord(word);
      setSelectedSubtitleSentence(sentence);
      setIsLoadingDefinition(false);

      const lookupWord = cleanWordForLookup(word);
      if (!lookupWord) {
        setContextResult({
          contextDefinition: DEFAULT_MEANING.definitions[0],
          synonyms: [],
          examples: [],
        });
        setIsLoadingDefinition(false);
        return;
      }

      const sentenceMap = contextSentenceCacheRef.current.get(sentence);
      const cached = sentenceMap?.get(lookupWord);
      if (cached) {
        setContextResult(cached);
        return;
      }

      setContextResult({
        contextDefinition:
          commonWordFallbacks[lookupWord]?.definitions[0] ??
          DEFAULT_MEANING.definitions[0],
        synonyms: [],
        examples: sentence ? [sentence] : [],
      });
    },
    []
  );

  return (
    <div
      ref={slideRef}
      className="relative h-full min-h-0 w-full min-w-0 flex-shrink-0 overflow-hidden bg-zinc-900"
      suppressHydrationWarning
    >
      {videoError ? (
        <div className="flex flex-col items-center gap-3 text-center text-zinc-400">
          <div className="rounded-full bg-zinc-700 p-4">
            <svg
              className="h-10 w-10"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </div>
          <p>Video unavailable</p>
          <p className="text-sm">Check the video URL or network.</p>
        </div>
      ) : (
        <>
          <div
            className="absolute inset-0 min-h-0 min-w-0 overflow-hidden"
            onClick={handleVideoClick}
            role="presentation"
          >
            <div className="flex h-full min-h-0 w-full min-w-0 flex-row">
              <div
                className="hidden min-h-0 min-w-0 flex-1 bg-gradient-to-b from-blue-500 to-blue-600 md:block"
                aria-hidden
              />
              <div className="relative flex h-full shrink-0 items-center justify-start md:justify-center">
                <video
                  key={lesson.id}
                  ref={videoRef}
                  src={lesson.videoUrl}
                  className="block h-full w-auto max-w-full object-contain"
                  playsInline
                  muted
                  loop
                  preload="metadata"
                  onError={() => setVideoError(true)}
                  onEnded={() => {
                    trackEvent("video_complete", lesson.id, {}, userId ?? null);
                    trackEvent("replay", lesson.id, {}, userId ?? null);
                  }}
                />
              </div>
              <div className="min-h-0 min-w-0 flex-1 bg-red-500" aria-hidden />
            </div>
            {cameraExerciseOpen && cameraVocab.showFeedLayer && (
              <CameraVocabFeedOverlay
                selfieVideoRef={cameraVocab.selfieVideoRef}
                flashcardWordRef={cameraVocab.flashcardWordRef}
                imageUrl={cameraVocab.imageUrl}
                imageLoading={cameraVocab.imageLoading}
                imageError={cameraVocab.imageError}
                imagePaintReady={cameraVocab.imagePaintReady}
                setImagePaintReady={cameraVocab.setImagePaintReady}
                onImageDecodeError={cameraVocab.onFlashcardImageDecodeError}
                overlayStyle={cameraVocab.overlayStyle}
                faceReady={cameraVocab.faceReady}
                camError={cameraVocab.camError}
                finished={cameraVocab.finished}
                round={cameraVocab.round}
              />
            )}
          </div>
        </>
      )}

      {/* Bottom dock: info + play/timeline */}
      {isVisible && !videoError && (
        <div
          className="pointer-events-auto fixed inset-x-0 z-40 flex flex-col"
          style={{ bottom: "var(--video-dock-bottom)" }}
          onClick={(e) => e.stopPropagation()}
          suppressHydrationWarning
        >
          {currentWords.length > 0 && (
            <div className="pointer-events-none px-3 pr-[4.75rem] pb-1 md:px-4 md:pr-4">
              <div className="pointer-events-auto mx-auto flex h-8 w-full max-w-full items-center rounded-none border-2 border-black bg-white px-2 shadow-[3px_3px_0px_black] md:h-[2.85rem] md:max-w-[24rem] md:px-3">
                <p className="line-clamp-2 w-full overflow-hidden break-words text-center text-xs font-semibold leading-4 text-black md:text-base md:leading-[1.35rem] lg:text-lg">
                  {currentWords.map((w, i) => (
                    <span
                      key={`${i}-${w.start}`}
                      role="button"
                      tabIndex={0}
                      className={`cursor-pointer rounded-sm px-0.5 transition-colors duration-75 hover:underline ${
                        i === activeWordIndex ? "text-blue-600" : "text-black"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        const sentence = currentWords.map((x) => x.word).join(" ");
                        handleWordClick(w.word, sentence);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          const sentence = currentWords.map((x) => x.word).join(" ");
                          handleWordClick(w.word, sentence);
                        }
                      }}
                    >
                      {w.word}
                      {i < currentWords.length - 1 ? " " : ""}
                    </span>
                  ))}
                </p>
              </div>
            </div>
          )}
          <div className="relative flex min-h-[var(--video-timeline-height)] items-center gap-3 px-3 py-2">
            {metaPanelOpen && (
              <div
                className="pointer-events-auto absolute bottom-full left-2 z-10 mb-1 flex flex-col"
                suppressHydrationWarning
              >
                <div className="w-[280px] max-w-[280px] rounded-md border-2 border-black bg-gradient-to-b from-blue-500 to-blue-600 p-3 shadow-[3px_3px_0px_black]">
                  <h2 className="text-lg font-bold text-white">
                    <span className="block">{String(lesson.title ?? "")}</span>
                  </h2>
                  <p className="mt-1 line-clamp-2 text-sm text-white">
                    {lesson.description ?? ""}
                  </p>
                </div>
                {lesson.tags && lesson.tags.length > 0 ? (
                  <div className="mt-2 inline-flex flex-wrap gap-2">
                    {lesson.tags.map((tag) => (
                      <Link
                        key={tag}
                        href={`/tag/${encodeURIComponent(tag)}`}
                        className="inline-flex items-center rounded-md border-2 border-black bg-white px-2 py-1 text-xs font-bold text-black shadow-[3px_3px_0px_black] transition-colors hover:bg-gray-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        #{tag}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
            <button
              type="button"
              onClick={() => setMetaPanelOpen((open) => !open)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-none border-2 border-black bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-[3px_3px_0px_black] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none active:scale-95"
              aria-label={metaPanelOpen ? "Hide lesson info" : "Show lesson info"}
              aria-expanded={metaPanelOpen}
            >
              <Info className="h-6 w-6 stroke-[2.25]" aria-hidden />
            </button>
          <button
            type="button"
            onClick={handlePlayPause}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-none border-2 border-black bg-white text-blue-600 shadow-[3px_3px_0px_black] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none active:scale-95"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6 fill-current"
                aria-hidden
              >
                <rect x="6" y="5" width="4.5" height="14" rx="0.5" />
                <rect x="13.5" y="5" width="4.5" height="14" rx="0.5" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden>
                <path d="M8 5.5v13l10-6.5z" />
              </svg>
            )}
          </button>
          <div
            ref={progressBarRef}
            role="progressbar"
            aria-valuenow={Number.isFinite(progressCurrent) ? Math.round(progressCurrent) : 0}
            aria-valuemin={0}
            aria-valuemax={Number.isFinite(progressDuration) ? Math.round(progressDuration) : 0}
            aria-label="Video progress"
            tabIndex={0}
            className="flex min-h-10 min-w-0 flex-1 cursor-pointer items-center py-1"
            onClick={handleProgressClick}
            onKeyDown={(e) => {
              if (e.key !== "Enter" && e.key !== " ") return;
              e.preventDefault();
              const video = videoRef.current;
              if (!video) return;
              const step = 5;
              if (e.key === "Enter") video.currentTime = Math.min(progressDuration, progressCurrent + step);
              else video.currentTime = Math.max(0, progressCurrent - step);
            }}
          >
            <div className="relative h-4 w-full border-2 border-black bg-white shadow-[2px_2px_0px_black]">
              <div
                className="absolute inset-y-0 left-0 max-w-full border-r-2 border-black bg-blue-500 transition-[width] duration-100"
                style={{
                  width: progressDuration > 0 ? `${(100 * progressCurrent) / progressDuration}%` : "0%",
                }}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleSoundClick}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-none border-2 border-black bg-white text-black shadow-[3px_3px_0px_black] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none active:scale-95"
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <VolumeX className="h-6 w-6 stroke-[2.25]" aria-hidden />
            ) : (
              <Volume2 className="h-6 w-6 stroke-[2.25]" aria-hidden />
            )}
          </button>
          </div>

        </div>
      )}

      {/* Small popup overlay for selected subtitle word */}
      {selectedSubtitleWord && (
        <div
          className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-4"
          onClick={() => {
            videoRef.current?.play();
            setShowThaiTranslation(false);
            setSelectedSubtitleWord(null);
            setJustSavedWord(null);
            setSelectedSubtitleSentence(null);
            setThaiResult(null);
            setThaiLoading(false);
            resetPronunciation();
          }}
          role="button"
          tabIndex={0}
          aria-label="Close word popup"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              videoRef.current?.play();
              setShowThaiTranslation(false);
              setSelectedSubtitleWord(null);
              setJustSavedWord(null);
              setSelectedSubtitleSentence(null);
              setThaiResult(null);
              setThaiLoading(false);
              resetPronunciation();
            }
          }}
          suppressHydrationWarning
        >
          <div
            className="max-h-[min(70dvh,420px)] w-full max-w-sm overflow-y-auto rounded-none border-2 border-black bg-white px-3 py-3 shadow-[3px_3px_0px_black] sm:px-4"
            onClick={(e) => e.stopPropagation()}
            suppressHydrationWarning
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <p className="min-w-0 truncate text-lg font-bold capitalize text-black">
                  {selectedSubtitleWord}
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    speakWord(selectedSubtitleWord ?? "");
                  }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-none border-2 border-black bg-white text-black shadow-[2px_2px_0px_black] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
                  aria-label="Pronounce word"
                >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-5 w-5"
                  aria-hidden
                >
                  <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06Zm5.084 1.046a.75.75 0 0 1 1.06 0 8.25 8.25 0 0 1 0 11.668.75.75 0 0 1-1.06-1.06 6.75 6.75 0 0 0 0-9.548.75.75 0 0 1 0-1.06Zm-3.182 3.182a.75.75 0 0 1 1.06 0 4.5 4.5 0 0 1 0 6.364.75.75 0 0 1-1.06-1.06 3 3 0 0 0 0-4.244.75.75 0 0 1 0-1.06Z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  startListening(selectedSubtitleWord ?? "");
                }}
                disabled={isListening}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-none border-2 border-black bg-white text-black shadow-[2px_2px_0px_black] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none disabled:opacity-50"
                aria-label="Repeat word for pronunciation check"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-5 w-5"
                  aria-hidden
                >
                  <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
                  <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowThaiTranslation((prev) => !prev);
                }}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-none border-2 border-black bg-white text-base text-black shadow-[2px_2px_0px_black] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none ${
                  showThaiTranslation ? "opacity-100" : "opacity-70"
                }`}
                aria-label={showThaiTranslation ? "Hide Thai translation" : "Show Thai translation"}
              >
                🇹🇭
              </button>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Link
                  href="/profile/vocabulary"
                  className="flex h-8 w-8 items-center justify-center rounded-none border-2 border-black bg-white text-sm font-bold shadow-[2px_2px_0px_black]"
                  onClick={(e) => e.stopPropagation()}
                  aria-label="My vocabulary"
                  title="My vocabulary"
                >
                  📘
                </Link>
                <Link
                  href="/profile/clips"
                  className="flex h-8 w-8 items-center justify-center rounded-none border-2 border-black bg-white text-sm font-bold shadow-[2px_2px_0px_black]"
                  onClick={(e) => e.stopPropagation()}
                  aria-label="My clips"
                  title="My clips"
                >
                  ✂
                </Link>
              </div>
            </div>
            {(recognizedText || pronunciationFeedback) && (
              <div className="mt-1.5 space-y-0.5">
                {recognizedText && (
                  <p className="text-xs font-medium text-black">
                    Heard: &quot;{recognizedText}&quot;
                  </p>
                )}
                {pronunciationFeedback && (
                  <p
                    className={
                      pronunciationFeedback === "Good pronunciation"
                        ? "text-xs font-bold text-blue-700"
                        : "text-xs font-bold text-red-700"
                    }
                  >
                    {pronunciationFeedback}
                  </p>
                )}
              </div>
            )}
            {isListening && selectedSubtitleWord && (
              <p className="mt-1 text-xs font-medium text-black">
                🎤 Say the word: &quot;{selectedSubtitleWord}&quot;
              </p>
            )}
            {showThaiTranslation && (
              thaiResult?.wordThai ? (
                <p className="mt-0.5 text-xs font-medium text-black">
                  {thaiResult.wordThai}
                </p>
              ) : thaiLoading ? (
                <p className="mt-0.5 text-xs font-medium text-black">Translating…</p>
              ) : null
            )}
            {isLoadingDefinition ? (
              <p className="mt-2 text-sm font-bold text-black">Loading...</p>
            ) : contextResult ? (
              <div className="mt-2 space-y-3">
                <section>
                  <p className="text-xs font-bold uppercase tracking-wide text-black">
                    Definition
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-black">
                    {contextResult.contextDefinition}
                  </p>
                  {showThaiTranslation && (
                    thaiResult?.definitionThai ? (
                      <p className="mt-0.5 text-xs font-medium text-black">
                        {thaiResult.definitionThai}
                      </p>
                    ) : thaiLoading ? (
                      <p className="mt-0.5 text-xs font-medium text-black">
                        Translating…
                      </p>
                    ) : null
                  )}
                </section>
                {contextResult.synonyms.length > 0 && (
                  <section>
                    <p className="text-xs font-bold uppercase tracking-wide text-black">
                      Synonyms
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-black">
                      {contextResult.synonyms.join(", ")}
                    </p>
                    {showThaiTranslation && (
                      thaiResult?.synonymsThai ? (
                        <p className="mt-0.5 text-xs font-medium text-black">
                          {thaiResult.synonymsThai}
                        </p>
                      ) : thaiLoading ? (
                        <p className="mt-0.5 text-xs font-medium text-black">
                          Translating…
                        </p>
                      ) : null
                    )}
                  </section>
                )}
                {contextResult.examples.length > 0 && (
                  <section>
                    <p className="text-xs font-bold uppercase tracking-wide text-black">
                      Example
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-black">
                      {contextResult.examples[0]}
                    </p>
                    {showThaiTranslation && (
                      thaiResult?.exampleThai ? (
                        <p className="mt-0.5 text-xs font-medium text-black">
                          {thaiResult.exampleThai}
                        </p>
                      ) : thaiLoading ? (
                        <p className="mt-0.5 text-xs font-medium text-black">
                          Translating…
                        </p>
                      ) : null
                    )}
                  </section>
                )}
                {(() => {
                  const saved =
                    justSavedWord === selectedSubtitleWord ||
                    getSavedVocab().some(
                      (e) =>
                        e.word.toLowerCase() ===
                        selectedSubtitleWord.toLowerCase()
                    );
                  return (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={saved}
                        onClick={(e) => {
                          e.stopPropagation();
                          const added = saveVocabItem({
                            word: selectedSubtitleWord,
                            meaning: contextResult.contextDefinition,
                            example:
                              contextResult.examples[0] ?? "",
                          });
                          if (added) setJustSavedWord(selectedSubtitleWord);
                        }}
                        className="rounded-none border-2 border-black bg-white px-3 py-1.5 text-sm font-bold text-black shadow-[2px_2px_0px_black] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none disabled:opacity-60"
                      >
                        {saved ? "Saved" : "Save Word"}
                      </button>
                      {selectedSubtitleSentence ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const timestamp =
                              videoRef.current?.currentTime ?? 0;
                            saveClip({
                              sentence: selectedSubtitleSentence,
                              videoId: lesson.id,
                              timestamp,
                            });
                          }}
                          className="rounded-none border-2 border-black bg-white px-3 py-1.5 text-sm font-bold text-black shadow-[2px_2px_0px_black] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
                        >
                          Clip Sentence
                        </button>
                      ) : null}
                    </div>
                  );
                })()}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Vocabulary modal */}
      {selectedWord && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setSelectedWord(null)}
          role="button"
          tabIndex={0}
          aria-label="Close vocabulary"
          onKeyDown={(e) => {
            if (e.key === "Escape") setSelectedWord(null);
          }}
          suppressHydrationWarning
        >
          <div
            ref={popupRef}
            className="max-w-sm rounded-none border-2 border-black bg-white p-6 shadow-[3px_3px_0px_black]"
            onClick={(e) => e.stopPropagation()}
            suppressHydrationWarning
          >
            <p className="text-xl font-bold text-black">
              {selectedWord.word}
            </p>
            <p className="mt-2 text-sm font-bold text-black">
              {selectedWord.meaning}
            </p>
            {selectedWord.example && (
              <p className="mt-3 text-sm italic font-bold text-black">
                &ldquo;{selectedWord.example}&rdquo;
              </p>
            )}
          </div>
        </div>
      )}


      {/* Floating vertical action rail */}
      <div
        className="absolute right-3 top-4 z-10 flex flex-col items-center gap-3 md:top-1/2 md:-translate-y-1/2 md:justify-center"
        suppressHydrationWarning
      >
        <span className="sr-only">Video actions</span>
                {lesson.subtitlesUrl && (
                  <div className="group relative flex flex-col items-center">
                    <span className="pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 translate-x-1 whitespace-nowrap rounded border-2 border-black bg-white px-2 py-1 text-xs font-bold text-black shadow-[3px_3px_0px_black] opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100">
                      Quiz
                    </span>
                    <button
                      type="button"
                      onClick={() => setPracticeOpen(true)}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-black bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95"
                      aria-label="Quiz"
                    >
                      <ClipboardList className="h-[22px] w-[22px] stroke-[2.5]" aria-hidden />
                    </button>
                  </div>
                )}
                {lesson.subtitlesUrl && (
                  <div className="group relative flex flex-col items-center">
                    <span className="pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 translate-x-1 whitespace-nowrap rounded border-2 border-black bg-white px-2 py-1 text-xs font-bold text-black shadow-[3px_3px_0px_black] opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100">
                      Speak
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        // Open immediately so the UI feels responsive, even while loading.
                        videoRef.current?.pause();
                        setPronunciationOpen(true);
                        setPracticeSentence("");
        
                        const fallbackPool = Array.isArray(lesson.practiceSentences)
                          ? lesson.practiceSentences
                          : [];
                        const fallbackSentence =
                          fallbackPool.length > 0
                            ? fallbackPool[0] ?? ""
                            : (lesson.title?.trim() || "");
                        try {
                          const res = await fetch(
                            `/api/lesson-pronunciation?lessonId=${encodeURIComponent(lesson.id)}`
                          );
                          const data = (await res.json()) as {
                            sentence?: string;
                            error?: string;
                          };
                          const sentence =
                            typeof data.sentence === "string" ? data.sentence.trim() : "";
                          const chosen = res.ok && sentence ? sentence : fallbackSentence;
                          if (!chosen) return;
                          setPracticeSentence(chosen);
                          setPronunciationOpen(true);
                        } catch {
                          const chosen = fallbackSentence;
                          if (!chosen) return;
                          setPracticeSentence(chosen);
                          setPronunciationOpen(true);
                        }
                      }}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-black bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95"
                      aria-label="Practice pronunciation"
                    >
                      <Mic className="h-[22px] w-[22px] stroke-[2.5]" aria-hidden />
                    </button>
                  </div>
                )}
                {lesson.subtitlesUrl && (
                  <div className="group relative flex flex-col items-center">
                    <span className="pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 translate-x-1 whitespace-nowrap rounded border-2 border-black bg-white px-2 py-1 text-xs font-bold text-black shadow-[3px_3px_0px_black] opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100">
                      Vocabulary
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        videoRef.current?.pause();
                        setVocabularyOpen(true);
                        setVocabularyLoading(true);
                        setVocabularyError(null);
                        setVocabularyData([]);
                        fetch(
                          `/api/lesson-vocabulary?lessonId=${encodeURIComponent(lesson.id)}`
                        )
                          .then(async (res) => {
                            const data = (await res.json()) as {
                              vocabulary?: unknown;
                              error?: string;
                            };
                            if (!res.ok) {
                              throw new Error(data.error ?? "Failed to load vocabulary");
                            }
                            const list = Array.isArray(data.vocabulary)
                              ? data.vocabulary
                              : [];
                            setVocabularyData(list as VocabularyCardItem[]);
                          })
                          .catch((e) => {
                            setVocabularyError(
                              e instanceof Error ? e.message : "Failed to load vocabulary"
                            );
                          })
                          .finally(() => {
                            setVocabularyLoading(false);
                          });
                      }}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-black bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95"
                      aria-label="Vocabulary"
                    >
                      <BookOpen className="h-[22px] w-[22px] stroke-[2.5]" aria-hidden />
                    </button>
                  </div>
                )}
                <div className="group relative flex flex-col items-center">
                  <span className="pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 translate-x-1 whitespace-nowrap rounded border-2 border-black bg-white px-2 py-1 text-xs font-bold text-black shadow-[3px_3px_0px_black] opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100">
                    Camera vocab
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      videoRef.current?.pause();
                      setCameraExerciseOpen(true);
                    }}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-black bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95"
                    aria-label="Camera vocabulary exercise"
                  >
                    <Camera className="h-[22px] w-[22px] stroke-[2.5]" aria-hidden />
                  </button>
                </div>
                <div className="group relative flex flex-col items-center">
                  <span className="pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 translate-x-1 whitespace-nowrap rounded border-2 border-black bg-white px-2 py-1 text-xs font-bold text-black shadow-[3px_3px_0px_black] opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100">
                    AI Tutor
                  </span>
                  <button
                    type="button"
                    onClick={openTutorModal}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-black bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95"
                    aria-label="AI Tutor"
                  >
                    <Bot className="h-[22px] w-[22px] stroke-[2.5]" aria-hidden />
                  </button>
                </div>
                <div className="group relative flex flex-col items-center">
                  <span className="pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 translate-x-1 whitespace-nowrap rounded border-2 border-black bg-white px-2 py-1 text-xs font-bold text-black shadow-[3px_3px_0px_black] opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100">
                    Like
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      const next = !isLiked;
                      setIsLiked(next);
                      if (!userId) {
                        return;
                      }
                      try {
                        if (next) {
                          await fetch("/api/likes", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ userId, lessonId: lesson.id }),
                          });
                          addLikedLesson({
                            id: lesson.id,
                            title: lesson.title,
                            videoUrl: lesson.videoUrl,
                            thumbnailUrl: lesson.thumbnailUrl,
                          });
                          trackEvent("like", lesson.id, {}, userId ?? null);
                        } else {
                          await fetch(
                            `/api/likes?userId=${encodeURIComponent(
                              userId
                            )}&lessonId=${encodeURIComponent(lesson.id)}`,
                            { method: "DELETE" }
                          );
                          removeLikedLesson(lesson.id);
                        }
                      } catch {
                        // ignore network errors; UI state already updated optimistically
                      }
                    }}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-black bg-red-500 text-white shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95"
                    aria-label={isLiked ? "Unlike" : "Like"}
                  >
                    <Heart
                      className={`h-[22px] w-[22px] stroke-[2.5] ${isLiked ? "fill-white text-white" : ""}`}
                      aria-hidden
                    />
                  </button>
                </div>
                <div className="group relative flex flex-col items-center">
                  <span className="pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 translate-x-1 whitespace-nowrap rounded border-2 border-black bg-white px-2 py-1 text-xs font-bold text-black shadow-[3px_3px_0px_black] opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100">
                    Comment
                  </span>
                  <Link
                    href="/inbox"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-black bg-white text-black shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95"
                    aria-label="Comment"
                  >
                    <MessageCircle className="h-[22px] w-[22px] stroke-[2.5]" aria-hidden />
                  </Link>
                </div>
      </div>

      {practiceOpen && (
        <PracticeQuiz
          title="Quiz"
          questions={practiceQuestions}
          loading={practiceLoading}
          error={practiceError}
          onClose={() => {
            setPracticeOpen(false);
            setPracticeQuestions(null);
            setPracticeError(null);
          }}
        />
      )}
      {isVisible && pronunciationOpen && (
        <PronunciationPractice
          expectedSentence={practiceSentence ?? ""}
          onClose={() => {
            videoRef.current?.play();
            setPracticeSentence(null);
            setPronunciationOpen(false);
          }}
        />
      )}
      {vocabularyOpen && (
        <VocabularyCards
          vocabulary={vocabularyData}
          loading={vocabularyLoading}
          error={vocabularyError}
          onClose={() => {
            videoRef.current?.play();
            setVocabularyOpen(false);
            setVocabularyData([]);
            setVocabularyError(null);
          }}
        />
      )}
      {tutorOpen && tutorContext && (
        <TutorRoleplayModal
          context={tutorContext}
          onClose={() => {
            videoRef.current?.play();
            setTutorOpen(false);
            setTutorContext(null);
          }}
        />
      )}
      {cameraExerciseOpen && (
        <CameraVocabQuizModal
          api={cameraVocab}
          onClose={() => {
            videoRef.current?.play();
            setCameraExerciseOpen(false);
          }}
        />
      )}
    </div>
  );
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanWordForLookup(word: string): string {
  return word
    .toLowerCase()
    .replace(/^[^a-zA-Z']+|[^a-zA-Z']+$/g, "");
}
