import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { tracks } from './curriculum'
import { problemIds } from './problems'
import { sqlProblemIds } from './sql-problems'
import { caseIds } from './cases'
import { guideIds } from './guides'
import { patternIds } from './patterns'
import { companyIds } from './companies'
import { parseHash } from './routes'
import type { RouteIds } from './routes'
import { RELEASES } from './changelog'
import { compareVersions } from './versions'
// @ts-expect-error plain JS build script
import { buildChangelog, validateChangelog } from '../scripts/build-content.mjs'
// @ts-expect-error plain JS build script
import { checkChangelog, isAppChange } from '../scripts/check-changelog.mjs'

const ids: RouteIds = { tracks: tracks.map(item => item.id), problems: problemIds, sql: sqlProblemIds, cases: caseIds, guides: guideIds, patterns: patternIds, companies: companyIds }
const release = (version: string, date = '2026-01-01') => ({ version, date, title: 'A release', highlights: [{ text: 'One', route: '#home' }, { text: 'Two', route: '#map' }], notes: [] })

describe('changelog content', () => {
  it('generated changelog matches content/changelog.json', () => {
    expect(JSON.parse(readFileSync('src/generated/changelog.json', 'utf8'))).toEqual(buildChangelog())
    expect(RELEASES.length).toBeGreaterThanOrEqual(8)
  })

  it('links every highlight to a route the app can open', () => {
    for (const item of RELEASES.flatMap(entry => entry.highlights)) expect(parseHash(item.route, ids).route, item.route).not.toBe('unknown')
  })

  it('lists releases newest first and matches the package version', () => {
    for (let index = 1; index < RELEASES.length; index++) expect(compareVersions(RELEASES[index - 1].version, RELEASES[index].version)).toBeGreaterThan(0)
    expect(JSON.parse(readFileSync('package.json', 'utf8')).version).toBe(RELEASES[0].version)
  })

  it('backfills the recent releases', () => {
    const titles = RELEASES.map(entry => entry.title.toLowerCase()).join(' | ')
    for (const word of ['playground', 'command palette', 'navigation', 'company prep', 'whiteboard', 'patterns', 'codemirror']) expect(titles).toContain(word)
  })

  it('rejects malformed changelogs with readable errors', () => {
    expect(() => validateChangelog({ releases: [] })).toThrow(/non-empty/)
    expect(() => validateChangelog({ releases: [{ ...release('1.0'), extra: 1 }] })).toThrow(/exactly version/)
    expect(() => validateChangelog({ releases: [release('1.0')] })).toThrow(/1\.2\.3/)
    expect(() => validateChangelog({ releases: [release('1.0.0', '2026-02-30')] })).toThrow(/ISO date/)
    expect(() => validateChangelog({ releases: [{ ...release('1.0.0'), highlights: [{ text: 'Only one', route: '#home' }] }] })).toThrow(/2–3 highlights/)
    expect(() => validateChangelog({ releases: [{ ...release('1.0.0'), highlights: [{ text: 'a', route: 'home' }, { text: 'b', route: '#map' }] }] })).toThrow(/app hash/)
    expect(() => validateChangelog({ releases: [release('1.0.0'), release('1.1.0')] })).toThrow(/newest first/)
    expect(() => validateChangelog({ releases: [release('1.1.0', '2026-01-01'), release('1.0.0', '2026-02-01')] })).toThrow(/dated before/)
    expect(validateChangelog({ releases: [release('1.1.0'), release('1.0.0')] })).toHaveLength(2)
  })
})

describe('CI changelog check', () => {
  it('treats app source and content as app changes, but not tests, generated files or tooling', () => {
    expect(isAppChange('src/App.tsx')).toBe(true)
    expect(isAppChange('content/lessons/dsa/arrays.md')).toBe(true)
    expect(isAppChange('src\\styles.css')).toBe(true)
    for (const file of ['src/routes.test.ts', 'src/generated/curriculum.json', 'tests/pwa.spec.ts', 'README.md', 'scripts/build-content.mjs', '.github/workflows/deploy.yml']) expect(isAppChange(file), file).toBe(false)
  })

  it('fails app changes without a changelog entry, with an escape hatch', () => {
    expect(checkChangelog(['README.md', 'tests/app.spec.ts']).ok).toBe(true)
    expect(checkChangelog(['src/App.tsx', 'content/changelog.json', 'package.json']).ok).toBe(true)
    const missing = checkChangelog(['src/App.tsx'])
    expect(missing.ok).toBe(false)
    expect(missing.message).toContain('src/App.tsx')
    expect(missing.message).toContain('[skip changelog]')
    expect(checkChangelog(['src/App.tsx'], { title: 'Refactor store [Skip Changelog]' }).ok).toBe(true)
    expect(checkChangelog(['src/App.tsx'], { labels: ['skip-changelog'] }).ok).toBe(true)
    expect(checkChangelog(['src/App.tsx'], { labels: ['changelog'] }).ok).toBe(false)
  })
})
