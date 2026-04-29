"use client";

import { useAuth } from "@/lib/AuthContext";
import { BottomNav } from "@/components/BottomNav";
import { usePathname } from "next/navigation";

export function BottomNavGate() {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  // Never show the bottom bar on auth screens.
  if (pathname?.startsWith("/auth")) return null;

  // Only show after auth is resolved and the user is signed in.
  if (loading || !user) return null;

  return <BottomNav />;
}

