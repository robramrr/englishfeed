import type { Lesson } from "@/types/lesson";

const R2_PUBLIC_BASE = "https://pub-f15ee3d0e2ea44a6ab6b5985df74d4a5.r2.dev";

function r2VideoUrl(filename: string): string {
  return `${R2_PUBLIC_BASE}/${filename}`;
}

/** Derive subtitles URL from video filename: carolina-lesson.mp4 → /subtitles/carolina-lesson.json. Subtitle files are generated automatically by the /api/lessons flow when missing. */
function subtitlesUrlForVideo(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "");
  return `/subtitles/${base}.json`;
}

/** Derive thumbnail URL from video filename: carolina-lesson.mp4 → thumbnails/carolina-lesson.jpg */
function r2ThumbnailUrl(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "");
  return `${R2_PUBLIC_BASE}/thumbnails/${base}.jpg`;
}

export const sampleLessons: Lesson[] = [
  {
    id: "2",
    title: "English for pregnancy and checkups",
    description:
      "Phrases for talking with a doctor or midwife: symptoms, appointments, and how you feel.",
    videoUrl: r2VideoUrl("carolina-lesson.mp4"),
    thumbnailUrl: r2ThumbnailUrl("carolina-lesson.mp4"),
    subtitlesUrl: subtitlesUrlForVideo("carolina-lesson.mp4"),
    level: "beginner",
    durationSeconds: 90,
    topic: "health",
    tags: ["health", "conversation", "vocabulary"],
    vocabulary: [
      { word: "appointment", meaning: "a scheduled time to see a doctor" },
      { word: "trimester", meaning: "one of three stages of pregnancy" },
      { word: "How have you been feeling?", meaning: "a common way to ask about health" },
      { word: "I'd like to ask about", meaning: "polite way to bring up a concern" },
    ],
    practice: [
      {
        question: "How do you politely tell the doctor you have a concern?",
        options: [
          "You must listen to me.",
          "I'd like to ask about something, please.",
          "Listen, I have a problem.",
        ],
        correctIndex: 1,
      },
      {
        question: "Which question might a caregiver ask you?",
        options: [
          "How have you been feeling?",
          "What is your favourite food?",
          "Where did you buy your shoes?",
        ],
        correctIndex: 0,
      },
      {
        question: "Choose the natural sentence at a checkup.",
        options: [
          "I have appointment tomorrow.",
          "I have an appointment tomorrow.",
          "I having appointment tomorrow.",
        ],
        correctIndex: 1,
      },
    ],
  },
];
