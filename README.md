# DevPREP

A little practice. A stronger interview. DevPREP is a local-first interview preparation app for software engineers, built with React, TypeScript, and Vite.

## What's inside

| Screen | Purpose |
| --- | --- |
| **Home** (`#home`) | Target role, interview countdown, today's plan (next lesson + due reviews), XP/streak |
| **Tracks** (`#tracks`) | Your selected path, or all curriculum by track |
| **Practice** (`#practice`) | Due spaced reviews (badge shows the count) and practice tools |
| **Code runner** (`#code`, `#code/<problem-id>`) | Runnable DSA problems in JavaScript or Python with visible and hidden tests |
| **SQL problems** (`#sql`, `#sql/<problem-id>`) | Interview SQL problems on in-browser Postgres with visible and hidden tests |
| **System design** (`#design`, `#design/<case-id>`) | 20 timed case studies with framework notes, a whiteboard, model answers and a rubric |
| **Field Guide** (`#guide`, `#guide/<id>`, `#antipatterns`) | Best-practice guides, real-world case studies and an anti-pattern gallery, each with diagrams, a checklist and a quiz |
| **Whiteboard** (`#board`) | A free diagram board saved on this device |
| **Flashcards** (`#cards`) | Spaced-repetition concept cards across all tracks, plus a recall card per coding and SQL problem |
| **Mock interviews** (`#mock`) | Timed mocks per track with model answers and rubric self-scoring |
| **Story bank** (`#stories`) | STAR stories mapped to 10 behavioral competencies |
| **Study plan** (`#plan`) | Day-by-day plan up to your interview date |
| **Progress** (`#progress`) | Per-track and per-pattern completion, streak and freezes, badges, weak areas |
| **Settings** (`#settings`) | Target role, interview date, focus tracks, appearance, About your data (backup/import), welcome tour |
| **Study** (`#study`) | Chunked lesson → warm-up/core/stretch practice → explanation & confidence → scheduled review |

Old links still work: `#today` → Home, `#roadmap` → Tracks, `#review` → Practice. "App & offline" (install, offline status, updates) sits at the bottom of every page.

## The study loop

- **60 original lessons**: 19 DSA, 10 system design, 14 ML, 9 AI/LLM and 8 behavioral, ordered by prerequisites.
- Chunked reading, **warm-up → core → stretch** practice with progressive hints, worked answers and rubrics. Only the core task drives completion and review scheduling.
- Resumable sessions: step, reading section, answer, hints, solution visibility and checklist are saved as you work.
- Spaced reviews from your own confidence: first review after **1 / 3 / 7 days** (Needs practice / Getting there / Confident); later intervals reset to 1, ×1.5 or ×2, capped at 60 days.
- Optional **Software Engineer** / **Senior Software Engineer** paths, chosen once as **Target role** in Settings.

## Code runner

**110 original problems** across 16 patterns: arrays & hashing, two pointers, sliding window, stack, binary search, linked lists, trees, tries, heaps, graphs, backtracking, dynamic programming, greedy, intervals, bit manipulation, and a senior **design & concurrency** set (caches, rate limiters, iterators, simulated concurrency). Each pattern mixes Easy, Medium and Hard problems (`warm-up`/`core`/`stretch` in the data), tagged SE or SSE and linked to lessons where one fits. Each has a prompt, examples, progressive hints, a JS and Python solution with explanation, Big-O notes and follow-ups. Lesson pseudocode stays as it was; the runner sits alongside it.

- Filter the list by pattern (with solved/total per pattern), difficulty and level. With a Target role set, **SE core** / **SSE core** tags mark the problems that role should cover first, and a toggle shows only those.
- Problems feed the rest of the app: each one adds a recall card (`dsa-p-<id>`: pattern, key idea, target cost) to the DSA flashcard deck; DSA mocks draw from them by level; the study plan schedules path-core problems first, then the least-practised patterns, easiest first.

- Code runs **on your device** in a Web Worker: JavaScript is stopped after 5 s, Python after 10 s (the worker is terminated, so infinite loops can't freeze the page).
- Python uses **Pyodide** (WebAssembly CPython). It is fetched only on the first Python run (about 13 MB), then cached by the service worker for offline use. JavaScript works offline straight away.
- Visible tests show expected vs actual; hidden tests report only pass counts. `console.log`/`print` output is shown.
- Drafts are saved per problem and language in `devprep.code.v1` (20,000 characters each). They are not part of backups.
- **Code editor** (Settings → Code editor): **Rich** (CodeMirror 6: highlighting for Python, JavaScript/TypeScript and SQL, line numbers, bracket matching, auto-closing brackets, autocomplete, undo history) or **Plain** (the original textarea). Rich is loaded only on code screens and precached for offline use; if it can't load, Plain is used automatically. In both, Tab indents and **Esc, then Tab** leaves the editor. **Interview mode** (in Settings or the toggle under the editor) turns off autocomplete and auto-closing brackets to feel like a plain interview pad. Both choices are saved in the backup as `editor` (`{ "kind": "plain", "interview": true }`); only non-default values are written, and backups without it use Rich with interview mode off.
- Passing every test records a first-solve time per language in the backup (`solved`), worth 15 XP, plus 5 XP for the second language. Badges: Green tests, Bilingual, Pattern spotter (15), Half-century (50), Full toolkit (one in every pattern), Every problem, and a "<Pattern> cleared" badge per pattern.

## System design practice

**20 original case studies** (12 SE, 8 SSE): URL shortener, notifications, web crawler, typeahead, ticket booking, leaderboard, photo sharing, nearby places, rate limiter, chat, news feed, ride hailing, payments, video streaming, key-value store, file sync, metrics, job scheduler, collaborative editor and ad-click aggregation.

- Each follows one **8-step framework** (requirements, estimation, API, data model, high-level design, deep dives, bottlenecks, trade-offs), roughly 45 minutes in total.
- **Timed mode**: start, pause and resume a countdown. Screen readers hear a notice at 5 minutes left and at time up.
- **Whiteboard**: add, rename, drag and connect components with labelled arrows. It works by keyboard too (arrow keys move, Delete removes) and has a text description.
- **Review** puts your notes beside the model answer and model diagram. You then self-score each rubric item as Missed, Partly or Covered. SSE items count on SSE cases or for the Senior role; otherwise they show as stretch goals.
- Notes, boards and timers are saved per case in `devprep.design.v1` and are not part of backups. Saving a score records the best percentage (`designs`): 25 XP per case, plus 10 at 80% or more. Badges: Architect, Blueprint pro, Staff-ready.

## Field Guide

Best-practice **guides** (API design, system design, algorithm practice, code quality, testing, security, databases, ML and LLM apps in production), **real-world case studies** paraphrased from public engineering blogs and postmortems with cited sources, and an **anti-pattern gallery** (`#antipatterns`) with bad and better side by side. Filter by topic, level (SE/SSE) and type.

- Every guide follows one template: principle → why it matters → how it works (diagrams) → good vs bad → checklist → anti-patterns → how to show this in an interview → quiz → practice question → related lessons, problems and design cases. Case studies cover the problem, constraints, decisions and trade-offs, what went wrong, interview lessons, caveats and sources.
- **Diagrams** are original inline SVG drawn from data (`flow`, `sequence`, `compare`, `chart`, `bars`, `timeline`). They use theme tokens, so they follow every palette, dark mode and forced colours. Each has a title, an accessible name, a caption and a text description. Request flows have a **step-through** (Previous/Next, plus Play unless reduced motion is on). On narrow screens a figure scrolls sideways instead of shrinking its text. No runtime CDN: everything is bundled and precached for offline use.
- Each case study was fact-checked against its cited sources by a separate review pass before merge. Details the sources don't state are left out or worded cautiously.
- Finishing a quiz marks the entry read (`guides` in the backup): 15 XP, plus 5 for 100%. Quiz questions also become flashcards in the matching track's deck (`<track>-fg-<entry>-<n>`). Badges: Field notes, Well read (10 entries), Postmortem reader (3 case studies), Sharp eye (5 perfect quizzes) and one per finished topic.
- The study plan adds an unread entry every third day (focus and weak tracks first); technical mocks add one practice question from a guide on that track.

## Language tracks

Interview-focused **Python**, **TypeScript** and **SQL & Postgres** lessons, listed under **Languages** on the Tracks page. They are optional: a language joins your study plan once you start one of its lessons, take its placement check or pick it as a focus track.

- Python core: names, types and functions; strings; sequences, slicing and comprehensions; dicts, sets and `collections`/`heapq`/`bisect`; sorting with keys; functions, scope and closures; classes and dataclasses; errors and exceptions.
- Python advanced (SE and SSE): iterators and generators; decorators; context managers; type hints and `typing`; modules, imports and pytest-style testing; concurrency (GIL, threads, processes, asyncio, simulated in the browser); performance and memory; gotchas and an interview idioms cheat sheet.
- TypeScript core: scope, hoisting and closures; `this` and prototypes; equality and coercion; the event loop (microtasks vs tasks); promises and async/await; arrays, Maps, Sets and immutability; types vs interfaces, unions and narrowing; generics, `keyof` and utility types.
- TypeScript advanced: discriminated unions, narrowing and exhaustiveness; utility, mapped, conditional and template literal types; modules (ESM vs CJS) and error handling; classes and functional patterns; testing and Node vs browser runtimes; a gotchas and interview-idioms cheat sheet.
- SQL core (PostgreSQL 18): SELECT, ordering and NULL logic; aggregates, GROUP BY and HAVING; every join type including self, semi and anti joins; subqueries, CTEs and recursive CTEs; window functions; set operations and CASE; dates, strings and JSONB; schema design, normalisation and constraints.
- SQL advanced (SSE depth): B-tree, composite, partial, expression and GIN indexes; reading EXPLAIN and EXPLAIN ANALYZE; transactions, isolation levels, anomalies and MVCC; row locks, deadlocks, SKIP LOCKED queues and optimistic concurrency; upserts with ON CONFLICT and MERGE; OFFSET vs keyset pagination. Concurrency is taught with two-session diagrams because PGlite has one connection.
- Each lesson is a normal lesson (same study loop and review) plus a **lab**: several theme-aware diagrams placed in its sections (with step-throughs), runnable warm-up/core/stretch exercises with visible and hidden tests, a **predict-the-output** quiz, an interview tip and links to DSA problems, Field Guide entries and other lessons. Lessons are tagged SE/SSE core.
- Exercises run in the same Web Worker runner as the coding problems (Python via Pyodide). TypeScript is type-checked and transpiled in its own worker by the official `typescript` compiler (strict mode); type errors are listed beside the results but the code still runs. Type-level exercises add **type checks**: assertions (including `@ts-expect-error` lines) compiled after your code that must all hold before the exercise counts as passed. The compiler (about 3 MB compressed) is fetched on the first TypeScript run and cached for offline use. Every reference solution type-checks and passes its tests, every starter fails one (`src/labs.test.ts`), and every predict answer is what the language actually prints.
- SQL runs in real Postgres: **PGlite** (Postgres compiled to WebAssembly) in its own worker, fetched on the first SQL run (about 6 MB compressed) and cached for offline use. Each test case resets the database, runs the exercise schema and the test's seed rows, then your SQL; the last result set is compared with the expected table (column names in order; rows in any order unless the task asks for an order; numbers within a small tolerance). DML/DDL exercises add a **check** query that reads the database afterwards. A run is stopped after 8 seconds. `src/labs.test.ts` runs every SQL solution, starter and predict answer against PGlite in Node.
- A **placement check** per track marks lessons you already know; the plan skips them. Saved as `placements` in the backup.
- Language mocks are a coding task plus up to 4 trivia questions. Each language has 5+ flashcards per lesson. Badges: "<Language> placed" and "<Language> trivia".

### SQL interview problems

**42 original problems** in 6 topics: filtering & joins, aggregation, subqueries & CTEs, window functions, gaps & islands, and data changes & design. Each topic mixes Easy, Medium and Hard, tagged SE or SSE, with SE core / SSE core path tags, and links to the SQL lesson that teaches the technique.

- Each problem has a prompt, an example expected table, the schema and visible test data, progressive hints, a reference query with explanation, Postgres performance notes and follow-ups. Hidden tests cover NULLs, ties, duplicates, empty tables and boundaries.
- Problems run in the same PGlite worker as the SQL lessons, with the same comparison rules. Data-change problems are checked with a query that reads the database afterwards.
- Filter by topic (solved/total per topic), difficulty, level and path core. Drafts are saved per problem in `devprep.code.v1`.
- Passing every test records a first-solve time (`sqlSolved` in the backup), worth 15 XP. Badges: First query, Query crafter (20), SQL marathon (all) and a "SQL <topic> cleared" badge per topic.
- Each problem adds a recall card (`sql-p-<id>`) to the SQL deck. Once the SQL track is in your plan, every third day adds a problem (path core first, then the least-practised topic, easiest first). SQL mocks open with a problem at your level, then trivia.
- `src/sql-problems.test.ts` runs every reference query against every visible and hidden test on PGlite, and checks that every starter fails a visible test.

## Flashcards, mocks, stories and plan

- **Flashcards**: Leitner boxes with intervals of 0/1/3/7/14/30/60 days. Again resets to box 0 and re-queues the card once; Hard keeps it (minimum box 1); Good moves +1; Easy +2. Sessions show due cards first, then up to 10 new ones. Keys: Space/Enter reveals, 1–4 grades. A card counts as mastered from box 4.
- **Mock interviews**: DSA and system design take 45 minutes, ML and AI 40, behavioral 30. Questions come from a seeded pick for SE or SSE: a coding problem or design case plus follow-ups, or three competency prompts. The draft (`devprep.mock.v1`) survives reloads. Review shows your answer beside the model answer and you tick rubric items to get a score.
- **Story bank**: up to 50 STAR stories, each tagged with competencies. Coverage shows gaps, and SSE signals (influence, mentoring, ambiguity, conflict) are highlighted for the Senior role.
- **Study plan**: unfinished lessons (path first, then focus tracks and weak areas), spread at most 3 a day up to the interview date (90 days at most; 7 days without a date). Each day also gets cards plus a problem or case, a weekly mock, mocks on the two days before, and a light interview day.

## Gamification (light)

Derived entirely from saved activity and solves, so old backups get credit automatically.

- **XP**: 20 per lesson, 10 per review, +5 when rated Confident, 15 per solved coding problem (+5 for a second language), 15 per solved SQL problem, 25 per scored design case (+10 at 80%+), 2 per card review, 30 per mock (+10 at 80%+), 15 per Field Guide entry (+5 for a perfect quiz). A level every 200 XP.
- **Streaks** count local study days. A **freeze** is earned every 7 streak days (max 2) and is spent automatically on a missed day.
- **Badges** for milestones (lessons, reviews, confidence, streaks, finished tracks and paths, cards, mocks and the story bank). No lives, no leaderboards.

## Appearance

Settings → Appearance:

- **Mode**: System (default), Light or Dark. `?scoutTheme=light|dark` still overrides for a page load; the topbar button toggles it.
- **Theme**: Blueprint (default), Paper (classic), Sepia, High contrast.
- **Accent**: Red (rose), Blue, Forest green, Purple (default).
- **Font**: Atkinson Hyperlegible (default), Inter, Source Serif, OpenDyslexic (dyslexia-friendly) or your system font. Headings use Space Grotesk and code JetBrains Mono. Fonts are bundled and cached offline.

Mode, theme and font are stored in `devprep.appearance.v1`; the accent in `devprep.accent.v1`; the tour flag in `devprep.tour.v1`. None of these are in progress backups. **Replay welcome tour** is in Settings.

Self-assessment uses prompts and rubrics, not automated grading. No AI at runtime, backend or accounts. Behavioral examples are models for organizing genuine experience, never instructions to invent accomplishments.

## Curriculum coverage

| Track | Learning progression |
| --- | --- |
| Data structures & algorithms | Arrays and hash maps; two pointers and sliding windows; stacks, queues, and linked lists; binary search and sorting; recursion, trees/BSTs, and heaps; graph BFS/DFS and topological ordering; backtracking, greedy reasoning, and dynamic programming |
| System design | Requirements and capacity; APIs/data modeling and databases/indexes; caching; replication/partitioning and consistency; queues/events and rate limiting; reliability/observability; worked end-to-end designs |
| Machine learning | Data preparation/leakage and splitting/evaluation; regression/classification; optimization/regularization and bias/variance; trees/ensembles; neural-network basics; clustering; imbalance/thresholds; deployment and monitoring; ML system design for recommendations, search ranking and fraud; MLOps (feature stores, training/serving skew, CI/CD, A/B tests) |
| AI and LLMs | Transformers and attention; tokenization and embeddings; prompting; RAG (chunking, hybrid retrieval, reranking); fine-tuning and LoRA; evals; agents and tool use; LLM system design (latency, cost, caching, guardrails); responsible AI and safety |
| Behavioral/interview preparation | Truthful structured stories; ownership/impact; conflict; failure/learning; ambiguity/prioritization; collaboration/leadership; project deep dives; communication during technical interviews |

Prerequisite links are advisory and remain within each track. Opening one asks before replacing an unfinished session. Warm-ups reduce problem size or focus on one idea; stretch tasks change assumptions or add constraints. Completing a lesson records your self-assessment, not mastery of every optional challenge.

## SWE and Senior SWE learning paths

Choose a path with **Target role** in Settings. **Compare paths & outcomes** explains the audience and learning goals. No path is selected automatically: new users and old backups without a choice keep the existing curriculum order and all-track roadmap.

| Path | Curated lessons | Emphasis and sequence |
| --- | --- | --- |
| Software Engineer | **29**: 17 DSA, 4 system design, 8 interview | Programming foundations → evidence of contribution → structures/search → algorithm choices → a small service → communication and reflection |
| Senior Software Engineer | **30**: 12 DSA, 10 system design, 8 interview | Requirements/ownership/ambiguity → selected coding refresh → distributed-system tradeoffs → operational ownership and leadership → end-to-end synthesis |

Both paths include every selected lesson's prerequisites earlier in the sequence, rather than assuming prior knowledge is a completed lesson. Shared lessons retain one completion record and count in **both** paths. Their overlap is intentional: communication and leadership lessons form a prerequisite chain, while the Senior path adds broader design work, different sequencing, and three focused discussion extensions.

Senior extensions cover negotiating ambiguous scope, owning an index migration/rollback, and influencing across teams without inventing authority. They appear during practice and reflection on the relevant lessons, with prompts, reasoning rubrics, and a defensible discussion. They are optional: notes share the session notebook, and they do **not** create extra completions, alter the core exercise, or add review dates.

- **Home:** the first unfinished lesson in the selected path is the next recommendation. An unfinished session takes priority, even if it is outside the path. A daily completed lesson from any track still counts as study for that day.
- **Tracks:** switch between **Selected path** (ordered phases and objectives) and **All curriculum** (the original track browser). Browsing all curriculum does not clear your path choice. All 104 lessons remain open; ML, AI/LLM and omitted coding/design topics are optional supplemental study.
- **Progress:** the selected path has its own denominator (29 or 30); overall progress remains out of 60. Both path totals are shown separately. Supplemental work contributes to overall completion, not to a path that omits it.
- **Practice:** the review queue always includes every due completed lesson, including supplemental ML/AI and lessons studied before a path switch. Switching neither filters nor reschedules reviews.
- **Switching or clearing:** changing the selector updates only the path choice. Drafts, reading bookmarks, hints, checklist selections, completion records, and review dates stay intact. Choosing **All curriculum (no path selected)** restores the original recommendation behavior.
- **Path completion:** Home says the path is explored and offers reviews or all-curriculum browsing; it does not silently enroll you in another path or supplemental track.

These are **interview-preparation guides, not certification, level assessments, or readiness guarantees**. The Senior path is focused interview practice, not a complete senior-engineer training program. Adapt behavioral examples truthfully to your own experience; label hypothetical reasoning as hypothetical.

## Accent details

### Accent persistence and recovery

The separate local-storage key **`devprep.accent.v1`** contains one of `red`, `blue`, `forest`, or `purple`. It is an appearance preference, **not part of study-progress JSON exports/imports**. Restoring an old or new progress backup therefore does not change the current accent or require a backup schema change. Like other browser-local data, the preference is specific to the origin and browser profile; changing domains or clearing site data can restore the default.

The small head script applies a valid saved accent before the React application starts. Missing preferences default to purple without writing anything. Invalid or unreadable preferences display purple and surface a visible warning once the UI loads; the stored value is not silently deleted or replaced. Choosing an accent or **Save current accent** changes only the accent key.

If saving fails, the selected accent still applies in the current tab, a warning explains that it is not saved, and **Save current accent** retries. The previous saved value and all study data remain intact. Other tabs pick up the most recently saved accent when reloaded; this preference does not trigger study-progress conflict handling.

### Palette and contrast checks

`src/accents.css` centralizes the purple fallback, four selectable palettes, and contextual `--cp-accent-on-soft` text colors. The explicit red option retains its original fill, hover, soft/highlight, and foreground values. Stronger text ink on tinted dark surfaces, and neutral text on nested badges, avoid low-contrast combinations without recoloring semantic feedback.

Keyboard focus uses a thinner **2px accent outline with a 2px offset**, not a blanket outline removal. Navigation, app menu summaries, and study/filter buttons suppress the browser's default rectangular tap highlight while retaining theme-consistent pressed/selected feedback. Native selects and inputs keep their browser interaction behavior. Chromium touch emulation exposed the default blue tap-highlight property; the transient overlay was not reliably captured in a screenshot, and physical iOS/WebKit behavior has not been verified.

Browser tests exercise all **4 accents × 2 theme modes**, measuring actual CSS colors and alpha-composited surfaces. Targets are **at least 4.5:1** for tested accent text/primary/hover/selected combinations and **3:1** for tested focus/progress combinations. They also inspect rendered states, startup initialization, persistence/errors, keyboard/touch behavior, and domain-root navigation. These are targeted accent checks, not a claim that every aspect of the app has received a full accessibility audit.

Run the focused browser coverage with `npm run test:e2e -- accents.spec.ts` after a production build.

## Install DevPREP and use it offline

Open **App & offline** to see the actual preparation state and installation options. The first successful preparation requires internet; wait for **Offline lessons ready** before relying on offline access. Installing the app and preparing its offline files are separate browser operations.

- **Desktop Chrome/Edge and supported Android browsers:** use **Install DevPREP** when the browser offers that prompt, or use the browser's install icon/menu. A dismissed prompt does not mean installed. An accepted prompt means installation was requested; completion is only reported after the browser's installation event or when running in standalone mode.
- **iPhone/iPad:** open the site in Safari, use **Share → Add to Home Screen**, and follow the OS instructions. Availability varies by browser/OS. If the option is absent, the website remains usable.
- **Other/unsupported browsers:** use a bookmark or the online site. DevPREP cannot force browser installation, and this is not a native app-store package.

After preparation, **all 104 bundled lessons**, their examples/solutions, scripts/styles, and required local assets are cached, including the split curriculum bundle. A cold offline reload can open previously unvisited lessons in any track. Local drafts, reading bookmarks, paths, reviews, and accents continue to work. JSON export/import can also work offline where the browser supports the relevant file actions; it does not add cloud synchronization.

Preparation checks every required file's SHA-256 before caching it and never treats failed/redirected/mismatched downloads as success. If preparation fails or cached files are missing, the panel shows a warning and **Retry offline preparation**. An interrupted or failed update does not discard the prior version's cache. Browser quota limits, private modes, eviction, or cleared site data can make offline data unavailable; offline readiness is checked, not assumed from registration alone.

### Updates after successful deployment

No reinstallation is needed. A successful `main` Pages deployment publishes a new worker and versioned assets; merely merging a PR is not sufficient if its build/deployment fails.

- Online launch checks for updates. Reconnection checks again; returning to a visible app checks with a one-minute throttle; a visible open app also checks about every five minutes.
- A new version's files download and verify automatically. Existing windows keep running without an unsolicited reload.
- **Update ready → Update & reload** is the user-controlled restart. The current notebook is saved/rechecked before activation and again before reload. Storage/conflict/unsaved-preference warnings block this action; resolve them or export work before any manual restart.
- If another window activates an update, this window offers a restart rather than automatically reloading. When all old windows close, the browser can naturally activate the prepared version for the next launch.
- Browsers control service-worker scheduling. A closed or offline app cannot be promised background update delivery. A failed download leaves the working version available.

Each worker serves its version's cached HTML, preventing an old shell from unexpectedly referencing new chunks. Earlier verified build caches are deliberately retained so still-open windows and in-flight old documents can request their original hashed assets even after activation. This conservative policy uses additional storage across releases; browser eviction/quota still applies. The app does not globally clear caches or study storage. Export backups before manually clearing site data, which can remove both offline files and progress.

The web manifest has a stable relative `id`, `start_url`, and `scope`, standalone display, original PNG install/maskable/Apple icons, and neutral launch colors. The worker, manifest, icons, and asset URLs resolve under either the custom-domain root or `/DevPREP/`; caches are namespaced by exact origin/mount and build content. The worker does not cache cross-origin requests or intercept unrelated navigation paths.

### Browser versus installed storage

An installed app may share browser storage, but do not rely on that across browser profiles, platforms, or iOS installation paths. If installed progress is missing, export from the browser that has it and explicitly import into the installed app. Backups include written answers; keep them private. There are no accounts, automatic backups, background notifications, or cross-device sync.

The production-browser tests exercise service-worker installation, complete preparation/failure recovery, offline cold starts, and genuinely different old/new build artifacts. Install-prompt/display-mode tests are browser simulations, **not a claim of native Android/iOS/desktop installation testing**.

## Run locally

Use **Node.js 22.12+** (the CI workflow uses Node 22) and npm.

```powershell
npm ci
npm run dev
```

Open **http://127.0.0.1:5173/**. Vite uses the relative base `./`, so the same production artifact supports both the existing `/DevPREP/` project mount and a custom-domain root.

```powershell
npm test
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
npm run test:pwa
```

The build includes TypeScript checking. The browser tests start an isolated static server on **127.0.0.1:4273**, so run `npm run build` first and keep that port free (or set `$env:PLAYWRIGHT_PORT = '4274'` in PowerShell). Tests never reuse an existing server. The same `dist` bytes are served at `/` and `/DevPREP/`, without an SPA fallback that could conceal missing assets. Tests cover desktop Chromium and mobile-sized Chromium; the mobile project does not claim native Safari validation. On a fresh Linux machine, install browser system dependencies with `npx playwright install --with-deps chromium`.

`npm run preview` serves the built `dist` directory. No environment variables or secrets are required.

Offline service workers are enabled only for production builds, not Vite's development server. `test:pwa` uses a separate loopback server and builds a second release in ignored `dist-pwa-tests` output without overwriting `dist`. `DEVPREP_RELEASE` can label a release; otherwise the UI uses the CI commit identifier or `local`. It contains no user/device identifier.

Install icons are checked in. To reproduce them after editing their original SVG, use `node scripts/generate-pwa-icons.mjs` with the declared Playwright Chromium browser installed.

## Local data and backups

Progress lives under `devprep.progress.v1` in this browser’s local storage. It is not sent to a server. GitHub Pages still serves static files and may log ordinary HTTP requests.

- Clearing site data, private browsing, changing browser profiles, or changing devices can make progress unavailable. There is **no automatic backup or cross-device sync**.
- **Settings → About your data → Export backup** downloads versioned JSON. Import it into another browser to transfer your progress. The file contains completion records, due dates, the current unfinished session (including its answer), the optional path choice, the optional profile (interview date, focus tracks), solved coding problems, best system design scores, flashcard boxes, mock results, Field Guide quiz scores, story bank, and the latest 5,000 activity events. Code drafts and design notes or boards are not included.
- Finishing a session keeps its completion and confidence, **not its answer or checklist**. Export before finishing to keep an unfinished draft. This makes later reviews fresh recall rather than replaying an old answer.
- Import is replacement, not merge. It validates the entire file before asking for confirmation. Cancel leaves existing progress untouched. Unknown schema versions, lesson IDs, fields, enum values, malformed dates, and out-of-range values are rejected. File limit: **1,000,000 bytes**; draft limit: **20,000 characters**.
- A failed save retains the previous persisted data and keeps the latest work in memory with a visible warning, export action, and retry. Do not close the page with unsaved work.
- Unreadable stored data opens a recovery screen without overwriting it. Download the original data, restore a valid backup, or explicitly confirm a fresh start.
- Other-tab changes are detected through storage events and a pre-write snapshot check. Export this tab’s work before reloading the saved version. Use one editing tab at a time: local storage has no cross-tab transactional locking.
- Backups can contain personal notes. Keep them private and avoid sensitive employer or interview information.

### Compatibility with the original curriculum

All 12 published lesson IDs and their core practice contracts remain unchanged: tasks, hint order/count, checklist wording/order/count, starter pseudocode, examples, and core solutions. Existing answers and checked boxes therefore retain their meaning even as new teaching material is added.

The storage key and backup schema version remain **v1**. A validated optional `session.readingSection` bookmark extends the session shape; original exports without it still load unchanged, beginning at the overview when returning to the Learn step. No destructive migration or automatic reset is performed. Old app versions may reject the new optional field; use the updated app when importing a new export.

The optional root field `selectedPath` accepts only `"swe"` or `"senior"`. An absent field means no selected path; clearing the choice removes the field. Unknown values (including `null`) are rejected before import can replace data. Import confirmation states which path the backup will restore. Importing an old backup with no path clears the current choice, as part of the explicitly confirmed replacement, without assigning a level. Old payloads round-trip without newly inserted fields.

The optional root field `profile` holds `interviewDate` (`YYYY-MM-DD`) and `focusTracks` (known track IDs, no duplicates). Empty values are omitted, so backups without it are unchanged.

The optional root field `solved` maps a problem ID to `{ "js"?: ISO time, "py"?: ISO time }`, the first time every test passed in that language. Unknown problem IDs, empty entries, other languages and malformed times are rejected. Like lesson IDs, problem IDs are part of the backup format (`tests/fixtures/problem-ids.json` is append-only).

The optional root field `designs` maps a case ID to `{ "best": 0–100 integer, "at": ISO time }`. Unknown case IDs, extra keys, out-of-range or fractional scores and malformed times are rejected. Case IDs are append-only too (`tests/fixtures/case-ids.json`).

The optional root field `cards` maps a card ID to `{ "box": 0–6, "due": YYYY-MM-DD, "at": ISO time, "reviews": 1–100000 }`. Card IDs are append-only (`tests/fixtures/card-ids.json`). `mocks` is a list of up to 500 `{ "track", "at", "percent": 0–100 integer, "minutes": 0–600 }`. `stories` is a list of up to 50 `{ "id", "title" (≤120), "competencies", "situation"/"task"/"action"/"result" (≤2,000 each), "updatedAt" }`. Unknown IDs, tracks, competencies, keys and duplicate story IDs are rejected.

The optional root field `guides` maps a Field Guide entry ID to `{ "best": 0–100 integer, "at": ISO time }`, the best quiz score. Unknown entry IDs and malformed values are rejected; entry IDs are append-only (`tests/fixtures/guide-ids.json`).

The optional root field `placements` maps a language track ID to `{ "percent": 0–100 integer, "at": ISO time, "known": [lesson IDs of that track] }`. Interview tracks, unknown lessons and lessons from another track are rejected.

The optional root field `sqlSolved` maps a SQL problem ID to the ISO time every test first passed. Unknown IDs and malformed times are rejected; SQL problem IDs are append-only (`tests/fixtures/sql-problem-ids.json`).

Completed lesson counts and review dates are preserved. New lessons increase the roadmap denominator, so your displayed percentage can decrease without any lost completions. Today recommends the first unfinished lesson in the expanded curriculum order unless you explicitly select a curated path.

`tests/fixtures/v1-progress.json` is a real export captured through the original MVP browser UI before the expansion: one completed hash-map lesson and an unfinished two-pointer reflection with draft, both hints revealed, solution visibility, and checked items. Tests load/import/resume/finish it and compare the previous record and review date. Separate fixed fingerprints protect all 12 original core contracts.

Review dates use the device’s local calendar, including daylight-saving changes. They do not send reminders. The app refreshes the current date once per minute while open.

## GitHub Pages deployment

The site is **https://devprep.madebyfavor.com/** (the project URL https://adamsdenniskariuki.github.io/DevPREP/ redirects there). A successful PR build does **not** mean the site is live.

1. In the repository’s **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source. A repository administrator must enable this; it is not enabled by adding a workflow alone.
2. Review and merge the implementation PR into `main`.
3. The **Validate and deploy Pages** workflow installs locked dependencies, runs unit tests, builds, runs desktop/mobile browser tests, and uploads `dist` for Pages.
4. The deploy job runs only for `main` pushes or manual dispatches on `main`, after validation. Approve the `github-pages` environment if the repository requires it.
5. Check the workflow’s deployment URL after the deploy job succeeds.

Pull requests run the same validation but **cannot deploy**. The workflow uses the built-in `GITHUB_TOKEN` and OIDC with job-scoped Pages permissions; no PAT is stored in this project.

All app navigation is hash-based (`#tracks`, `#study`), so refreshing or sharing a route does not need a server rewrite or a custom 404 page. `#study` resumes this browser’s active session; it is not a shared lesson URL.

### Custom domain

The site is served at **https://devprep.madebyfavor.com/**. Pages is configured for that domain, and `public/CNAME` (copied to `dist/CNAME`) matches it.

**DNS (one-time, at the provider for `madebyfavor.com`):** add this record if it is not already present.

| Type | Host/name | Target/value |
| --- | --- | --- |
| CNAME | `devprep` | `adamsdenniskariuki.github.io` |

Use the bare target, with no `https://` or `/DevPREP/`. Check it with `Resolve-DnsName devprep.madebyfavor.com -Type CNAME`, then enable **Enforce HTTPS** in Settings → Pages once the certificate is issued.

**Local storage is origin-scoped.** Progress saved at `https://adamsdenniskariuki.github.io/DevPREP/` is not visible at the custom domain. Export a backup from the old origin and import it at the new one; import replaces rather than merges.

## Code map

| File | Responsibility |
| --- | --- |
| `src/curriculum-types.ts` | Teaching sections, staged exercises, and lesson schema |
| `content/<track>/` | Lesson data: one JSON file per lesson plus `track.json` (title, description, ordered lesson IDs) |
| `content/paths.json` | SWE and Senior SWE path phases and senior prompts |
| `scripts/build-content.mjs` | Aggregates `content/` into `src/generated/curriculum.json` (ignored; runs automatically before dev, build, typecheck and tests) |
| `src/content-schema.ts` | Strict lesson/track schema; `src/content-schema.test.ts` validates every file |
| `src/curriculum.ts` | Loads the generated curriculum |
| `src/content-tests/` | Worked-example and contract tests per track |
| `src/lesson-ids.test.ts`, `tests/fixtures/lesson-ids.json` | Append-only registry of every shipped lesson ID |
| `src/components/LessonReader.tsx`, `src/lesson-sections.ts` | Chunked content navigation and stable reading-section identifiers |
| `src/components/ExtraPractice.tsx` | Optional warm-up/stretch hints, worked answers, and rubrics |
| `src/learning-paths.ts`, `src/learning-paths.test.ts` | Curated path phases, senior extensions, selection/progress helpers, prerequisite and preservation tests |
| `src/components/Path*.tsx` | Ordered path roadmap and senior discussion surfaces |
| `src/components/LessonList.tsx`, `src/format.ts` | Shared lesson rows and review-date formatting for path and all-track views |
| `src/accents.css`, `src/useAccent.ts` | Central accent palettes and visible preference recovery |
| `src/appearance.ts`, `src/useAppearance.ts`, `src/design.css` | Mode/theme/font preferences, palettes, fonts and the design layer |
| `src/gamification.ts` | XP, streaks with freezes, badges and weak areas derived from activity |
| `src/app-model.ts`, `src/components/WelcomeTour.tsx` | Shared screen model and the replayable welcome tour |
| `src/accent-preference.ts`, `src/accent-preference.test.ts`, `tests/accents.spec.ts` | Separate preference contract, startup/error checks, real palette contrast and browser coverage |
| `tests/paths.spec.ts` | Path recommendations, switching, global reviews, shared progress, legacy backups, keyboard and mobile flows |
| `src/sw.ts`, `src/pwa-cache.ts` | Integrity-checked, mount-scoped offline caches and safe version routing |
| `src/usePwa.ts`, `src/components/PwaPanel.tsx`, `src/pwa-client.ts` | Install guidance, actual readiness, update discovery and guarded user restart |
| `public/icons/`, `scripts/generate-pwa-icons.mjs` | Original install icons and reproducible PNG generation |
| `playwright.pwa.config.ts`, `tests/pwa*` | Dedicated production offline/failure/two-release lifecycle tests |
| `src/curriculum.test.ts`, `tests/expanded.spec.ts` | Content graph/integrity, published contract preservation, legacy resume, staged exercises, and every-lesson viewport checks |
| `content/problems/` | One JSON file per coding problem plus `index.json` (order); bundled to `src/generated/problems.json` (lazy chunk) and `problem-index.json` |
| `src/problems.ts`, `src/problem-types.ts` | Problem index and lazy loader |
| `src/problems.test.ts`, `tests/fixtures/problem-ids.json` | Schema, append-only IDs, and every JS **and** Python solution against visible and hidden tests (starters must fail) |
| `src/runner/` | Test harness (`core.ts`), JS, Pyodide, TypeScript and PGlite (`sql-core.ts`, `sql.worker.ts`) workers, timeouts and pinned runtime versions |
| `src/screens/CodeScreen.tsx`, `src/components/CodeEditor.tsx`, `src/code-drafts.ts` | Code runner UI, keyboard-friendly editor, local drafts |
| `tests/code.spec.ts` | Browser solves in both languages, drafts, timeout recovery, errors and narrow layouts |
| `content/sql-problems/` | One JSON file per SQL interview problem plus `index.json` (order); bundled to `src/generated/sql-problems.json` (lazy chunk) and `sql-problem-index.json` |
| `src/sql-problems.ts`, `src/screens/SqlProblemsScreen.tsx` | SQL problem index, lazy loader, topic progress, list and workspace UI |
| `src/sql-problems.test.ts`, `tests/fixtures/sql-problem-ids.json`, `tests/sql-problems.spec.ts` | Schema, append-only IDs, every solution and starter on PGlite, XP/badges/plan/mocks; browser solve, filters and layouts at 360/768/1440 |
| `content/cases/` | One JSON file per system design case plus `index.json`; bundled to `src/generated/cases.json` (lazy chunk) and `case-index.json` |
| `src/cases.ts`, `src/case-types.ts`, `src/design-framework.ts` | Case index, lazy loader, node kinds and the 8-step framework |
| `src/cases.test.ts`, `tests/fixtures/case-ids.json` | Case schema, diagram and rubric checks, append-only IDs |
| `src/screens/DesignScreen.tsx`, `src/components/Whiteboard.tsx`, `src/design-drafts.ts`, `src/design-score.ts` | Case list, timed workspace, review and rubric, SVG whiteboard, local drafts |
| `tests/design.spec.ts` | Timer, persisted notes and board, keyboard whiteboard, scoring, backups and narrow layouts |
| `content/field-guide/` | One JSON file per Field Guide entry plus `index.json` (order); bundled to `src/generated/guides.json` (lazy) and `guide-index.json`, with quiz flashcards added to the decks |
| `src/guide-types.ts`, `src/guides.ts` | Entry and diagram types, topics and their tracks, index and lazy loader |
| `src/components/Diagram.tsx`, `src/diagram-layout.ts`, `src/diagram.css` | Theme-aware SVG diagrams, layout geometry (edge-through-box and label-collision checks) and step-throughs |
| `src/screens/FieldGuideScreen.tsx`, `src/field-guide.css` | Guide list and filters, entry pages, quiz, anti-pattern gallery |
| `src/guides.test.ts`, `tests/fixtures/guide-ids.json`, `tests/field-guide.spec.ts` | Schema, cross-links, diagram legibility, append-only IDs, integration; browser flows, diagram contrast in every palette and layouts at 360/768/1440 |
| `content/flashcards/<track>.json` | Flashcard decks; bundled to `src/generated/flashcards.json` (lazy) and `flashcard-index.json` |
| `src/flashcards.ts`, `src/screens/FlashcardsScreen.tsx` | Leitner scheduling, session queue and review UI |
| `src/mocks.ts`, `src/screens/MockScreen.tsx` | Seeded mock builder, rubrics, timer and review |
| `src/stories.ts`, `src/screens/StoriesScreen.tsx` | Competencies, SSE signals and the STAR story bank |
| `src/planner.ts`, `src/screens/PlanScreen.tsx` | Interview-date study planner |
| `src/practice.test.ts`, `tests/practice.spec.ts` | Unit and browser tests for cards, mocks, stories and plan |
| `src/progress.ts` | Data model, full backup validation, review scheduling, storage primitives |
| `src/useProgress.ts` | React state, save/recovery errors, and other-tab conflict handling |
| `src/App.tsx` | Shell, routing, storage alerts, and backup flows |
| `src/screens/` | Home, Tracks, Practice, Progress, Settings and Study screens |
| `src/components/` | Reusable UI components |
| `src/styles.css` | Clawpilot tokens and responsive layouts |
| `src/progress.test.ts` | Curriculum contract, state transitions, invalid inputs, storage failures |
| `tests/app.spec.ts` | Production-browser workflows, keyboard behavior, viewport checks, visual captures |
| `tests/domain.spec.ts` | Same-artifact root/project assets, hash refresh, and explicit cross-origin backup transfer |
| `tests/serve-dist.mjs` | Strict dual-mount static server for isolated browser tests |
| `public/CNAME` | Custom hostname (`devprep.madebyfavor.com`) copied to the Pages artifact |
| `.github/workflows/deploy.yml` | PR validation and gated `main` deployment |

### Adding content

Add `content/<track>/<new-id>.json` and append its ID to that track's `track.json` and to `tests/fixtures/lesson-ids.json`. `npm test` validates the schema and regenerates the bundle. Prerequisites must be earlier lessons in the same track.

To add a track, add its ID to `Track` (`src/curriculum-types.ts`), `TRACK_IDS` (`src/content-schema.ts`) and `TRACK_ORDER` (`scripts/build-content.mjs`), then create `content/<track>/track.json`. Older backups that list focus tracks keep loading. "Track done" badges are derived, so adding lessons to a track means finishing the new lessons to keep that badge.

Lesson IDs are part of the backup format. Renaming or removing one requires an explicit migration and a versioning plan; do not silently discard unknown progress.

### Adding a coding problem

Add `content/problems/<id>.json` (fields: `id`, `title`, `pattern` (one of `PROBLEM_PATTERNS` in `src/problem-types.ts`), `level`, `difficulty`, optional `lessonId`, optional `paths` (`swe`/`senior`: core on that role path), `prompt`, `function` and `starter`/`solution` for `js` and `py`, `tests`, `hiddenTests`, `hints`, `complexity`, `followUps`), append the ID to `content/problems/index.json` (grouped by pattern), `tests/fixtures/problem-ids.json` and its recall card `dsa-p-<id>` to `tests/fixtures/card-ids.json`, then run `npm test`. IDs are append-only: they are stored in backups. Arguments and expected values are JSON; results are compared by value, ignoring object key order. Write problems yourself; don't copy text from problem sites.

### Adding a SQL problem

Add `content/sql-problems/<id>.json` (fields: `id`, `title`, `topic` (one of `SQL_TOPICS` in `src/problem-types.ts`), `level`, `difficulty`, optional `lessonId` (a SQL lesson), optional `paths`, `prompt`, `hints` (3+), `exercise` (`schema`, `starter`, `solution`, optional `ordered` and `check`, at least 2 `tests` and 4 `hiddenTests`, each `{ name, seed, expected: { columns, rows } }`), `explanation`, `notes`, `followUps` (2+)). Append the ID to `content/sql-problems/index.json` (grouped by topic), `tests/fixtures/sql-problem-ids.json`, and its recall card `sql-p-<id>` to `tests/fixtures/card-ids.json`, then run `npm test`. IDs are append-only. Write problems yourself; don't copy text from problem sites.

### Adding a system design case

Add `content/cases/<id>.json` with `id`, `title`, `level` (`se`/`sse`), `minutes`, `summary`, `prompt`, `lessons` (system-design lesson IDs), `steps` (2 or more bullets for each of the 8 framework keys), `diagram` (`nodes` with `kind`, `label` of up to 18 characters, and a unique `col` 0–5 and `row` 0–4; `edges` with an optional `label`) and `rubric` (5–10 items, at least one marked `"sse": true`). Then append the ID to `content/cases/index.json` and `tests/fixtures/case-ids.json`, and run `npm test`.

### Adding a Field Guide entry

Add `content/field-guide/<id>.json` (shape in `src/guide-types.ts`; every limit is in `validateGuide` in `src/content-schema.ts`). Common fields: `id`, `kind` (`guide`/`case`), `topic`, `level`, `title`, `summary`, `minutes`, `diagrams` (at least 3 of at least 2 types; ids unique across the whole guide), `interview`, `quiz` (3–6), `practice`, `links`. Guides add `principle`, `why`, `checklist`, `examples` and `antipatterns` (snippets hold `code` or a `diagram` id). Cases add `organisation`, `year`, `problem`, `constraints`, `decisions`, `failures`, `lessons`, `sources` and optional `caveats`. Append the ID to `content/field-guide/index.json` and `tests/fixtures/guide-ids.json`, add its quiz card IDs to `tests/fixtures/card-ids.json`, and run `npm test`. Flow diagrams sit on a 5×6 grid; tests fail if an arrow passes through a box, a label overflows its box or chart labels collide. Case studies must paraphrase and cite their sources.

### Adding flashcards

Append `{ "id", "front" (≤200), "back" (≤600), "level": "se"|"sse" }` to `content/flashcards/<track>.json` (IDs are kebab-case and start with the track's prefix), add the ID to `tests/fixtures/card-ids.json`, and run `npm test`.

**Pyodide upgrades:** bump `pyodide` in `package.json` and `PYODIDE_VERSION` in `src/runner/pyodide-version.ts` together (a test checks they match). Files are served from `pyodide/<version>/`; the service worker drops older Pyodide caches on activation.
