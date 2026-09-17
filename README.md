# DevPREP

A little practice. A stronger interview. DevPREP is a local-first interview preparation app for software engineers, built with React, TypeScript, and Vite.

## The study loop

**Today → chunked lesson → practice → explanation & self-assessment → scheduled review.**

- **46 original, in-depth lessons** across all four tracks: **19 DSA, 10 system design, 9 ML, and 8 behavioral/interview lessons**, ordered by recommended prerequisites. All 12 original lessons are substantially deepened. See the coverage map below.
- A daily plan suggesting one new lesson and one due review. Full-session estimates include learning and practice; longer lessons can be split across days. Additional practice is optional; nothing is locked.
- Optional **Software Engineer** and **Senior Software Engineer** learning paths curate the existing lessons into different prerequisite-respecting sequences. Switch at any time without losing your work.
- Chunked reading: objectives/prerequisites, individual concepts, worked examples and walkthroughs, pitfalls, and takeaways. Use the section selector or Previous/Next controls instead of scrolling through a wall of text.
- Progressively challenging **warm-up → core → stretch** practice with progressive hints, worked answers, and rubrics. One session notebook is shared across the three difficulties; label optional work. Only the core task drives completion and review scheduling.
- Interview follow-ups with discussion points to practice reasoning aloud, not memorize scripts.
- Resumable sessions: current step, reading section, answer, core-task hints, core solution visibility, and checklist are saved as you work. Optional exercise disclosures reset when leaving that exercise, but notebook text stays.
- Calendar-based spaced reviews driven by your own confidence. First reviews: **1 day** for Needs practice, **3 days** for Getting there, **7 days** for Confident. Subsequent reviews reset to 1, multiply the previous interval by 1.5 (rounded up), or double it respectively, capped at 60 days. Early practice also reschedules from its completion date.
- Progress by track and recent session history. These are practice milestones, not readiness scores.
- Desktop sidebar and lesson/practice split view; focused single-step study on smaller screens and bottom navigation on mobile. Keyboard navigation, visible focus, labeled controls, and reduced-motion support.
- Clawpilot light/dark theme. `?scoutTheme=light` or `?scoutTheme=dark` explicitly overrides the system preference. The theme button updates that URL parameter.
- Four optional accent colors: the original **Red (rose)**, **Blue**, **Forest green**, and **Purple**, independent of the light/dark theme.

System design and behavioral work is assessed with prompts and checklists, **not automated grading**. DSA examples retain language-neutral pseudocode rather than introducing an arbitrary execution language. Behavioral illustrations are models for organizing genuine experience, never instructions to invent accomplishments. There is no code execution, AI coaching, full mock interview system, backend, account, payment, or notification service.

## Curriculum coverage

| Track | Learning progression |
| --- | --- |
| Data structures & algorithms | Arrays and hash maps; two pointers and sliding windows; stacks, queues, and linked lists; binary search and sorting; recursion, trees/BSTs, and heaps; graph BFS/DFS and topological ordering; backtracking, greedy reasoning, and dynamic programming |
| System design | Requirements and capacity; APIs/data modeling and databases/indexes; caching; replication/partitioning and consistency; queues/events and rate limiting; reliability/observability; worked end-to-end designs |
| Machine learning | Data preparation/leakage and splitting/evaluation; regression/classification; optimization/regularization and bias/variance; trees/ensembles; clustering; imbalance/thresholds; deployment, monitoring, and practical design tradeoffs |
| Behavioral/interview preparation | Truthful structured stories; ownership/impact; conflict; failure/learning; ambiguity/prioritization; collaboration/leadership; project deep dives; communication during technical interviews |

Prerequisite links are advisory and remain within each track. Opening one asks before replacing an unfinished session. Warm-ups reduce problem size or focus on one idea; stretch tasks change assumptions or add constraints. Completing a lesson records your self-assessment, not mastery of every optional challenge.

## SWE and Senior SWE learning paths

Choose a path with the **Learning path** selector, available on Today, Roadmap, Review, Progress, and Study. **Compare paths & outcomes** explains the audience and learning goals. No path is selected automatically: new users and old backups without a choice keep the existing curriculum order and all-track roadmap.

| Path | Curated lessons | Emphasis and sequence |
| --- | --- | --- |
| Software Engineer | **29**: 17 DSA, 4 system design, 8 interview | Programming foundations → evidence of contribution → structures/search → algorithm choices → a small service → communication and reflection |
| Senior Software Engineer | **30**: 12 DSA, 10 system design, 8 interview | Requirements/ownership/ambiguity → selected coding refresh → distributed-system tradeoffs → operational ownership and leadership → end-to-end synthesis |

Both paths include every selected lesson's prerequisites earlier in the sequence, rather than assuming prior knowledge is a completed lesson. Shared lessons retain one completion record and count in **both** paths. Their overlap is intentional: communication and leadership lessons form a prerequisite chain, while the Senior path adds broader design work, different sequencing, and three focused discussion extensions.

Senior extensions cover negotiating ambiguous scope, owning an index migration/rollback, and influencing across teams without inventing authority. They appear during practice and reflection on the relevant lessons, with prompts, reasoning rubrics, and a defensible discussion. They are optional: notes share the session notebook, and they do **not** create extra completions, alter the core exercise, or add review dates.

- **Today:** the first unfinished lesson in the selected path is the next recommendation. An unfinished session takes priority, even if it is outside the path. A daily completed lesson from any track still counts as study for that day.
- **Roadmap:** switch between **Selected path** (ordered phases and objectives) and **All curriculum** (the original track browser). Browsing all curriculum does not clear your path choice. All 46 lessons remain open; ML and omitted coding/design topics are optional supplemental study.
- **Progress:** the selected path has its own denominator (29 or 30); overall progress remains out of 46. Both path totals are shown separately. Supplemental work contributes to overall completion, not to a path that omits it.
- **Review:** the queue always includes every due completed lesson, including supplemental ML and lessons studied before a path switch. Switching neither filters nor reschedules reviews.
- **Switching or clearing:** changing the selector updates only the path choice. Drafts, reading bookmarks, hints, checklist selections, completion records, and review dates stay intact. Choosing **All curriculum (no path selected)** restores the original recommendation behavior.
- **Path completion:** Today says the path is explored and offers reviews or all-curriculum browsing; it does not silently enroll you in another path or supplemental track.

These are **interview-preparation guides, not certification, level assessments, or readiness guarantees**. The Senior path is focused interview practice, not a complete senior-engineer training program. Adapt behavioral examples truthfully to your own experience; label hypothetical reasoning as hypothetical.

## Appearance

Use the visibly labeled **Accent** selector beside the light/dark button. Each option has a color name, the native selector identifies the selected option, and the adjacent swatch previews it. The control supports keyboard selection and touch-sized targets.

- **Red (rose)** remains the default. Existing users do not need to select or migrate anything.
- **Blue**, **Forest green**, and **Purple** are opt-in accent variants, each with deliberately paired light/dark values.
- Accent changes affect action buttons, active navigation, progress fills, selected states, tinted accents, and focus outlines. Neutral backgrounds, typography, layout, and success/warning/danger/link tokens are not palette overrides.
- Light/dark behavior is unchanged: an explicit `scoutTheme` URL value wins over the system preference. Without a valid override, the system preference is read at page load. The accent selector does not change that URL or theme choice.

### Accent persistence and recovery

The separate local-storage key **`devprep.accent.v1`** contains one of `red`, `blue`, `forest`, or `purple`. It is an appearance preference, **not part of study-progress JSON exports/imports**. Restoring an old or new progress backup therefore does not change the current accent or require a backup schema change. Like other browser-local data, the preference is specific to the origin and browser profile; changing domains or clearing site data can restore the default.

The small head script applies a valid saved accent before the React application starts. Missing preferences default to red without writing anything. Invalid or unreadable preferences display red and surface a visible warning once the UI loads; the stored value is not silently deleted or replaced. Choosing an accent or **Save current accent** changes only the accent key.

If saving fails, the selected accent still applies in the current tab, a warning explains that it is not saved, and **Save current accent** retries. The previous saved value and all study data remain intact. Other tabs pick up the most recently saved accent when reloaded; this preference does not trigger study-progress conflict handling.

### Palette and contrast checks

`src/accents.css` centralizes the three opt-in palettes and contextual `--cp-accent-on-soft` text colors. The original red fill, hover, soft/highlight, and foreground tokens remain unchanged. Stronger text ink on tinted dark surfaces, and neutral text on nested badges, avoid low-contrast combinations without recoloring semantic feedback.

Browser tests exercise all **4 accents × 2 theme modes**, measuring actual CSS colors and alpha-composited surfaces. Targets are **at least 4.5:1** for tested accent text/primary/hover/selected combinations and **3:1** for tested focus/progress combinations. They also inspect rendered states, startup initialization, persistence/errors, keyboard/touch behavior, and domain-root navigation. These are targeted accent checks, not a claim that every aspect of the app has received a full accessibility audit.

Run the focused browser coverage with `npm run test:e2e -- accents.spec.ts` after a production build.

## Install DevPREP and use it offline

Open **App & offline** to see the actual preparation state and installation options. The first successful preparation requires internet; wait for **Offline lessons ready** before relying on offline access. Installing the app and preparing its offline files are separate browser operations.

- **Desktop Chrome/Edge and supported Android browsers:** use **Install DevPREP** when the browser offers that prompt, or use the browser's install icon/menu. A dismissed prompt does not mean installed. An accepted prompt means installation was requested; completion is only reported after the browser's installation event or when running in standalone mode.
- **iPhone/iPad:** open the site in Safari, use **Share → Add to Home Screen**, and follow the OS instructions. Availability varies by browser/OS. If the option is absent, the website remains usable.
- **Other/unsupported browsers:** use a bookmark or the online site. DevPREP cannot force browser installation, and this is not a native app-store package.

After preparation, **all 46 bundled lessons**, their examples/solutions, scripts/styles, and required local assets are cached, including the split curriculum bundle. A cold offline reload can open previously unvisited lessons in any track. Local drafts, reading bookmarks, paths, reviews, and accents continue to work. JSON export/import can also work offline where the browser supports the relevant file actions; it does not add cloud synchronization.

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
- **Progress → Export backup** downloads versioned JSON. Import it into another browser to transfer your progress. The file contains completion records, due dates, the current unfinished session (including its answer), the optional path choice, and the latest 5,000 activity events.
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

Completed lesson counts and review dates are preserved. New lessons increase the roadmap denominator, so your displayed percentage can decrease without any lost completions. Today recommends the first unfinished lesson in the expanded curriculum order unless you explicitly select a curated path.

`tests/fixtures/v1-progress.json` is a real export captured through the original MVP browser UI before the expansion: one completed hash-map lesson and an unfinished two-pointer reflection with draft, both hints revealed, solution visibility, and checked items. Tests load/import/resume/finish it and compare the previous record and review date. Separate fixed fingerprints protect all 12 original core contracts.

Review dates use the device’s local calendar, including daylight-saving changes. They do not send reminders. The app refreshes the current date once per minute while open.

## GitHub Pages deployment

The intended site URL is **https://adamsdenniskariuki.github.io/DevPREP/**. A successful PR build does **not** mean the site is live.

1. In the repository’s **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source. A repository administrator must enable this; it is not enabled by adding a workflow alone.
2. Review and merge the implementation PR into `main`.
3. The **Validate and deploy Pages** workflow installs locked dependencies, runs unit tests, builds, runs desktop/mobile browser tests, and uploads `dist` for Pages.
4. The deploy job runs only for `main` pushes or manual dispatches on `main`, after validation. Approve the `github-pages` environment if the repository requires it.
5. Check the workflow’s deployment URL after the deploy job succeeds.

Pull requests run the same validation but **cannot deploy**. The workflow uses the built-in `GITHUB_TOKEN` and OIDC with job-scoped Pages permissions; no PAT is stored in this project.

All app navigation is hash-based (`/DevPREP/#roadmap`, `/DevPREP/#study`), so refreshing or sharing a route does not need a server rewrite or a custom 404 page. `#study` resumes this browser’s active session; it is not a shared lesson URL.

### Custom domain: staged activation only

The approved hostname is **devprep.madebyfavor.com**. `public/CNAME` contains that hostname and Vite copies it to `dist/CNAME`. With an **Actions-based Pages deployment**, GitHub ignores this file for domain configuration; an administrator must set the repository's remote custom domain separately. See [GitHub's custom-domain documentation](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site). This compatibility change does not alter DNS, Pages settings, or HTTPS settings.

Required DNS record at the provider for `madebyfavor.com`:

| Type | Host/name | Target/value |
| --- | --- | --- |
| CNAME | `devprep` | `adamsdenniskariuki.github.io` |

The target has **no scheme or path**: do not include `https://` or `/DevPREP/`.

**Activation sequence (do not skip the backup or approval gates):**

1. Before any redirect/domain activation, open **https://adamsdenniskariuki.github.io/DevPREP/#progress** in each browser/profile with progress and choose **Export backup**. Keep the downloaded JSON safe; export again if you continue studying before activation.
2. Review and merge the compatibility PR, then let the normal `main` workflow deploy the compatible artifact to the **existing URL first**. Do not manually deploy or activate the domain as part of PR preparation.
3. Verify the existing URL still loads scripts/styles, navigates and refreshes hash routes, resumes drafts, and exports backups. Local regression checks: `npm run build` followed by `npm run test:e2e -- tests/domain.spec.ts` verifies both mounts using one artifact.
4. Confirm DNS readiness: provider access, the exact intended record, and whether any existing record resolves correctly. Do not publish a new unclaimed Pages CNAME in advance: GitHub warns of domain-takeover risk and recommends domain verification and setting the Pages domain before publishing DNS. Creating/changing DNS requires separate approval; the approved hostname is not authorization to change DNS.
5. **Only after separate activation approval**, an administrator sets **Settings > Pages > Custom domain** to `devprep.madebyfavor.com`, coordinates any separately approved DNS update, verifies resolution (for example, `Resolve-DnsName devprep.madebyfavor.com -Type CNAME`), waits for GitHub's DNS check and certificate provisioning, and enables **Enforce HTTPS** when available. The GitHub Pages URL may then redirect to the custom domain, so old-origin backups must already be downloaded.
6. Verify **https://devprep.madebyfavor.com/** and refresh `/#roadmap`, `/#study`, and `/#progress`. Use **Progress > Import backup**, select the exported JSON, and confirm **Replace progress**. Confirm due dates and unfinished drafts before discarding any backup.

**Local storage is origin-scoped.** `https://devprep.madebyfavor.com` cannot read progress from `https://adamsdenniskariuki.github.io`. A redirect does not transfer storage; there is **no automatic migration**. Import replaces, rather than merges, any progress already created at the new origin. The domain tests exercise an explicit export/import between different local hostnames in the same browser context.

## Code map

| File | Responsibility |
| --- | --- |
| `src/curriculum-types.ts` | Teaching sections, staged exercises, and lesson schema |
| `src/curriculum.ts` | Track metadata and prerequisite-ordered curriculum assembly |
| `src/content/` | Four expanded tracks, preserved published starter contracts, and worked-example tests |
| `src/LessonReader.tsx`, `src/lesson-sections.ts` | Chunked content navigation and stable reading-section identifiers |
| `src/ExtraPractice.tsx` | Optional warm-up/stretch hints, worked answers, and rubrics |
| `src/learning-paths.ts`, `src/learning-paths.test.ts` | Curated path phases, senior extensions, selection/progress helpers, prerequisite and preservation tests |
| `src/PathPicker.tsx`, `src/PathRoadmap.tsx`, `src/PathPrompt.tsx` | Opt-in path selection, ordered roadmap, and senior discussion surfaces |
| `src/LessonList.tsx`, `src/format.ts` | Shared lesson rows and review-date formatting for path and all-track views |
| `src/accents.css`, `src/AccentPicker.tsx`, `src/useAccent.ts` | Central accent palettes, appearance selection, and visible preference recovery |
| `src/accent-preference.ts`, `src/accent-preference.test.ts`, `tests/accents.spec.ts` | Separate preference contract, startup/error checks, real palette contrast and browser coverage |
| `tests/paths.spec.ts` | Path recommendations, switching, global reviews, shared progress, legacy backups, keyboard and mobile flows |
| `src/sw.ts`, `src/pwa-cache.ts` | Integrity-checked, mount-scoped offline caches and safe version routing |
| `src/usePwa.ts`, `src/PwaPanel.tsx`, `src/pwa-client.ts` | Install guidance, actual readiness, update discovery and guarded user restart |
| `public/icons/`, `scripts/generate-pwa-icons.mjs` | Original install icons and reproducible PNG generation |
| `playwright.pwa.config.ts`, `tests/pwa*` | Dedicated production offline/failure/two-release lifecycle tests |
| `src/curriculum.test.ts`, `tests/expanded.spec.ts` | Content graph/integrity, published contract preservation, legacy resume, staged exercises, and every-lesson viewport checks |
| `src/progress.ts` | Data model, full backup validation, review scheduling, storage primitives |
| `src/useProgress.ts` | React state, save/recovery errors, and other-tab conflict handling |
| `src/App.tsx` | Today, roadmap, study, review, progress, and backup flows |
| `src/styles.css` | Clawpilot tokens and responsive layouts |
| `src/progress.test.ts` | Curriculum contract, state transitions, invalid inputs, storage failures |
| `tests/app.spec.ts` | Production-browser workflows, keyboard behavior, viewport checks, visual captures |
| `tests/domain.spec.ts` | Same-artifact root/project assets, hash refresh, and explicit cross-origin backup transfer |
| `tests/serve-dist.mjs` | Strict dual-mount static server for isolated browser tests |
| `public/CNAME` | Custom hostname copied to the Pages artifact; not remote activation |
| `.github/workflows/deploy.yml` | PR validation and gated `main` deployment |

Lesson IDs are part of the backup format. Renaming or removing one requires an explicit migration and a versioning plan; do not silently discard unknown progress.
