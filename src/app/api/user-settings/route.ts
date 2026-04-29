import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

const VALID_LEVELS = ["beginner", "intermediate", "advanced"] as const;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json(
      { error: "Missing userId" },
      { status: 400 }
    );
  }

  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("user_settings")
      .select("level")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("user-settings GET error:", error);
      return NextResponse.json(
        { error: "Failed to load settings" },
        { status: 500 }
      );
    }

    const level =
      data?.level && VALID_LEVELS.includes(data.level as (typeof VALID_LEVELS)[number])
        ? data.level
        : "beginner";

    return NextResponse.json({ level });
  } catch (e) {
    console.error("user-settings GET exception:", e);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as { userId?: string; level?: string };
    const userId = body.userId ?? "";
    const rawLevel = (body.level ?? "beginner").toLowerCase();

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId" },
        { status: 400 }
      );
    }

    const level = VALID_LEVELS.includes(rawLevel as (typeof VALID_LEVELS)[number])
      ? rawLevel
      : "beginner";

    const supabase = getSupabaseServer();
    const { error } = await supabase
      .from("user_settings")
      .upsert(
        { user_id: userId, level },
        { onConflict: "user_id" }
      );

    if (error) {
      console.error("user-settings PUT error:", error);
      return NextResponse.json(
        { error: "Failed to save settings" },
        { status: 500 }
      );
    }

    return NextResponse.json({ level });
  } catch (e) {
    console.error("user-settings PUT exception:", e);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
