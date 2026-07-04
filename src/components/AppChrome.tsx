"use client";

import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { useAuth } from "@/lib/AuthContext";

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  const showHeader =
    !pathname?.startsWith("/auth") && !loading && Boolean(user);

  return (
    <>
      {showHeader && <AppHeader />}
      <div className={showHeader ? "pt-[var(--header-height)]" : undefined}>
        {children}
      </div>
    </>
  );
}
