"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useAuth } from "@/lib/AuthContext";

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  const isAuthRoute = pathname?.startsWith("/auth") ?? false;
  const isFeed = pathname === "/";
  const showHeader = !isAuthRoute && !loading && Boolean(user);
  const reserveHeader = !isAuthRoute;

  useEffect(() => {
    if (!isFeed) return;
    document.documentElement.classList.add("feed-locked");
    return () => document.documentElement.classList.remove("feed-locked");
  }, [isFeed]);

  return (
    <>
      {showHeader ? (
        <AppHeader />
      ) : reserveHeader ? (
        <div
          className="comic-bg-header-stripes comic-border-b-4 fixed inset-x-0 top-0 z-50 h-[var(--header-height)]"
          aria-hidden
        />
      ) : null}
      <div
        className={
          reserveHeader && !isFeed
            ? "comic-bg-edtech-light min-h-[var(--feed-viewport-height)] pt-[var(--header-height)]"
            : undefined
        }
      >
        {children}
      </div>
    </>
  );
}
