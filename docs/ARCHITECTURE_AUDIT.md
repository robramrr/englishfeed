# EnglishFeed – Full Project Architecture Audit

**Product:** EnglishFeed (Englishfully platform) – TikTok-style English learning feed  
**Scope:** Entire codebase analysis; no code changes.

---

## 1. Current System Architecture

### Frontend framework
- **Next.js 16** (App Router), **React 19**, **TypeScript**
- **Tailwind CSS v4** for styling
- **lucide-react** for nav icons
- Single main route: `/` → `ClientOnlyFeed` (feed). Other routes: `/vocabulary`, `/review`, `/progress`, `/clips`, `/courses`, `/tutor`, `/inbox`, `/profile` (most are placeholders).
- **Layout:** Root layout wraps children in a flex column with bottom padding for nav; **BottomNav** is fixed at bottom (TikTok-style). Feed main is fixed and sized with `bottom: var(--nav-height)` so it sits above the nav.

### Backend / API structure
- **Next.js Route Handlers** only; no separate backend server.
- **API routes:**
  - **`GET /api/lessons`** – Paginated lessons. Query: `level`, `cursor`. Returns `{ lessons, nextCursor }`. Also triggers **background subtitle generation** for lessons whose subtitle file is missing or empty (fire-and-forget).
  - **`POST /api/context-definition`** – OpenAI: word + sentence + definitions → context definition, synonyms, examples (for word popup).
  - **`POST /api/translate-thai`** – OpenAI: English vocab → Thai translations (optional L1 support).
- No database, no auth, no server-side session.

### Video delivery system
- **Cloudflare R2** public bucket: `https://pub-f15ee3d0e2ea44a6ab6b5985df74d4a5.r2.dev`
- Video URLs are built in **`src/data/sample-lessons.ts`** with `r2VideoUrl(filename)` (e.g. `video.mp4` → full R2 URL).
- **`<video>`** in **VideoSlide** uses `src={lesson.videoUrl}`; playback is from R2 (streaming). No app-level CDN or proxy; browser fetches directly from R2.

### Subtitle generation pipeline
- **Server-only:** `src/lib/generateSubtitlesForVideo.ts` exports `generateSubtitlesForVideo(filename)` and `needsSubtitleGeneration(filename)`.
- **Flow:** (1) If `public/subtitles/<name>.json` exists and has non-empty `segments`, return (cache). (2) Else: fetch video from R2 → write temp file → **OpenAI Whisper** `verbose_json` → write `public/subtitles/<name>.json` (segments with id, start, end, text) → delete temp file.
- **Triggered by:** (a) **`GET /api/lessons`** – for each unique video filename in combined lessons, if `needsSubtitleGeneration(filename)` then `generateSubtitlesForVideo(filename)` is called in the background (not awaited). (b) **CLI:** `npx tsx scripts/generateSubtitles.ts <filename>` (uses same helper).
- **Output:** JSON files in `public/subtitles/` (e.g. `video.json`, `carolina-lesson.json`), served as static assets.

### Data storage
- **Lessons:** In-repo only. **Primary:** `src/data/sample-lessons.ts` (hardcoded array). **Optional:** `src/data/lessons.json` (currently `[]`). API uses “combined” source: if `lessons.json` is non-empty array, use it; else use `sampleLessons`. No DB.
- **User data:** **localStorage** only. **Vocab:** `vocabStorage.ts` – key `englishfeed_vocab` (saved words, review counts). **Clips:** `clipStorage.ts` – key `englishfeed_clips` (sentence, videoId, timestamp). No server persistence, no accounts.

### Where lesson data is defined
- **Types:** `src/types/lesson.ts` – `Lesson` (id, title, description, videoUrl, level, durationSeconds, vocabulary?, subtitlesUrl?), `VocabularyItem`, `EnglishLevel`.
- **Source of truth for feed:** `src/data/sample-lessons.ts` (and optionally `src/data/lessons.json`). Lessons reference R2 video filenames and derive `subtitlesUrl` via `subtitlesUrlForVideo(filename)` (e.g. `video.mp4` → `/subtitles/video.json`).
- **Filtering:** `src/lib/lessonFilter.ts` – `filterLessonsByLevel(lessons, maxLevel)` (beginner / intermediate / advanced).

### Where AI integrations exist
- **OpenAI Whisper** – `src/lib/generateSubtitlesForVideo.ts` (transcription). Used when subtitle file is missing/empty; runs server-side (Node).
- **OpenAI (GPT)** – **Context definition:** `src/app/api/context-definition/route.ts` – in-context definition + synonyms + examples for word popup. **Thai translation:** `src/app/api/translate-thai/route.ts` – vocab to Thai. Both require `OPENAI_API_KEY`; fallbacks if missing.
- **Pronunciation:** Browser **Web Speech API** (`SpeechRecognition`) in `src/lib/pronunciation.ts` – client-side only; no server AI. Word match = “Good pronunciation” / “Try again”; no numeric score.

---

## 2. Feed System

### How videos load
- **VideoFeed** gets lessons from **`GET /api/lessons?level=...&cursor=...`** (first batch with `cursor=0`, then more when user scrolls near end).
- Each lesson is rendered as a full-height slide; **VideoSlide** receives `lesson` and sets `<video src={lesson.videoUrl}>`. Video source is the R2 URL; browser loads/streams it. **preload="metadata"** on the video element.

### How infinite scroll works
- **VideoFeed** keeps `lessons` (array) and `nextCursor` (number | null). On scroll, **handleScroll** computes index from `scrollTop / slideHeight` and updates `currentIndex`. When `scrollBottom` is within half a screen of the end and `nextCursor != null`, it calls **loadMore()**, which fetches `GET /api/lessons?level=...&cursor=nextCursor` and appends the result to `lessons`. `loadingMoreRef` prevents overlapping requests. Each slide is `h-screen snap-start` inside a scroll container with `snap-y snap-mandatory`.

### How lessons are fetched
- **Client:** `fetch(\`/api/lessons?${params}\`)` with `level` and optional `cursor`. **Server:** `getCombinedLessons()` (from `lessons.json` or `sampleLessons`) → `filterLessonsByLevel(combined, level)` → `filtered.slice(cursor, cursor + BATCH_SIZE)` (BATCH_SIZE = 10). Response: `{ lessons, nextCursor }`. Level change resets feed (new fetch with cursor 0).

### How the active video is determined
- **Active slide index:** In **handleScroll**, `currentIndex = Math.round(scrollTop / slideHeight)` (clamped to 0..length-1). Used for progress dots and could be used for analytics.
- **Which video actually plays:** **VideoSlide** uses an **IntersectionObserver** (root = scroll container, threshold 0.5). When a slide’s root intersection passes the threshold, that slide’s `isVisible` is true and it calls `video.play()`; when it leaves, it calls `video.pause()` and `video.currentTime = 0`. So the “active” video is the one currently intersecting the viewport (one-at-a-time play).

### How autoplay works
- **No `autoPlay` attribute** on `<video>`. Autoplay is **behavior-driven:** when the slide becomes visible (IntersectionObserver), the code calls `video.play()`. Video is **muted** in the DOM to satisfy browser autoplay policies. So: scroll to a slide → observer fires → that slide’s video plays (muted). Scroll away → pause and reset.

### How mute/unmute works
- **VideoSlide** state: `isMuted` (default true). **`<video>`** has **`muted`** attribute (always muted in markup for autoplay).
- **handleVideoClick** and **handleSoundClick** toggle `video.muted` and `setIsMuted(video.muted)`. So user can unmute via the side button or by clicking the video. There is no “unmute after first interaction” logic in the current snapshot; sound is toggled manually only.

---

## 3. Video Infrastructure

### Where videos are stored
- **Cloudflare R2** public bucket. Base URL: `https://pub-f15ee3d0e2ea44a6ab6b5985df74d4a5.r2.dev`. Files referenced in code: e.g. `video.mp4`, `carolina-lesson.mp4`.

### How video URLs are generated
- In **sample-lessons.ts**, `r2VideoUrl(filename)` returns `R2_PUBLIC_BASE + "/" + filename`. Every lesson’s `videoUrl` is set that way (e.g. `r2VideoUrl("video.mp4")`).

### How videos are delivered to the frontend
- **Direct:** `<video src={lesson.videoUrl}>` so the browser requests the R2 URL directly. No app proxy, no signed URLs in the current code. R2 bucket is public.

### How the player component works
- **VideoSlide** renders one `<video>` per lesson: `ref={videoRef}`, `src={lesson.videoUrl}`, `playsInline`, `muted`, `loop`, `controls`, `preload="metadata"`, `className="h-full w-full object-cover"`. Play/pause is driven by IntersectionObserver; mute/unmute by click handlers that set `video.muted`. No custom controls UI beyond the native control bar; side buttons (level, like, save, sound) are separate.

---

## 4. Subtitle System

### How subtitles are generated
- **Server-side only** in **`src/lib/generateSubtitlesForVideo.ts`**. For a given video filename: (1) Check if `public/subtitles/<name>.json` exists and has non-empty `segments` → if yes, return (cache). (2) Fetch the video from R2, write to a temp file under `node_modules/.cache/`. (3) Call **OpenAI Whisper** `audio.transcriptions.create` with `model: "whisper-1"`, `response_format: "verbose_json"`. (4) Map segments to `{ id, start, end, text }`, write to `public/subtitles/<name>.json`. (5) Delete temp file.

### When Whisper is called
- **Automatically:** On **every `GET /api/lessons`** request, the handler iterates over all lessons from `getCombinedLessons()`, extracts unique video filenames, and for each where `needsSubtitleGeneration(filename)` is true and the filename is not already in the in-memory `generating` set, it calls `generateSubtitlesForVideo(filename)` in the background (fire-and-forget). So the first few requests after adding a new video (or missing subtitle file) can trigger Whisper. **Manually:** `npx tsx scripts/generateSubtitles.ts <filename>`.

### Where subtitles are stored
- **Static files:** `public/subtitles/<video-name>.json` (e.g. `video.json`, `carolina-lesson.json`). Format: `{ "segments": [ { "id", "start", "end", "text" }, ... ] }`. Served by Next.js as static assets (e.g. `/subtitles/video.json`).

### How they are loaded by the player
- **VideoSlide** has an effect keyed by `lesson.subtitlesUrl`. If present, it fetches `lesson.subtitlesUrl` (e.g. `/subtitles/video.json`), parses JSON, converts segments to word-level timings (evenly splitting segment duration across words), and stores in `wordLevelSegments`. A **timeupdate** listener on the video maps `currentTime` to the active word and segment; the UI shows the current phrase as clickable words and highlights the active word. Clicking a word opens the word popup (definition, synonyms, save, clip, pronunciation). If `lesson.subtitlesUrl` is missing or fetch fails, `wordLevelSegments` stays empty and no subtitles are shown.

### Whether subtitle generation costs money
- **Yes.** **OpenAI Whisper** is a paid API (per minute of audio). Each new video (or each time the subtitle file is missing/empty) triggers one Whisper request. After the file is written, generation is skipped (cache), so cost is per video per “first generation” only. Download from R2 and disk I/O are not paid per request in the same way, but R2 and hosting have their own costs.

---

## 5. Lesson Data Model

- **id:** string (e.g. `"1"`, `"2"`).
- **title:** string.
- **description:** string.
- **videoUrl:** string – full URL to the video (e.g. R2).
- **level:** `EnglishLevel` – `"beginner"` | `"intermediate"` | `"advanced"`.
- **durationSeconds:** number.
- **vocabulary:** optional array of **VocabularyItem** – `{ word, meaning, example? }`. Used in the description for clickable vocab and in the word popup when tapping a vocab word in the description.
- **subtitlesUrl:** optional string – path to subtitle JSON (e.g. `/subtitles/video.json`). Derived from video filename in sample-lessons via `subtitlesUrlForVideo(filename)`.
- **tags:** **Not present** in the type or in sample-lessons. No hashtags or tag-based filtering in the codebase.

---

## 6. Current Implemented Features

| Feature | Status | Notes |
|--------|--------|--------|
| **Vertical video feed** | ✅ Implemented | Full-height slides, snap scroll, one video per slide. |
| **Autoplay** | ✅ Implemented | Via IntersectionObserver when slide is visible; muted for policy. |
| **Infinite scroll** | ✅ Implemented | Cursor-based pagination, load more near end of list. |
| **Subtitle rendering** | ✅ Implemented | Per-lesson JSON, word-level highlight, clickable words. |
| **Vocabulary extraction** | ⚠️ Partial | Lesson-level `vocabulary` array (manual/curated). No AI “extract from video” in feed. |
| **Practice button** | ❌ Not implemented | No practice or exercise flow in the feed or slide. |
| **Pronunciation scoring** | ⚠️ Partial | Browser SpeechRecognition; binary “Good” / “Try again”. No numeric score or server-side scoring. |
| **Like system** | ⚠️ UI only | Like button and local state; not persisted, no backend. |
| **Save system** | ⚠️ Partial | “Save” in feed is local state. “Save word” in popup persists to localStorage (vocab). “Clip sentence” saves to localStorage (clips). No server save. |
| **Comments** | ❌ Not implemented | No comment UI or API. |
| **User accounts** | ❌ Not implemented | No auth, no profiles, no server-side user. |
| **AI level adaptation** | ❌ Not implemented | Level is a manual filter only; no adaptive algorithm. |

---

## 7. Missing Core Features

- **For You algorithm:** Not built. Feed order is deterministic (filter by level, then slice by cursor). No ranking, no personalization.
- **Level adaptation:** Not built. No tracking of user level over time; no automatic adjustment of difficulty.
- **AI vocabulary extraction:** Not built. Vocabulary is fixed per lesson in data. No “extract key words from this video” API or button.
- **Pronunciation scoring:** Only binary match. No numeric score, no server-side ASR or scoring pipeline.
- **Practice exercises:** Not built. No post-lesson or in-feed practice (e.g. fill-in, multiple choice, speak-and-score).
- **User profiles:** Not built. Profile route is a placeholder. No account, no preferences, no history.
- **Content creator uploads:** Not built. Upload in nav is disabled placeholder. No upload API or creator flow.
- **Teacher accounts:** Not built. No roles, no “Tutors” vs “Peers” content distinction.
- **Feed ranking system:** Not built. No scoring, no diversity, no “For You” logic.
- **Analytics tracking:** Not built. No events API, no watch time, no likes/saves sent to server, no analytics pipeline.

---

## 8. Performance Risks

- **Subtitle generation on every lessons request:** Triggering `generateSubtitlesForVideo` for missing files on **every** `GET /api/lessons` can cause many concurrent Whisper calls and R2 downloads if many lessons lack subtitles. In-memory `generating` set only prevents duplicate in-flight per filename within the same process; under load, multiple processes or serverless instances can still duplicate work. **Recommendation:** Queue or job-based generation, or at least trigger only when a specific lesson is first requested (e.g. by lesson id).
- **No rate limiting:** API routes have no rate limiting; abuse or heavy traffic could spike OpenAI and R2 usage.
- **Large lesson list in memory:** `getCombinedLessons()` loads the full combined list (sample-lessons or lessons.json) on every request. Fine for hundreds of lessons; for thousands, consider moving to a DB and filtering/paginating in the data layer.
- **Video delivery:** Direct R2 URLs scale with R2/CDN, but if the bucket or URLs change, every lesson’s `videoUrl` must be updated. No abstraction layer (e.g. by id) for video URLs.
- **Client-side subtitle fetch per slide:** Each VideoSlide fetches `lesson.subtitlesUrl` when it mounts. No shared cache across slides; revisiting the same lesson refetches. Consider client-side cache (e.g. by URL) to avoid repeated requests.
- **Single feed type:** One feed; no separation of “For You” vs “Following” vs “Courses”. Adding multiple feed types later may require larger refactors if the current design is too coupled to a single list.

---

## 9. Recommended Next 5 Engineering Priorities

1. **Events / analytics pipeline (minimal)**  
   Add a single **`POST /api/events`** (or similar) that accepts `{ type, lessonId?, payload? }` (e.g. watch_time, complete, like, save, pronunciation_result) and logs to a store or analytics provider. No need to read back for MVP; this unblocks future ranking and level adaptation.

2. **Persist like/save and wire to feed**  
   Persist “liked” and “saved” (e.g. in localStorage keyed by lesson id, or later in DB). Optionally surface “Saved” in nav and filter feed by “saved” or “liked” so the product feels consistent and the data is ready for a future “For You” signal.

3. **Lesson tags and tag filter**  
   Add optional `tags: string[]` to the lesson model and to sample-lessons (e.g. `#vowels`, `#idioms`). Display tags on the slide. Optionally add a simple tag filter (e.g. query param or small filter UI) so content is discoverable by topic and the data model supports future ranking.

4. **Simple “For You” ordering**  
   In `GET /api/lessons`, support an optional `sort=for_you` (or default to it). Implement a minimal heuristic: e.g. interleave by level, or randomize within level, or use a simple diversity rule. Later this can be replaced with a real recommender fed by events.

5. **Pronunciation score and event**  
   In the pronunciation flow, compute a simple score (e.g. 0–100 from edit distance or confidence) and send it to the events API. Keeps the current UX but adds a numeric signal for adaptation and analytics without a full server-side ASR pipeline yet.

---

*End of audit. No code was modified.*
