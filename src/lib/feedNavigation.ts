export const FEED_SCROLL_TO_START_EVENT = "englishfeed:feed-scroll-to-start";

export function requestFeedScrollToStart() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(FEED_SCROLL_TO_START_EVENT));
}
