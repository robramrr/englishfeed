import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { getCombinedLessons } from "@/lib/lessonsData";
import type { StoredLessonItem } from "@/lib/feedStorage";

type SavePayload = {
  userId?: string | null;
  lessonId?: string;
};

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
      .from("saves")
      .select("lesson_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("saves GET error:", error);
      return NextResponse.json(
        { error: "Failed to load saves" },
        { status: 500 }
      );
    }

    const lessons = getCombinedLessons();
    const items: StoredLessonItem[] =
      (data ?? []).flatMap((row) => {
        const lesson = lessons.find((l) => l.id === row.lesson_id);
        if (!lesson) return [];
        return [
          {
            id: lesson.id,
            title: lesson.title,
            videoUrl: lesson.videoUrl,
            thumbnailUrl: lesson.thumbnailUrl,
            savedAt: row.created_at ? Date.parse(row.created_at as string) : Date.now(),
          },
        ];
      });

    return NextResponse.json({ items });
  } catch (e) {
    console.error("saves GET exception:", e);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SavePayload;
    const userId = body.userId ?? null;
    const lessonId = body.lessonId ?? "";

    if (!userId || !lessonId) {
      return NextResponse.json(
        { error: "Missing userId or lessonId" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();
    const { error } = await supabase
      .from("saves")
      .upsert(
        { user_id: userId, lesson_id: lessonId },
        { onConflict: "user_id,lesson_id", ignoreDuplicates: false }
      );

    if (error) {
      console.error("saves POST error:", error);
      return NextResponse.json(
        { error: "Failed to save lesson" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("saves POST exception:", e);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const lessonId = searchParams.get("lessonId");

  if (!userId || !lessonId) {
    return NextResponse.json(
      { error: "Missing userId or lessonId" },
      { status: 400 }
    );
  }

  try {
    const supabase = getSupabaseServer();
    const { error } = await supabase
      .from("saves")
      .delete()
      .eq("user_id", userId)
      .eq("lesson_id", lessonId);

    if (error) {
      console.error("saves DELETE error:", error);
      return NextResponse.json(
        { error: "Failed to unsave lesson" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("saves DELETE exception:", e);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 }
    );
  }
}

