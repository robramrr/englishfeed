"use client";

import { useCallback, useRef, useState } from "react";

type SpeechRecognitionAlternativeLite = { transcript?: string };
type SpeechRecognitionResultLite = {
  0?: SpeechRecognitionAlternativeLite;
};
type SpeechRecognitionEventLite = {
  results: SpeechRecognitionResultLite[];
};
type SpeechRecognitionLite = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechRecognitionEventLite) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function isEnglishAny(v: SpeechSynthesisVoice): boolean {
  const lang = (v.lang || "").toLowerCase();
  return lang.startsWith("en");
}

/** Novelty / chipmunk-style system voices to deprioritize. */
const NOVELTY_VOICE = /\b(zarvox|trinoids|fred|bad news|boing|bubbles|cellos|whisper|albert|junior|hysterical|deranged|superstar|organ|bahh|bells)\b/i;

/**
 * Score voices so we pick the most natural neural/enhanced option.
 * Browser TTS cannot use Siri or paid cloud voices — only what getVoices() exposes.
 */
function scoreVoiceQuality(v: SpeechSynthesisVoice): number {
  const n = v.name;
  let s = 0;

  if (NOVELTY_VOICE.test(n)) return -999;
  if (/\bcompact\b/i.test(n)) s -= 120;

  if (/samantha/i.test(n) && /enhanced/i.test(n)) s += 220;
  else if (/google us english/i.test(n)) s += 210;
  else if (/\bava\b/i.test(n) && /enhanced/i.test(n)) s += 205;
  else if (/\bava\b/i.test(n)) s += 195;
  else if (/microsoft (aria|jenny|guy|ana|andrew|steffi|christopher)\b/i.test(n))
    s += 188;
  else if (/alex\b/i.test(n) && /enhanced/i.test(n)) s += 185;
  else if (/premium/i.test(n)) s += 175;
  else if (/enhanced/i.test(n)) s += 168;
  else if (/\bneural\b/i.test(n) || /\bnatural\b/i.test(n)) s += 155;
  else if (/google uk english/i.test(n)) s += 145;
  else if (/google.*english/i.test(n) && /\bus\b/i.test(n)) s += 140;
  else if (/samantha/i.test(n)) s += 135;
  else if (/google.*english/i.test(n)) s += 125;

  if (v.localService) s += 30;
  const lang = (v.lang || "").toLowerCase();
  if (lang.startsWith("en-us")) s += 20;
  else if (lang === "en") s += 12;
  else if (lang.startsWith("en-gb") || lang.startsWith("en-au"))
    s += 4;

  return s;
}

function bestVoiceInPool(pool: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (pool.length === 0) return null;
  let best = pool[0]!;
  let bestScore = scoreVoiceQuality(best);
  for (let i = 1; i < pool.length; i++) {
    const v = pool[i]!;
    const sc = scoreVoiceQuality(v);
    if (sc > bestScore) {
      bestScore = sc;
      best = v;
    }
  }
  return bestScore > -500 ? best : null;
}

/** Best English voice; scoring already boosts en-US over en-GB. */
function pickPreferredEnglishVoice(
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  return bestVoiceInPool(voices.filter(isEnglishAny));
}

/** Stops any speech started via {@link speakWord} (or other queued utterances). */
export function cancelSpeech(): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
}

export function speakWord(word: string): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const trimmed = word.trim();
  if (!trimmed) return;

  const synth = window.speechSynthesis;

  const run = () => {
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(trimmed);
    utterance.lang = "en-US";
    // Slower than default — single words feel rushed at 1.0; ~0.78 reads more human.
    utterance.rate = 0.78;
    utterance.pitch = 1.0;
    utterance.volume = 1;
    const voice = pickPreferredEnglishVoice(synth.getVoices());
    if (voice) utterance.voice = voice;
    synth.speak(utterance);
  };

  const voices = synth.getVoices();
  if (voices.length > 0) {
    run();
    return;
  }

  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    synth.removeEventListener("voiceschanged", finish);
    clearTimeout(fallbackTimer);
    run();
  };
  const fallbackTimer = setTimeout(finish, 1200);
  synth.addEventListener("voiceschanged", finish);
  synth.getVoices();
}

export function normalizeWord(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,?!:;'"()\[\]{}]/g, "")
    .trim();
}

export function usePronunciationCheck(): {
  startListening: (word: string) => void;
  recognizedText: string;
  pronunciationFeedback: "Good pronunciation" | "Try again" | null;
  isListening: boolean;
  reset: () => void;
} {
  const [recognizedText, setRecognizedText] = useState<string>("");
  const [pronunciationFeedback, setPronunciationFeedback] = useState<
    "Good pronunciation" | "Try again" | null
  >(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLite | null>(null);
  const recognitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const recognitionTranscriptRef = useRef<string>("");

  const reset = useCallback(() => {
    setRecognizedText("");
    setPronunciationFeedback(null);
    setIsListening(false);
    if (recognitionTimeoutRef.current) {
      clearTimeout(recognitionTimeoutRef.current);
      recognitionTimeoutRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
  }, []);

  const startListening = useCallback((word: string) => {
    const trimmed = word.trim();
    if (!trimmed) return;
    const win =
      typeof window !== "undefined"
        ? (window as unknown as {
            SpeechRecognition?: new () => SpeechRecognitionLite;
            webkitSpeechRecognition?: new () => SpeechRecognitionLite;
          })
        : null;
    const SR = (win?.SpeechRecognition ??
      win?.webkitSpeechRecognition) as (new () => SpeechRecognitionLite) | undefined;
    if (!SR) return;

    if (recognitionTimeoutRef.current) {
      clearTimeout(recognitionTimeoutRef.current);
      recognitionTimeoutRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    setRecognizedText("");
    setPronunciationFeedback(null);
    recognitionTranscriptRef.current = "";
    setIsListening(true);

    const recognition = new SR();
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (e: SpeechRecognitionEventLite) => {
      const transcript = e.results[0]?.[0]?.transcript ?? "";
      recognitionTranscriptRef.current = transcript;
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      if (recognitionTimeoutRef.current) {
        clearTimeout(recognitionTimeoutRef.current);
        recognitionTimeoutRef.current = null;
      }
      const heard = recognitionTranscriptRef.current.trim();
      setRecognizedText(heard);
      const match = normalizeWord(heard) === normalizeWord(trimmed);
      setPronunciationFeedback(
        match ? "Good pronunciation" : "Try again"
      );
      setIsListening(false);
    };

    recognition.onerror = () => {
      recognitionRef.current = null;
      if (recognitionTimeoutRef.current) {
        clearTimeout(recognitionTimeoutRef.current);
        recognitionTimeoutRef.current = null;
      }
      setIsListening(false);
    };

    try {
      recognition.start();
    } catch {
      setIsListening(false);
      return;
    }

    recognitionTimeoutRef.current = setTimeout(() => {
      recognitionTimeoutRef.current = null;
      try {
        recognition.stop();
      } catch {
        // ignore
      }
    }, 3000);
  }, []);

  return {
    startListening,
    recognizedText,
    pronunciationFeedback,
    isListening,
    reset,
  };
}
