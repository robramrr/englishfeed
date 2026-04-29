import { getSupabaseServer } from "@/lib/supabaseServer";

type RateLimitOptions = {
  route: string;
  limit: number;
  windowMs: number;
  userId?: string | null;
};

type RateLimitResult = {
  allowed: boolean;
  retryAfterSec: number;
};

function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();
  return "unknown";
}

// Minimal fixed-window limiter using Supabase as shared storage.
// For higher scale and lower latency, upgrade later to Redis.
export async function checkRateLimit(
  request: Request,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const supabase = getSupabaseServer();
  const now = Date.now();
  const headerUserId = request.headers.get("x-user-id");
  const resolvedUserId =
    options.userId && options.userId.trim() !== ""
      ? options.userId.trim()
      : headerUserId && headerUserId.trim() !== ""
        ? headerUserId.trim()
        : null;
  const identifier =
    resolvedUserId
      ? `user:${resolvedUserId}`
      : `ip:${getClientIp(request)}`;
  const windowStartMs = Math.floor(now / options.windowMs) * options.windowMs;
  const windowStartIso = new Date(windowStartMs).toISOString();
  const windowEndMs = windowStartMs + options.windowMs;
  const key = `${options.route}:${identifier}:${windowStartMs}`;

  const { data: existing, error: selectError } = await supabase
    .from("api_rate_limits")
    .select("count")
    .eq("key", key)
    .maybeSingle();
  if (selectError) {
    return { allowed: true, retryAfterSec: 0 };
  }

  const currentCount = Number(existing?.count ?? 0);
  if (currentCount >= options.limit) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((windowEndMs - now) / 1000)),
    };
  }

  if (existing) {
    const { error: updateError } = await supabase
      .from("api_rate_limits")
      .update({ count: currentCount + 1, updated_at: new Date().toISOString() })
      .eq("key", key);
    if (updateError) return { allowed: true, retryAfterSec: 0 };
  } else {
    const { error: insertError } = await supabase.from("api_rate_limits").insert({
      key,
      route: options.route,
      identifier,
      window_start: windowStartIso,
      count: 1,
    });
    if (insertError) return { allowed: true, retryAfterSec: 0 };
  }

  return { allowed: true, retryAfterSec: 0 };
}
