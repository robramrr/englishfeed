"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { User } from "lucide-react";
import { ENGLISHFEED_LOGO_URL } from "@/lib/brand";
import { requestFeedScrollToStart } from "@/lib/feedNavigation";

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();

  const handleHomeClick = () => {
    if (pathname === "/") {
      requestFeedScrollToStart();
      return;
    }
    router.push("/");
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex h-[var(--header-height)] items-center justify-between border-b border-zinc-200 bg-white px-3">
      <Link
        href="/profile"
        className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-800 transition hover:bg-zinc-100"
        aria-label="Profile"
      >
        <User className="h-5 w-5" strokeWidth={2.25} />
      </Link>

      <button
        type="button"
        onClick={handleHomeClick}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md p-1 transition hover:opacity-80"
        aria-label="Home — back to start of feed"
      >
        <img
          src={ENGLISHFEED_LOGO_URL}
          alt="EnglishFeed"
          className="h-9 w-auto"
        />
      </button>

      <span className="h-10 w-10 shrink-0" aria-hidden />
    </header>
  );
}
