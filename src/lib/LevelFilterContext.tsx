"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { EnglishLevel } from "@/types/lesson";

interface LevelFilterContextValue {
  levelFilter: EnglishLevel;
  setLevelFilter: (level: EnglishLevel) => void;
  pickerOpen: boolean;
  setPickerOpen: (open: boolean) => void;
  togglePicker: () => void;
}

const LevelFilterContext = createContext<LevelFilterContextValue | null>(null);

export function LevelFilterProvider({ children }: { children: ReactNode }) {
  const [levelFilter, setLevelFilter] = useState<EnglishLevel>("beginner");
  const [pickerOpen, setPickerOpen] = useState(false);

  const togglePicker = useCallback(() => {
    setPickerOpen((open) => !open);
  }, []);

  const value = useMemo(
    () => ({
      levelFilter,
      setLevelFilter,
      pickerOpen,
      setPickerOpen,
      togglePicker,
    }),
    [levelFilter, pickerOpen, togglePicker]
  );

  return (
    <LevelFilterContext.Provider value={value}>
      {children}
    </LevelFilterContext.Provider>
  );
}

export function useLevelFilter() {
  const ctx = useContext(LevelFilterContext);
  if (!ctx) {
    throw new Error("useLevelFilter must be used within LevelFilterProvider");
  }
  return ctx;
}
