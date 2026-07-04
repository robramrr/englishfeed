"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ClientOnlyFeed,
  FeedShellPlaceholder,
} from "@/components/ClientOnlyFeed";
import { useAuth } from "@/lib/AuthContext";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth");
    }
  }, [loading, user, router]);

  if (!loading && !user) {
    return null;
  }

  if (loading || !user) {
    return <FeedShellPlaceholder />;
  }

  return <ClientOnlyFeed userId={user.id} />;
}
