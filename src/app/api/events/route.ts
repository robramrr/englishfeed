import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
import {
  LIKE,
  SAVE,
  VIDEO_COMPLETE,
  VIDEO_VIEW_END,
  VIDEO_VIEW_START,
} from "@/lib/eventTypes";

export type EventsPayload = {
  event: string;
  lessonId: string;
  userId?: string | null;
  timestamp: number;
  watchTime?: number;
};

const COMPLETION_WATCH_TIME_THRESHOLD = 20;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as EventsPayload;
    console.log("EVENT:", body);

    try {
      const supabase = getSupabaseServer();
      await supabase.from("events").insert({
        event_type: body.event,
        lesson_id: body.lessonId,
        user_id: body.userId ?? null,
        watch_time: body.watchTime ?? null,
        timestamp: body.timestamp,
      });

      // Write-time aggregation via RPC with atomic increments (no read-before-write).
      if (body.lessonId) {
        const watchTime =
          typeof body.watchTime === "number" && Number.isFinite(body.watchTime)
            ? body.watchTime
            : 0;
        const { error: statsError } = await supabase.rpc("increment_lesson_stats", {
          p_lesson_id: body.lessonId,
          p_views_delta: body.event === VIDEO_VIEW_START ? 1 : 0,
          p_watch_time_delta: body.event === VIDEO_VIEW_END ? watchTime : 0,
          p_completions_delta:
            body.event === VIDEO_COMPLETE ||
            (body.event === VIDEO_VIEW_END &&
              watchTime >= COMPLETION_WATCH_TIME_THRESHOLD)
              ? 1
              : 0,
          p_likes_delta: body.event === LIKE ? 1 : 0,
          p_saves_delta: body.event === SAVE ? 1 : 0,
        });
        if (statsError) {
          console.error("Events stats RPC error:", statsError);
        }
      }
    } catch (dbError) {
      console.error("Events DB insert error:", dbError);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Events API error:", e);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
