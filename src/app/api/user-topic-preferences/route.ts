import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
import type { Lesson } from "@/types/lesson";
import lessonsFromJson from "@/data/lessons.json";

import { sampleLessons } from "@/data/sample-lessons";

function getCombinedLessons(): Lesson[] {
  const fromJson =
    Array.isArray(lessonsFromJson) && lessonsFromJson.length > 0
      ? (lessonsFromJson as Lesson[])
      : [];
  return fromJson.length > 0 ? fromJson : sampleLessons;
}

/**
 * Build map lesson_id -> topic from app lesson data.
 * Events reference lesson_id; we use this to get topic per event.
 */
function getLessonIdToTopic(): Map<string, string> {
  const lessons = getCombinedLessons();
  const map = new Map<string, string>();
  for (const lesson of lessons) {
    if (lesson.topic) map.set(lesson.id, lesson.topic);
  }
  return map;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId query parameter" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();
    const { data: rows, error } = await supabase
      .from("events")
      .select("lesson_id")
      .eq("user_id", userId);

    if (error) {
      console.error("user-topic-preferences query error:", error);
      return NextResponse.json(
        { error: "Failed to fetch user events" },
        { status: 500 }
      );
    }

    const lessonIdToTopic = getLessonIdToTopic();
    const topicCounts: Record<string, number> = {};

    for (const row of rows ?? []) {
      const lessonId = (row as { lesson_id: string }).lesson_id ?? "";
      const topic = lessonIdToTopic.get(lessonId);
      if (!topic) continue;
      topicCounts[topic] = (topicCounts[topic] ?? 0) + 1;
    }

    const total = Object.values(topicCounts).reduce((a, b) => a + b, 0);
    const topics: Record<string, number> = {};
    if (total > 0) {
      for (const [topic, count] of Object.entries(topicCounts)) {
        topics[topic] = count / total;
      }
    }

    return NextResponse.json({ topics });
  } catch (e) {
    console.error("user-topic-preferences error:", e);
    return NextResponse.json(
      { error: "Failed to compute topic preferences" },
      { status: 500 }
    );
  }
}
