"use client";

import { LEVEL_OPTIONS } from "@/lib/levelFilter";
import { useLevelFilter } from "@/lib/LevelFilterContext";

interface LevelPickerOverlayProps {
  onSelect?: (level: (typeof LEVEL_OPTIONS)[number]["value"]) => void;
}

export function LevelPickerOverlay({ onSelect }: LevelPickerOverlayProps) {
  const { levelFilter, setLevelFilter, pickerOpen, setPickerOpen } =
    useLevelFilter();

  if (!pickerOpen) return null;

  return (
    <div
      className="fixed inset-x-0 z-50 flex items-center justify-center bg-black/60 px-4"
      style={{
        top: "var(--header-height)",
        bottom: 0,
      }}
      onClick={() => setPickerOpen(false)}
      role="presentation"
    >
      <div
        className="min-w-[14rem] rounded-none border-2 border-black bg-white py-0 shadow-[4px_4px_0px_black]"
        role="listbox"
        aria-label="Select English level"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="border-b-2 border-black px-3 py-2 text-center text-xs font-bold uppercase tracking-wide text-black">
          Choose your level
        </p>
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
            className={`flex w-full items-center gap-2 border-b-2 border-black px-3 py-3 text-left text-sm font-bold transition last:border-b-0 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none active:scale-[0.99] ${
              levelFilter === value
                ? "bg-black text-white"
                : "bg-white text-black hover:bg-zinc-100"
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
