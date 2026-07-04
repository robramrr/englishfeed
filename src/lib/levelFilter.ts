import type { EnglishLevel } from "@/types/lesson";

export const LEVEL_OPTIONS: { value: EnglishLevel; label: string }[] = [
  { value: "beginner", label: "Foundation" },
  { value: "intermediate", label: "Conversational" },
  { value: "advanced", label: "Advanced" },
];
