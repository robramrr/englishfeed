import Link from "next/link";
import { getLessonsForLevel } from "@/lib/lessonsData";
import VideoThumbnailImage from "@/components/VideoThumbnailImage";

/** Default feed level so tag page shows the same lessons as the feed. */
const DEFAULT_FEED_LEVEL = "beginner" as const;

export default async function TagPage({
  params,
}: {
  params: Promise<{ tag?: string }>;
}) {
  const { tag: rawTag } = await params;
  const tag = decodeURIComponent(rawTag ?? "").trim();

  const lessons = getLessonsForLevel(DEFAULT_FEED_LEVEL);
  const filteredLessons = lessons.filter((lesson) =>
    lesson.tags?.some(
      (t) => t.trim().toLowerCase() === tag.trim().toLowerCase()
    )
  );

  return (
    <div className="flex min-h-screen flex-col overflow-y-auto bg-white text-black">
      <header className="shrink-0 border-b-2 border-black bg-white px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <Link
            href="/"
            className="text-sm font-bold text-black underline"
            aria-label="Back to feed"
          >
            ← Back
          </Link>
          <h1 className="text-lg font-bold">#{tag}</h1>
          <span className="w-12" aria-hidden />
        </div>
      </header>
      <main className="min-h-0 flex-1">
        <div className="mx-auto max-w-lg px-4 py-6">
          {filteredLessons.length === 0 ? (
            <div className="mx-auto w-fit rounded-none border-2 border-black bg-white px-6 py-6 shadow-[3px_3px_0px_black]">
              <p className="text-sm font-bold text-black">
              No lessons found for this tag yet.
              </p>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-3 gap-1">
              {filteredLessons.map((lesson) => (
                <Link
                  key={lesson.id}
                  href={`/?video=${encodeURIComponent(lesson.id)}`}
                  className="block overflow-hidden rounded-none border-2 border-black bg-white shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95"
                  aria-label={`Play ${lesson.title}`}
                >
                  <VideoThumbnailImage
                    thumbnailUrl={lesson.thumbnailUrl}
                    videoUrl={lesson.videoUrl}
                    title={lesson.title}
                    variant="brutalist"
                  />
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

