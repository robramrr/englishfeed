import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
type LessonEngagement = {
  lessonId: string;
  views: number;
  totalWatchTime: number;
  completions: number;
  likes: number;
  saves: number;
  score: number;
};

export async function GET(_request: NextRequest) {
  try {
    const supabase = getSupabaseServer();
    // Fast read path: only read pre-aggregated per-lesson stats.
    const { data: rows, error } = await supabase
      .from("lesson_engagement_stats")
      .select("lesson_id, views, total_watch_time, completions, likes, saves, score")
      .order("score", { ascending: false });

    if (error) {
      console.error("lesson-engagement query error:", error);
      return NextResponse.json(
        { error: "Failed to fetch engagement stats" },
        { status: 500 }
      );
    }

    const lessons: LessonEngagement[] = ((rows ?? []) as Array<Record<string, unknown>>)
      .map((row) => ({
        lessonId: String(row.lesson_id ?? ""),
        views: Number(row.views ?? 0),
        totalWatchTime: Number(row.total_watch_time ?? 0),
        completions: Number(row.completions ?? 0),
        likes: Number(row.likes ?? 0),
        saves: Number(row.saves ?? 0),
        score: Number(row.score ?? 0),
      }))
      .filter((row) => row.lessonId !== "");

    return NextResponse.json({ lessons });
  } catch (e) {
    console.error("lesson-engagement error:", e);
    return NextResponse.json(
      { error: "Failed to fetch engagement stats" },
      { status: 500 }
    );
  }
}
