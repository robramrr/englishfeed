# EnglishFeed → Englishfully: Codebase Analysis & MVP Roadmap

**Role:** Senior startup CTO / product architect  
**Product:** Englishfully — TikTok-style English learning feed (EnglishFeed)  
**Target:** Kids to young adults; MVP then scalable social learning platform.

---

## 1. What’s Already Implemented

### Feed & playback (core)

| Feature | Status | Location |
|--------|--------|----------|
| Vertical full-screen video feed | ✅ | `VideoFeed.tsx` — scroll snap, one slide per lesson |
| Infinite batch loading | ✅ | `VideoFeed` fetches `/api/lessons` with `level` + `cursor`, appends on scroll-near-end |
| Level filter (Easy / Medium / Hard) | ✅ | `ClientOnlyFeed` state → `VideoSlide` level popover (🎚️) |
| Single global subtitles overlay | ✅ | `VideoSlide` loads `/subtitles/subtitles.json`, word-level timings, clickable words |
| Word popup on subtitle click | ✅ | Dictionary + `/api/context-definition` (GPT) for in-context definition, synonyms, examples |
| Clip sentence + share | ✅ | `saveClip()` in popup; clips page with play-from-timestamp and Web Share |
| Like / Save (UI only) | ✅ | Right-side buttons; state is local (not persisted or sent to backend) |
| Mute / unmute | ✅ | Per-slide; tap video or side button |
| Progress dots | ✅ | Right side; jump to slide by index |
| Deep link to video + time | ✅ | `?video=<id>&t=<seconds>`; feed scrolls and seeks |

### Vocabulary & review

| Feature | Status | Location |
|--------|--------|----------|
| Save word to “My vocabulary” | ✅ | Word popup → Save Word → `vocabStorage` (localStorage) |
| My vocabulary page | ✅ | `/vocabulary` — list, remove |
| Vocabulary review (flashcards) | ✅ | `/review` — reveal meaning, “I knew it” / “I didn’t know it”, pronunciation check |
| Progress / mastery | ✅ | `/progress` — words saved, reviewed, known, difficult, mastery %, “words to review more” |
| Thai translation in review & popup | ✅ | `/api/translate-thai` (OpenAI); optional L1 support |

### AI integrations

| Feature | Status | Location |
|--------|--------|----------|
| Context-aware definition | ✅ | `/api/context-definition` — word + sentence + definitions → GPT → context definition, synonyms, examples |
| Thai translation | ✅ | `/api/translate-thai` — word/definition/example → Thai |
| Pronunciation check | ✅ | Browser `SpeechRecognition`; match vs target word; “Good pronunciation” / “Try again” (no numeric score) |

### Content pipeline (scripts)

| Feature | Status | Location |
|--------|--------|----------|
| Transcribe video | ✅ | `scripts/transcribeVideo.ts` |
| Generate subtitles JSON | ✅ | `scripts/generateSubtitles.ts` |
| Extract vocabulary | ✅ | `scripts/extractVocabulary.ts` (AI) |
| Build lesson JSON | ✅ | `scripts/buildLesson.ts` — subtitles + vocab → `lessons.json` |

### Data & API

| Feature | Status | Location |
|--------|--------|----------|
| Lessons API (paginated) | ✅ | `GET /api/lessons?level=&cursor=` — batch 10, same source as legacy (lessons.json / sample-lessons) |
| Lesson type & level | ✅ | `Lesson` in `types/lesson.ts`; `filterLessonsByLevel` in `lib/lessonFilter.ts` |
| All user data client-only | ✅ | localStorage: vocab (`vocabStorage`), clips (`clipStorage`); no DB, no auth |

---

## 2. Partially Implemented

| Area | What exists | What’s missing |
|------|--------------|----------------|
| **Like / Save** | UI and local state | Persistence, sync, “Saved” page, effect on recommendations |
| **Pronunciation** | Listen → match / no-match | Numeric score, sentence-level practice, storage for analytics |
| **Subtitles** | One global `subtitles.json` | Per-lesson subtitles (e.g. by `lesson.id` or video URL); breaks with many lessons |
| **Content types** | All lessons look the same (title, description, vocab) | No tags, no content-type (vocab vs pronunciation vs grammar), no mixing logic |
| **Recommendation** | Level filter only (beginner / intermediate / advanced) | No “For You”, no watch time, no replays, no likes/saves in algorithm |
| **Navigation** | Links from word popup to Vocabulary / Clips; “Back” on sub-pages | No global nav; no bottom bar; no Peers / Tutors / For You tabs |
| **Creator / profile** | None | No creator avatar, no profile link, no “from teacher” vs “from peer” |

---

## 3. Important Core Features Missing (vs vision)

- **Top navigation:** Peers / Tutors / For You (only one feed today; no tabs).
- **Bottom navigation:** Home, Course modules, AI Tutor, Upload (future), Inbox, Profile.
- **Comment:** No comment UI or backend.
- **Share (video):** Share clip exists; no “share this lesson” from feed.
- **Practice (AI):** No post-lesson AI practice based on video.
- **Vocabulary (AI from video):** Vocab is lesson-defined; no “AI extracts key words from this video” in feed.
- **Lesson tagging:** No hashtags (#vowels, #idioms); no tags in `Lesson` or API.
- **Level tracking:** Level is a filter only; no per-user level or progress over time.
- **User analytics:** No watch time, replays, quiz success, or pronunciation accuracy stored or used.
- **Adaptive feed:** Feed does not adjust by behavior; only by manual level filter.
- **Database & auth:** No users, no server-side persistence (only localStorage and static/API lesson source).
- **Course modules:** No structured “course” or modules; only flat feed.

---

## 4. Current Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (Next.js 16, React 19, App Router, Tailwind)          │
├─────────────────────────────────────────────────────────────────┤
│  page.tsx → ClientOnlyFeed (level state) → VideoFeed            │
│    VideoFeed: fetch /api/lessons (level, cursor), scroll,       │
│               load more near end, progress dots                  │
│    VideoSlide: video, subtitles (single JSON), word popup,      │
│                 level/like/save/mute, links to /vocabulary,/clips│
│  Other routes: /vocabulary, /review, /progress, /clips           │
│  No global nav or bottom bar                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  API (Next.js Route Handlers)                                    │
├─────────────────────────────────────────────────────────────────┤
│  GET  /api/lessons?level=&cursor=  → lessons.json | sample-lessons, filter, paginate
│  POST /api/context-definition      → OpenAI (context definition)
│  POST /api/translate-thai          → OpenAI (Thai translation)   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Data                                                            │
├─────────────────────────────────────────────────────────────────┤
│  • Lessons: src/data/lessons.json (or sample-lessons.ts)          │
│  • Subtitles: public/subtitles/subtitles.json (single file)      │
│  • User: localStorage only (vocab, clips); no DB, no auth       │
└─────────────────────────────────────────────────────────────────┘
```

- **Frontend:** Single full-screen feed; secondary pages for vocab, review, progress, clips; no routing shell (tabs/nav).
- **Backend:** Serverless API routes only; no dedicated backend service.
- **APIs:** Lessons (read, paginated), context-definition (OpenAI), translate-thai (OpenAI).
- **Database:** None.
- **AI:** OpenAI for context definition and Thai translation; browser SpeechRecognition for pronunciation (no server-side scoring).

---

## 5. Structural & Scalability Issues

1. **Single subtitle file**  
   All slides use `/subtitles/subtitles.json`. With many lessons, you need per-lesson subtitles (e.g. by `lesson.id` or a stable key) and a contract (e.g. `GET /api/lessons/:id/subtitles` or static path per lesson).

2. **Lesson source in API**  
   `/api/lessons` reads from in-repo JSON/TS. For scale you’ll want a DB or CMS and possibly an admin pipeline; the current pagination contract (`cursor`, `nextCursor`) is fine to keep.

3. **No user or session**  
   Like/save, progress, and analytics can’t be persisted or personalized until you add auth and a user store (DB or BaaS).

4. **Like/Save not persisted**  
   They’re local state only; refreshing loses them. Either persist in localStorage with a clear schema or move to backend once users exist.

5. **Recommendation = level only**  
   “For You” and adaptive difficulty need: event store (watch time, replays, likes, saves, quiz/pronunciation results), level/progress model, and a recommendation service that consumes them.

6. **VideoSlide size**  
   One large component (video, subtitles, word popup, modals, side buttons). Splitting into smaller components (e.g. SubtitleOverlay, WordPopup, SideActions) will make nav/comment/practice easier to add.

7. **No error boundaries or loading states**  
   API failures or missing subtitles could leave a bad UX; add error boundaries and per-slide/feed loading/retry where it matters.

8. **Hardcoded dictionary**  
   Word lookup uses `api.dictionaryapi.dev` + context-definition. Fine for MVP; later you may want caching, fallbacks, or your own vocab API.

---

## 6. Suggested Technical Architecture (for scale)

Keep the current stack for MVP, but shape it so you can grow:

- **Frontend:** Next.js App Router, keep feed + pages; add a single **app shell** (e.g. bottom nav + optional top tabs) that wraps feed and other sections. Use a small **state layer** (e.g. React context or Zustand) for: level, “saved”/“liked” (until backend), and later user/session.
- **API:** Keep Route Handlers; add:
  - `GET /api/lessons` (already done; later can read from DB).
  - Optional: `GET /api/lessons/:id/subtitles` for per-lesson subtitles.
  - Later: auth (NextAuth or BaaS), then endpoints for likes, saves, watch events, progress.
- **Data:**
  - **MVP:** Keep lessons from JSON/API; add per-lesson subtitle resolution; keep user data in localStorage.
  - **Post-MVP:** Add DB (e.g. Postgres + Prisma or Supabase) for users, lessons metadata, likes, saves, events; store subtitles in DB or object store (keyed by lesson).
- **AI:** Keep OpenAI for context-definition and translate-thai; add:
  - Optional vocabulary-from-video (e.g. from transcript) for “📘 Vocabulary” in feed.
  - Practice (e.g. short quiz or dialogue) from lesson content.
  - Later: recommendation service that uses events + level.
- **Analytics:** Add a minimal **client event API** (e.g. `POST /api/events` with type: watch_time, replay, like, save, pronunciation_result) and log to DB or analytics provider; don’t block MVP on full pipeline.

---

## 7. Prioritized MVP Build Order

Ordered so the app feels complete and shippable quickly, then adds differentiation and scale.

### Phase 1 — Shipable feed (no new backend)

1. **App shell & navigation**
   - Add a **bottom nav** (Home = feed, Vocabulary, Review/Progress, Clips, Profile placeholder).
   - Optional: **top tabs** (e.g. “For You” only for now; label so “Peers”/“Tutors” can be added later).
   - Ensure feed remains the default; deep links still work.

2. **Per-lesson subtitles**
   - Define contract: e.g. `public/subtitles/<lessonId>.json` or `GET /api/lessons/:id/subtitles`.
   - In `VideoSlide`, load subtitles by `lesson.id` (fallback to current global file for existing content).
   - Unblocks many lessons without one shared subtitle file.

3. **Lesson tagging (data only)**
   - Add optional `tags: string[]` (e.g. `#vowels`, `#idioms`) to `Lesson` and to lessons.json/API.
   - Display tags under title/description (no “filter by tag” required for MVP).

4. **Persist Like/Save in localStorage**
   - Schema keyed by `lessonId` (and optionally user id when you have it).
   - On load, restore like/save state so it survives refresh; same for “saved lessons” list if you add a Saved page.

5. **Share lesson (simple)**
   - Add “Share” in the right-side actions: share current lesson URL (and optional clip params if you want to keep clip sharing as is).

### Phase 2 — Recommendation & level (minimal backend)

6. **Analytics / events (client → API)**
   - Add `POST /api/events` (or `/api/analytics`) with body: `{ type, lessonId?, payload? }` for watch_time, replay, like, save, pronunciation_result.
   - Store in DB or append to log/analytics provider; no need to read back in MVP.

7. **Level tracking**
   - Derive “current level” from progress (e.g. review mastery, pronunciation success) or keep manual for MVP.
   - Use it to default the level filter and, later, to drive “For You” ordering.

8. **Basic “For You” ordering**
   - In `GET /api/lessons`, optionally accept `sort=for_you` and a simple heuristic: e.g. mix by level, then by tag or recency; later replace with real recommendation using events.

### Phase 3 — AI features (differentiation)

9. **Vocabulary from video (📘)**
   - In feed, “Vocabulary” button opens a list: either lesson.vocabulary or AI-extracted terms from transcript (existing script or small API that returns words for a lesson). Reuse existing word popup / save flow.

10. **Pronunciation scoring**
    - Keep current match/no-match; add a simple numeric score (e.g. 0–100 from edit distance or confidence if you switch to a server-side ASR later). Send result to events API for analytics.

11. **Practice (AI)**
    - After watching (or from a “Practice” button): short AI-generated practice (e.g. “complete the sentence”, “choose the right word”) from lesson title/description/transcript. One new API + one simple modal or slide.

### Phase 4 — Social & scale (post-MVP)

12. **Comments (optional for MVP)**
    - Comments backend (per lesson) + comment count + simple comment list in a drawer/modal. Can be deferred.

13. **Creator / profile**
    - Add `creatorId` / `creatorName` (and optional avatar URL) to `Lesson`; show avatar and link to profile page (profile = list of lessons by that creator). No “follow” needed for MVP.

14. **Peers / Tutors tabs**
    - Once you have creators: “Tutors” = lessons where creator is a teacher; “Peers” = UGC or peers. Filter or separate feeds by source.

15. **Database & auth**
    - Migrate lessons metadata (and optionally subtitles references) to DB; add auth; migrate likes, saves, progress, events to DB; then plug recommendation and level tracking into real data.

---

## 8. Summary Table: MVP vs Now

| Requirement (from brief) | Now | MVP target |
|---------------------------|-----|------------|
| Vertical video player | ✅ | ✅ |
| Infinite swipe feed | ✅ | ✅ |
| Lesson tagging | ❌ | ✅ Phase 1 |
| Level tracking | Filter only | ✅ Phase 2 (simple) |
| Basic recommendation | ❌ | ✅ Phase 2 (ordering) |
| Vocabulary extraction | Lesson-defined | ✅ Phase 3 (AI from video optional) |
| Pronunciation scoring | Match only | ✅ Phase 3 (numeric + events) |
| User analytics | ❌ | ✅ Phase 2 (events API) |
| Top nav (Peers/Tutors/For You) | ❌ | Top tab(s) Phase 1, full Phase 4 |
| Bottom nav | ❌ | ✅ Phase 1 |
| Comment | ❌ | Phase 4 |
| Share | Clips only | ✅ Phase 1 (lesson share) |
| Practice (AI) | ❌ | ✅ Phase 3 |
| Creator / profile | ❌ | Phase 4 |

---

**Next engineering priorities (immediate):**

1. Add **app shell + bottom nav** so Vocabulary, Review, Progress, Clips are one tap away and the product feels like an app.  
2. Introduce **per-lesson subtitles** and load by `lesson.id` so the feed is ready for many lessons.  
3. Add **tags** to the lesson model and display them; persist **like/save** in localStorage.  
4. Add **events API** and start sending watch_time / like / save so you can later plug in recommendations and level tracking without re-architecting.

This keeps the current UI and behavior intact while preparing for a scalable, social, AI-driven English learning MVP.
