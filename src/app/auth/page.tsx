"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ComicButton, ComicCard, ComicText, ComicTitle } from "@/components/comic";
import { ENGLISHFEED_LOGO_URL } from "@/lib/brand";
import { supabaseBrowserClient } from "@/lib/supabaseClient";

type Mode = "sign_in" | "sign_up";

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (!supabaseBrowserClient) {
        setError(
          "Authentication is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
        );
        return;
      }
      if (mode === "sign_up") {
        const { error: signUpError } = await supabaseBrowserClient.auth.signUp({
          email,
          password,
        });
        if (signUpError) {
          setError(signUpError.message);
          return;
        }
      } else {
        const { error: signInError } =
          await supabaseBrowserClient.auth.signInWithPassword({
            email,
            password,
          });
        if (signInError) {
          setError(signInError.message);
          return;
        }
      }

      router.replace("/");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden comic-bg-purple comic-pattern-zigzag px-4 py-12">
      <div className="relative z-10 w-full max-w-md">
        <ComicCard className="flex min-h-[32rem] flex-col px-6 pb-8 pt-10">
          <img
            src={ENGLISHFEED_LOGO_URL}
            alt="EnglishFeed"
            className="mx-auto mb-8 h-16 w-auto"
          />
          <ComicTitle level={3} className="comic-title mb-6 text-center">
            {mode === "sign_in" ? "Sign in to EnglishFeed" : "Create your account"}
          </ComicTitle>

          <div className="mb-6 flex gap-2">
            <ComicButton
              type="button"
              variant={mode === "sign_in" ? "primary" : "ghost"}
              size="sm"
              className="flex-1"
              onClick={() => setMode("sign_in")}
            >
              Sign in
            </ComicButton>
            <ComicButton
              type="button"
              variant={mode === "sign_up" ? "primary" : "ghost"}
              size="sm"
              className="flex-1"
              onClick={() => setMode("sign_up")}
            >
              Sign up
            </ComicButton>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <ComicText as="label" bold className="mb-2 block text-sm text-brand-navy">
                Email
              </ComicText>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="comic-input"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <ComicText as="label" bold className="mb-2 block text-sm text-brand-navy">
                Password
              </ComicText>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="comic-input"
                placeholder="••••••••"
              />
            </div>
            {error && (
              <p
                className="comic-panel-compact px-3 py-2 text-sm font-bold text-brand-red"
                role="alert"
              >
                {error}
              </p>
            )}
            <ComicButton
              type="submit"
              variant="secondary"
              size="md"
              className="mt-2 w-full"
              disabled={loading}
            >
              {loading
                ? "Please wait…"
                : mode === "sign_in"
                  ? "Sign in"
                  : "Create account"}
            </ComicButton>
          </form>
        </ComicCard>
      </div>
    </section>
  );
}
