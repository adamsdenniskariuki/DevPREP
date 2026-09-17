# DevPREP

A little practice. A stronger interview. DevPREP is a local-first interview preparation app for software engineers, built with React, TypeScript, and Vite.

## The study loop

**Today → chunked lesson → practice → explanation & self-assessment → scheduled review.**

- **46 original, in-depth lessons** across all four tracks: **19 DSA, 10 system design, 9 ML, and 8 behavioral/interview lessons**, ordered by recommended prerequisites. All 12 original lessons are substantially deepened. See the coverage map below.
- A daily plan suggesting one new lesson and one due review. Full-session estimates include learning and practice; longer lessons can be split across days. Additional practice is optional; nothing is locked.
- Chunked reading: objectives/prerequisites, individual concepts, worked examples and walkthroughs, pitfalls, and takeaways. Use the section selector or Previous/Next controls instead of scrolling through a wall of text.
- Progressively challenging **warm-up → core → stretch** practice with progressive hints, worked answers, and rubrics. One session notebook is shared across the three difficulties; label optional work. Only the core task drives completion and review scheduling.
- Interview follow-ups with discussion points to practice reasoning aloud, not memorize scripts.
- Resumable sessions: current step, reading section, answer, core-task hints, core solution visibility, and checklist are saved as you work. Optional exercise disclosures reset when leaving that exercise, but notebook text stays.
- Calendar-based spaced reviews driven by your own confidence. First reviews: **1 day** for Needs practice, **3 days** for Getting there, **7 days** for Confident. Subsequent reviews reset to 1, multiply the previous interval by 1.5 (rounded up), or double it respectively, capped at 60 days. Early practice also reschedules from its completion date.
- Progress by track and recent session history. These are practice milestones, not readiness scores.
- Desktop sidebar and lesson/practice split view; focused single-step study on smaller screens and bottom navigation on mobile. Keyboard navigation, visible focus, labeled controls, and reduced-motion support.
- Clawpilot light/dark theme. `?scoutTheme=light` or `?scoutTheme=dark` explicitly overrides the system preference. The theme button updates that URL parameter.

System design and behavioral work is assessed with prompts and checklists, **not automated grading**. DSA examples retain language-neutral pseudocode rather than introducing an arbitrary execution language. Behavioral illustrations are models for organizing genuine experience, never instructions to invent accomplishments. There is no code execution, AI coaching, full mock interview system, backend, account, payment, or notification service.

## Curriculum coverage

| Track | Learning progression |
| --- | --- |
| Data structures & algorithms | Arrays and hash maps; two pointers and sliding windows; stacks, queues, and linked lists; binary search and sorting; recursion, trees/BSTs, and heaps; graph BFS/DFS and topological ordering; backtracking, greedy reasoning, and dynamic programming |
| System design | Requirements and capacity; APIs/data modeling and databases/indexes; caching; replication/partitioning and consistency; queues/events and rate limiting; reliability/observability; worked end-to-end designs |
| Machine learning | Data preparation/leakage and splitting/evaluation; regression/classification; optimization/regularization and bias/variance; trees/ensembles; clustering; imbalance/thresholds; deployment, monitoring, and practical design tradeoffs |
| Behavioral/interview preparation | Truthful structured stories; ownership/impact; conflict; failure/learning; ambiguity/prioritization; collaboration/leadership; project deep dives; communication during technical interviews |

Prerequisite links are advisory and remain within each track. Opening one asks before replacing an unfinished session. Warm-ups reduce problem size or focus on one idea; stretch tasks change assumptions or add constraints. Completing a lesson records your self-assessment, not mastery of every optional challenge.

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
```

The build includes TypeScript checking. The browser tests start an isolated static server on **127.0.0.1:4273**, so run `npm run build` first and keep that port free (or set `$env:PLAYWRIGHT_PORT = '4274'` in PowerShell). Tests never reuse an existing server. The same `dist` bytes are served at `/` and `/DevPREP/`, without an SPA fallback that could conceal missing assets. Tests cover desktop Chromium and mobile-sized Chromium; the mobile project does not claim native Safari validation. On a fresh Linux machine, install browser system dependencies with `npx playwright install --with-deps chromium`.

`npm run preview` serves the built `dist` directory. No environment variables or secrets are required.

## Local data and backups

Progress lives under `devprep.progress.v1` in this browser’s local storage. It is not sent to a server. GitHub Pages still serves static files and may log ordinary HTTP requests.

- Clearing site data, private browsing, changing browser profiles, or changing devices can make progress unavailable. There is **no automatic backup or cross-device sync**.
- **Progress → Export backup** downloads versioned JSON. Import it into another browser to transfer your progress. The file contains completion records, due dates, the current unfinished session (including its answer), and the latest 5,000 activity events.
- Finishing a session keeps its completion and confidence, **not its answer or checklist**. Export before finishing to keep an unfinished draft. This makes later reviews fresh recall rather than replaying an old answer.
- Import is replacement, not merge. It validates the entire file before asking for confirmation. Cancel leaves existing progress untouched. Unknown schema versions, lesson IDs, fields, enum values, malformed dates, and out-of-range values are rejected. File limit: **1,000,000 bytes**; draft limit: **20,000 characters**.
- A failed save retains the previous persisted data and keeps the latest work in memory with a visible warning, export action, and retry. Do not close the page with unsaved work.
- Unreadable stored data opens a recovery screen without overwriting it. Download the original data, restore a valid backup, or explicitly confirm a fresh start.
- Other-tab changes are detected through storage events and a pre-write snapshot check. Export this tab’s work before reloading the saved version. Use one editing tab at a time: local storage has no cross-tab transactional locking.
- Backups can contain personal notes. Keep them private and avoid sensitive employer or interview information.

### Compatibility with the original curriculum

All 12 published lesson IDs and their core practice contracts remain unchanged: tasks, hint order/count, checklist wording/order/count, starter pseudocode, examples, and core solutions. Existing answers and checked boxes therefore retain their meaning even as new teaching material is added.

The storage key and backup schema version remain **v1**. A validated optional `session.readingSection` bookmark extends the session shape; original exports without it still load unchanged, beginning at the overview when returning to the Learn step. No destructive migration or automatic reset is performed. Old app versions may reject the new optional field; use the updated app when importing a new export.

Completed lesson counts and review dates are preserved. New lessons increase the roadmap denominator, so your displayed percentage can decrease without any lost completions. Today recommends the first unfinished lesson in the expanded order.

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
