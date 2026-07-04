"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Rss, User } from "lucide-react";
import { ENGLISHFEED_LOGO_URL } from "@/lib/brand";
import { requestFeedScrollToStart } from "@/lib/feedNavigation";
import { useLevelFilter } from "@/lib/LevelFilterContext";

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { pickerOpen, setPickerOpen, togglePicker } = useLevelFilter();
  const openPickerOnFeedRef = useRef(false);

  useEffect(() => {
    if (pathname === "/" && openPickerOnFeedRef.current) {
      openPickerOnFeedRef.current = false;
      setPickerOpen(true);
      return;
    }
    if (pathname !== "/") {
      setPickerOpen(false);
    }
  }, [pathname, setPickerOpen]);

  const handleHomeClick = () => {
    setPickerOpen(false);
    if (pathname === "/") {
      requestFeedScrollToStart();
      return;
    }
    router.push("/");
  };

  const handleFeedLevelClick = () => {
    if (pathname !== "/") {
      openPickerOnFeedRef.current = true;
      router.push("/");
      return;
    }
    togglePicker();
  };

  const headerBtnClass =
    "flex h-10 w-10 items-center justify-center text-brand-navy transition hover:opacity-80";

  return (
    <header className="comic-bg-header-stripes comic-border-b-2 comic-shadow-xl fixed inset-x-0 top-0 z-50 flex h-[var(--header-height)] items-center justify-between px-3 md:comic-border-b-4">
      <Link
        href="/profile"
        className={headerBtnClass}
        aria-label="Profile"
      >
        <User className="h-5 w-5" strokeWidth={2.25} />
      </Link>

      <button
        type="button"
        onClick={handleHomeClick}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg p-1 transition hover:opacity-80"
        aria-label="Home — back to start of feed"
      >
        <img
          src={ENGLISHFEED_LOGO_URL}
          alt="EnglishFeed"
          className="h-9 w-auto"
        />
      </button>

      <button
        type="button"
        onClick={handleFeedLevelClick}
        className={`flex h-10 w-10 items-center justify-center transition hover:opacity-90 ${
          pickerOpen ? "comic-bg-primary text-white" : "text-brand-navy hover:opacity-80"
        }`}
        aria-label="Feed level"
        aria-expanded={pickerOpen}
        aria-haspopup="listbox"
      >
        <Rss className="h-5 w-5" strokeWidth={2.25} aria-hidden />
      </button>
    </header>
  );
}
