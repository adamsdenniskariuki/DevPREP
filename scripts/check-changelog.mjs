// Fails a pull request that changes the app without a changelog entry.
//
// "Changes the app" means a file under src/ or content/ that is not a test or the generated output. Such a PR must
// also change content/changelog.json (normally by adding a release, which npm run content checks against
// package.json). Escape hatch for changes users can't notice (refactors, test-only fixes, tooling): put
// "[skip changelog]" in the PR title or add the "skip-changelog" label.
//
// Usage: node scripts/check-changelog.mjs [base-ref]   (default: origin/main)
// CI passes PR_TITLE and PR_LABELS (a JSON array of label names) from the pull_request event.
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export const CHANGELOG = 'content/changelog.json'
export const SKIP_TITLE = '[skip changelog]'
export const SKIP_LABEL = 'skip-changelog'

/** True for files whose change users could notice in the app. */
export function isAppChange(file) {
  const path = file.replaceAll('\\', '/')
  if (!path.startsWith('src/') && !path.startsWith('content/')) return false
  if (path.startsWith('src/generated/')) return false
  return !/\.test\.[cm]?[jt]sx?$/.test(path)
}

/** Decides the check: { ok, message }. */
export function checkChangelog(files, { title = '', labels = [] } = {}) {
  const app = files.filter(isAppChange).filter(file => file.replaceAll('\\', '/') !== CHANGELOG)
  if (!app.length) return { ok: true, message: 'No app changes; no changelog entry needed.' }
  if (files.some(file => file.replaceAll('\\', '/') === CHANGELOG)) return { ok: true, message: `${CHANGELOG} is updated.` }
  if (title.toLowerCase().includes(SKIP_TITLE) || labels.includes(SKIP_LABEL)) return { ok: true, message: `Changelog check skipped (${SKIP_TITLE} or ${SKIP_LABEL}).` }
  const listed = app.slice(0, 10).map(file => `  - ${file}`).join('\n')
  return {
    ok: false,
    message: `This change touches the app but not ${CHANGELOG}:\n${listed}${app.length > 10 ? `\n  …and ${app.length - 10} more` : ''}\n`
      + `Add a release (and bump package.json "version" to match), or, if users can't notice the change, put "${SKIP_TITLE}" in the PR title or add the "${SKIP_LABEL}" label.`,
  }
}

function labelsFrom(value) {
  try {
    const parsed = JSON.parse(value || '[]')
    return Array.isArray(parsed) ? parsed.filter(item => typeof item === 'string') : []
  } catch { return [] }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const base = process.argv[2] || process.env.CHANGELOG_BASE || 'origin/main'
  const files = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], { encoding: 'utf8' }).split('\n').filter(Boolean)
  const result = checkChangelog(files, { title: process.env.PR_TITLE ?? '', labels: labelsFrom(process.env.PR_LABELS) })
  if (result.ok) console.log(result.message)
  else {
    console.error(`::error title=Changelog entry missing::${result.message.replaceAll('\n', '%0A')}`)
    process.exitCode = 1
  }
}
