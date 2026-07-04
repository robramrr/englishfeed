"use client";

import { LEVEL_OPTIONS } from "@/lib/levelFilter";
import { useLevelFilter } from "@/lib/LevelFilterContext";
import { ComicText } from "@/components/comic";

interface LevelPickerOverlayProps {
  onSelect?: (level: (typeof LEVEL_OPTIONS)[number]["value"]) => void;
}

export function LevelPickerOverlay({ onSelect }: LevelPickerOverlayProps) {
  const { levelFilter, setLevelFilter, pickerOpen, setPickerOpen } =
    useLevelFilter();

  if (!pickerOpen) return null;

  return (
    <div
      className="fixed inset-x-0 z-50 flex items-center justify-center bg-brand-navy/60 px-4"
      style={{
        top: "var(--header-height)",
        bottom: 0,
      }}
      onClick={() => setPickerOpen(false)}
      role="presentation"
    >
      <div
        className="comic-card min-w-[14rem] overflow-hidden p-0"
        role="listbox"
        aria-label="Select English level"
        onClick={(e) => e.stopPropagation()}
      >
        <ComicText
          as="p"
          bold
          className="comic-border-b-4 border-b px-3 py-3 text-center text-xs uppercase tracking-wide text-brand-navy"
        >
          Choose your level
        </ComicText>
        {LEVEL_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="option"
            aria-selected={levelFilter === value}
            onClick={() => {
              if (onSelect) {
                onSelect(value);
              } else {
                setLevelFilter(value);
              }
              setPickerOpen(false);
            }}
            className={`flex w-full items-center gap-2 border-b-4 border-brand-navy px-3 py-3 text-left text-sm font-bold transition last:border-b-0 hover:brightness-110 active:scale-[0.99] ${
              levelFilter === value
                ? "comic-bg-primary text-white"
                : "bg-white text-brand-navy hover:bg-brand-gray/50"
            }`}
          >
            {levelFilter === value ? (
              <span className="text-xs" aria-hidden>
                ✓
              </span>
            ) : (
              <span className="w-3" aria-hidden />
            )}
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
