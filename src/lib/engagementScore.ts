export type EngagementMetrics = {
  views: number;
  completions: number;
  replays: number;
  likes: number;
  saves: number;
  avgWatchTime: number;
};

/**
 * Calculate engagement score for a lesson from aggregated metrics.
 * Formula: avgWatchTime + (completions * 5) + (replays * 3) + (likes * 4) + (saves * 6)
 */
export function calculateLessonScore(metrics: EngagementMetrics): number {
  const { avgWatchTime, completions, replays, likes, saves } = metrics;
  return (
    avgWatchTime +
    completions * 5 +
    replays * 3 +
    likes * 4 +
    saves * 6
  );
}
