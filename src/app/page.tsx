"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ClientOnlyFeed } from "@/components/ClientOnlyFeed";
import { useAuth } from "@/lib/AuthContext";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <main className="fixed inset-x-0 top-0 flex w-full items-center justify-center bg-black text-zinc-400" style={{ bottom: "var(--nav-height)", height: "calc(100dvh - var(--nav-height))" }}>
        Loading…
      </main>
    );
  }

  if (!user) {
    // Redirecting to /auth
    return null;
  }

  return <ClientOnlyFeed userId={user.id} />;
}

