# DevPREP

A little practice. A stronger interview. DevPREP is a local-first interview preparation app for software engineers, built with React, TypeScript, and Vite.

## The study loop

**Today → short lesson → practice → explanation & self-assessment → scheduled review.**

- An open, guided roadmap with **12 original lessons**: six DSA, two system design, two ML fundamentals, and two behavioral/interview preparation.
- A daily plan suggesting one new lesson and one due review. Additional practice is optional; nothing is locked.
- Concrete examples, practice tasks, two progressive hints, worked solutions, pitfalls, and reflection checklists.
- Resumable sessions: current step, answer, revealed hints, solution visibility, and checklist are saved as you work.
- Calendar-based spaced reviews driven by your own confidence. First reviews: **1 day** for Needs practice, **3 days** for Getting there, **7 days** for Confident. Subsequent reviews reset to 1, multiply the previous interval by 1.5 (rounded up), or double it respectively, capped at 60 days. Early practice also reschedules from its completion date.
- Progress by track and recent session history. These are practice milestones, not readiness scores.
- Desktop sidebar and lesson/practice split view; focused single-step study on smaller screens and bottom navigation on mobile. Keyboard navigation, visible focus, labeled controls, and reduced-motion support.
- Clawpilot light/dark theme. `?scoutTheme=light` or `?scoutTheme=dark` explicitly overrides the system preference. The theme button updates that URL parameter.

System design and behavioral work is assessed with prompts and checklists, **not automated grading**. There is no code execution, AI coaching, full mock interview system, backend, account, payment, or notification service.

## Run locally

Use **Node.js 22.12+** (the CI workflow uses Node 22) and npm.

```powershell
npm ci
npm run dev
```

Open **http://127.0.0.1:5173/DevPREP/**. The `/DevPREP/` base is intentional and used locally and on GitHub Pages.

```powershell
npm test
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

The build includes TypeScript checking. The browser tests start a production preview server on **127.0.0.1:4173**, so run `npm run build` first and keep that port free. Tests cover desktop Chromium and mobile-sized Chromium; the mobile project does not claim native Safari validation. On a fresh Linux machine, install browser system dependencies with `npx playwright install --with-deps chromium`.

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

## Code map

| File | Responsibility |
| --- | --- |
| `src/curriculum.ts` | Original lesson content and stable track/lesson IDs |
| `src/progress.ts` | Data model, full backup validation, review scheduling, storage primitives |
| `src/useProgress.ts` | React state, save/recovery errors, and other-tab conflict handling |
| `src/App.tsx` | Today, roadmap, study, review, progress, and backup flows |
| `src/styles.css` | Clawpilot tokens and responsive layouts |
| `src/progress.test.ts` | Curriculum contract, state transitions, invalid inputs, storage failures |
| `tests/app.spec.ts` | Production-browser workflows, keyboard behavior, viewport checks, visual captures |
| `.github/workflows/deploy.yml` | PR validation and gated `main` deployment |

Lesson IDs are part of the backup format. Renaming or removing one requires an explicit migration and a versioning plan; do not silently discard unknown progress.
