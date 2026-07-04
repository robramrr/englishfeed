"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
    <main className="flex min-h-screen items-center justify-center bg-white text-black p-4">
      <div className="w-full max-w-sm">
        <img
          src="https://res.cloudinary.com/dkbf7tvcx/image/upload/v1783143201/englishfeed/logo/englishfeed-logo.png"
          alt="EnglishFeed"
          className="mx-auto mb-4 h-14 w-auto"
        />
        <div className="w-full rounded-none border-2 border-black bg-white p-6 shadow-[3px_3px_0px_black]">
          <h1 className="mb-4 text-center text-xl font-bold">
          {mode === "sign_in" ? "Sign in to EnglishFeed" : "Create your account"}
          </h1>
          <div className="mb-4 flex gap-2 rounded-none p-1">
          <button
            type="button"
            onClick={() => setMode("sign_in")}
            className={`flex-1 rounded-none border-2 border-black px-3 py-1 text-sm font-bold text-black shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none ${
              mode === "sign_in" ? "bg-white text-black" : "bg-white/40"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode("sign_up")}
            className={`flex-1 rounded-none border-2 border-black px-3 py-1 text-sm font-bold text-black shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none ${
              mode === "sign_up" ? "bg-white text-black" : "bg-white/40"
            }`}
          >
            Sign up
          </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-black">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-none border-2 border-black bg-white px-3 py-2 text-sm text-black outline-none focus:border-black focus:ring-0"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-black">
                Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-none border-2 border-black bg-white px-3 py-2 text-sm text-black outline-none focus:border-black focus:ring-0"
                placeholder="••••••••"
              />
            </div>
            {error && (
              <p className="rounded-none border-2 border-black bg-white px-3 py-2 text-xs font-bold text-red-700 shadow-[2px_2px_0px_black]" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-none border-2 border-black bg-white py-2 text-sm font-bold text-black shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading
                ? "Please wait…"
                : mode === "sign_in"
                  ? "Sign in"
                  : "Create account"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

