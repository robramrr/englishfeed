"use client";

import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { useAuth } from "@/lib/AuthContext";

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  const isAuthRoute = pathname?.startsWith("/auth") ?? false;
  const showHeader = !isAuthRoute && !loading && Boolean(user);
  const reserveHeader = !isAuthRoute;

  return (
    <>
      {showHeader ? (
        <AppHeader />
      ) : reserveHeader ? (
        <div
          className="fixed inset-x-0 top-0 z-50 h-[var(--header-height)] border-b border-zinc-200 bg-white"
          aria-hidden
        />
      ) : null}
      <div className={reserveHeader ? "bg-black pt-[var(--header-height)]" : undefined}>
        {children}
      </div>
    </>
  );
}
