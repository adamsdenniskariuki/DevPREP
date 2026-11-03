import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import legacyBackup from '../tests/fixtures/v1-progress.json' with { type: 'json' }
import knownItemIds from '../tests/fixtures/plan-item-ids.json' with { type: 'json' }
import plansJson from './generated/plans.json' with { type: 'json' }
import navIndex from './generated/nav-index.json' with { type: 'json' }
// @ts-expect-error plain JS build script
import { buildPlans, PLAN_LANGUAGES as BUILD_LANGUAGES, validatePlan } from '../scripts/build-content.mjs'
import { parseFullBackup, serializeFullBackup } from './board-backup'
import { caseIds } from './cases'
import { companyIds } from './companies'
import { lessons, tracks } from './curriculum'
import { guideIds } from './guides'
import { deepSections } from './nav-deep'
import type { NavIndex } from './nav-model'
import { buildPaletteIndex, searchPalette } from './palette-index'
import { patternIds } from './patterns'
import { problemIds } from './problems'
import { emptyProgress, serializeBackup } from './progress'
import { hrefFor, parseHash, type RouteIds } from './routes'
import { sqlProblemIds } from './sql-problems'
import {
  daysBetween, emptyPlanProgress, isDay, itemText, loadPlans, MAX_ERRORS, newEntryId, parsePlans, PLAN_IDS, PLAN_LANGUAGES, planCount, PLANS_KEY, positionFor,
  readPlans, removeEntry, scoreAverage, setCheck, toDay, toggleItem, upsert, weekCount, weekItems, weeksFor, withPlan, writePlans,
  type PlansState, type StudyPlan,
} from './study-plans'

const plans = plansJson as unknown as StudyPlan[]
const plan = plans.find(item => item.id === 'applied-ai-ml-10wk')!
const ids: RouteIds = { tracks: tracks.map(item => item.id), problems: problemIds, sql: sqlProblemIds, cases: caseIds, guides: guideIds, patterns: patternIds, companies: companyIds, plans: PLAN_IDS }

class MemoryStorage {
  data = new Map<string, string>()
  full = false
  getItem(key: string) { return this.data.get(key) ?? null }
  setItem(key: string, value: string) { if (this.full) throw new Error('QuotaExceededError'); this.data.set(key, value) }
  removeItem(key: string) { this.data.delete(key) }
}
let storage: MemoryStorage
beforeEach(() => {
  storage = new MemoryStorage()
  vi.stubGlobal('window', { localStorage: storage })
})
afterEach(() => { vi.unstubAllGlobals() })

const hugeScores = () => Array.from({ length: 100 }, (_, i) => ({ id: `s${i}`, at: '2026-11-02', kind: 'dsa', title: 'y'.repeat(300), scores: [1, 1, 1, 1], notes: 'x'.repeat(1_000) }))
const hugeErrors = () => Array.from({ length: 300 }, (_, i) => ({ id: `e${i}`, at: '2026-11-02', problem: 'p'.repeat(300), pattern: 'q'.repeat(300), why: 'r'.repeat(300), fix: 's'.repeat(300) }))
const started = (extra: Partial<ReturnType<typeof emptyPlanProgress>> = {}): PlansState => ({ [plan.id]: { ...emptyPlanProgress(), start: '2026-11-02', ...extra } })

describe('study plan content', () => {
  it('builds from content/plans and matches the generated files', async () => {
    const built = buildPlans()
    expect(built.plans).toEqual(plans)
    expect(JSON.parse(readFileSync('src/generated/plan-ids.json', 'utf8'))).toEqual(built.ids)
    expect([...PLAN_IDS]).toEqual(built.ids)
    await expect(loadPlans()).resolves.toEqual(plans)
  })

  it('is a 10-week plan in three phases with the Applied AI track first', () => {
    expect(weekCount(plan)).toBe(10)
    expect(plan.phases.map(phase => phase.weeks)).toEqual([[1, 4], [5, 7], [8, 10]])
    expect(plan.tracks.map(track => track.id)).toEqual(['applied-ai', 'ml-engineer'])
    expect(plan.languages).toEqual(['python'])
  })

  it('links every item to content that exists, and every link parses with the app router', () => {
    const lessonIds = new Set(lessons.map(lesson => lesson.id))
    for (const item of plan.weeks.flatMap(weekItems)) {
      if (item.lesson) expect(lessonIds.has(item.lesson), item.id).toBe(true)
      if (item.href) {
        const parsed = parseHash(item.href, ids)
        expect(parsed.route, `${item.id} ${item.href}`).not.toBe('unknown')
        expect(hrefFor(parsed), item.href).toBe(item.href)
      }
    }
  })

  it('only uses the {lang} placeholder and fills it with the language label', () => {
    const items = plan.weeks.flatMap(weekItems)
    const templated = items.find(item => item.text.includes('{lang}'))!
    expect(itemText(templated, 'python')).toContain('Python')
    expect(itemText(templated, undefined)).not.toContain('{')
    for (const item of items) expect(itemText(item, 'python'), item.id).not.toMatch(/[{}]/)
  })

  it('keeps the language list in step with the build script', () => {
    expect(PLAN_LANGUAGES.map(lang => lang.id)).toEqual(BUILD_LANGUAGES)
  })

  it('has no personal or employer details', () => {
    const text = JSON.stringify(plans)
    for (const word of ['Microsoft', 'EntityServe', 'Polymer', 'Fitto', 'Substrate']) expect(text).not.toContain(word)
  })

  it('rejects broken plans with a readable message', () => {
    const copy = () => structuredClone(plan) as StudyPlan
    const targets = { code: problemIds, sql: sqlProblemIds, design: caseIds, guide: guideIds, patterns: patternIds, company: new Set(companyIds), mock: new Set(companyIds), tracks: new Set(tracks.map(item => item.id)) }
    const opts = { targets, lessons: new Set(lessons.map(lesson => lesson.id)) }
    expect(validatePlan(copy(), plan.id, opts)).toBeTruthy()
    const broken = copy()
    broken.weeks[0].days[0].items[0].href = '#code/no-such-problem'
    expect(() => validatePlan(broken, plan.id, opts)).toThrow(/content\/plans\/applied-ai-ml-10wk\.json: .*does not resolve/)
    const sixDays = copy()
    sixDays.weeks[1].days.pop()
    expect(() => validatePlan(sixDays, plan.id, opts)).toThrow('exactly 7 days')
    const badLang = copy()
    badLang.languages = ['cobol' as 'python']
    expect(() => validatePlan(badLang, plan.id, opts)).toThrow('languages')
  })
})

describe('plan item id registry', () => {
  const current = new Set(plan.weeks.flatMap(weekItems).map(item => item.id))
  it('keeps every item id that has ever shipped', () => expect(knownItemIds.filter(id => !current.has(id))).toEqual([]))
  it('records every current item id', () => expect([...current].filter(id => !knownItemIds.includes(id))).toEqual([]))
})

describe('tracks', () => {
  it('shares weeks 1–7 and swaps weeks 8–10 with the track', () => {
    const ai = weeksFor(plan, 'applied-ai')
    const ml = weeksFor(plan, 'ml-engineer')
    expect(ai.map(week => week.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(ml.map(week => week.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(ai.slice(0, 7)).toEqual(ml.slice(0, 7))
    for (const n of [8, 9, 10]) {
      expect(ai[n - 1].track).toBe('applied-ai')
      expect(ml[n - 1].track).toBe('ml-engineer')
      expect(weekItems(ai[n - 1]).map(item => item.id)).not.toEqual(weekItems(ml[n - 1]).map(item => item.id))
    }
    expect(weeksFor(plan, undefined)).toEqual(ai)
    expect(weeksFor(plan, 'nope')).toEqual(ai)
  })

  it('counts only the chosen track', () => {
    const aiItem = weekItems(weeksFor(plan, 'applied-ai')[8])[0]
    const entry = toggleItem(toggleItem(emptyPlanProgress(), 'w1-d1-1', '2026-11-02'), aiItem.id, '2026-11-02')
    expect(planCount(plan, entry).done).toBe(2)
    expect(planCount(plan, { ...entry, track: 'ml-engineer' }).done).toBe(1)
    expect(planCount(plan, undefined)).toEqual({ done: 0, total: weeksFor(plan, undefined).flatMap(weekItems).length })
  })
})

describe('dates', () => {
  it('finds the week and day from the start date', () => {
    expect(positionFor('2026-11-02', '2026-11-01', 10)).toEqual({ status: 'upcoming', daysUntil: 1 })
    expect(positionFor('2026-11-02', '2026-11-02', 10)).toEqual({ status: 'active', week: 1, day: 1 })
    expect(positionFor('2026-11-02', '2026-11-08', 10)).toEqual({ status: 'active', week: 1, day: 7 })
    expect(positionFor('2026-11-02', '2026-11-09', 10)).toEqual({ status: 'active', week: 2, day: 1 })
    expect(positionFor('2026-11-02', '2027-01-10', 10)).toEqual({ status: 'active', week: 10, day: 7 })
    expect(positionFor('2026-11-02', '2027-01-11', 10)).toEqual({ status: 'finished' })
  })

  it('counts calendar days across daylight-saving changes and month ends', () => {
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2)
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2)
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1)
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2)
  })

  it('accepts only real calendar days', () => {
    expect(isDay('2026-02-28')).toBe(true)
    expect(isDay('2026-02-29')).toBe(false)
    expect(isDay('2026-13-01')).toBe(false)
    expect(isDay('26-01-01')).toBe(false)
    expect(toDay(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('progress updates', () => {
  it('ticks and unticks items, and records phase checks', () => {
    let entry = toggleItem(emptyPlanProgress(), 'w1-d1-1', '2026-11-02')
    expect(entry.done).toEqual({ 'w1-d1-1': '2026-11-02' })
    entry = toggleItem(entry, 'w1-d1-1', '2026-11-03')
    expect(entry.done).toEqual({})
    entry = setCheck(entry, 'p1', 'fail')
    expect(entry.checks).toEqual({ p1: 'fail' })
    expect(setCheck(entry, 'p1', undefined).checks).toEqual({})
  })

  it('adds, edits and removes log entries within the cap', () => {
    const first = { id: 'err-1', at: '2026-11-02', problem: 'A', pattern: '', why: '', fix: '' }
    let list = upsert([], first, MAX_ERRORS)
    list = upsert(list, { ...first, problem: 'B' }, MAX_ERRORS)
    expect(list).toEqual([{ ...first, problem: 'B' }])
    expect(removeEntry(list, 'err-1')).toEqual([])
    expect(() => upsert(list, { ...first, id: 'err-2' }, 1)).toThrow('up to 1')
    expect(newEntryId('err', list)).toMatch(/^err-[a-z0-9-]+$/)
    expect(scoreAverage({ id: 's', at: '2026-11-02', kind: 'dsa', title: 'x', scores: [1, 2, 3, 4], notes: '' })).toBe(2.5)
  })

  it('updates one plan without touching another', () => {
    const state = withPlan({}, plan.id, entry => ({ ...entry, start: '2026-11-02' }))
    expect(state[plan.id].start).toBe('2026-11-02')
    expect(withPlan(state, plan.id, entry => ({ ...entry, track: 'ml-engineer' }))[plan.id]).toMatchObject({ start: '2026-11-02', track: 'ml-engineer' })
  })
})

describe('storage', () => {
  it('round-trips through localStorage', () => {
    const state = started({ track: 'ml-engineer', lang: 'python', done: { 'w1-d1-1': '2026-11-02' }, checks: { p1: 'pass' } })
    expect(writePlans(state)).toBe(true)
    expect(JSON.parse(storage.getItem(PLANS_KEY)!)).toEqual(state)
    expect(readPlans()).toEqual(state)
  })

  it('reads nothing from empty or malformed storage', () => {
    expect(readPlans()).toEqual({})
    storage.setItem(PLANS_KEY, '{not json')
    expect(readPlans()).toEqual({})
    storage.setItem(PLANS_KEY, JSON.stringify({ [plan.id]: { done: 'x' } }))
    expect(readPlans()).toEqual({})
  })

  it('reports a refused write', () => {
    storage.full = true
    expect(writePlans(started())).toBe(false)
  })
})

describe('parsePlans', () => {
  const valid = () => started({
    errors: [{ id: 'err-1', at: '2026-11-02', problem: 'Merge intervals', pattern: 'Sort by start', why: 'Did not sort', fix: 'Ask if order matters' }],
    scores: [{ id: 'score-1', at: '2026-11-08', kind: 'design', title: 'RAG copilot', scores: [3, 3, 2, 4], notes: 'Go deeper on evals.' }],
  })
  it('accepts valid progress', () => expect(parsePlans(valid())).toEqual(valid()))

  it.each([
    ['not an object', []],
    ['unknown plan', { nope: emptyPlanProgress() }],
    ['bad start', { [plan.id]: { ...emptyPlanProgress(), start: '2026-02-30' } }],
    ['unknown language', { [plan.id]: { ...emptyPlanProgress(), lang: 'cobol' } }],
    ['extra field', { [plan.id]: { ...emptyPlanProgress(), extra: 1 } }],
    ['bad item day', { [plan.id]: { ...emptyPlanProgress(), done: { 'w1-d1-1': 'yesterday' } } }],
    ['bad check', { [plan.id]: { ...emptyPlanProgress(), checks: { p1: 'maybe' } } }],
    ['score out of range', { [plan.id]: { ...emptyPlanProgress(), scores: [{ id: 's', at: '2026-11-02', kind: 'dsa', title: 'x', scores: [1, 2, 3, 5], notes: '' }] } }],
    ['empty problem', { [plan.id]: { ...emptyPlanProgress(), errors: [{ id: 'e', at: '2026-11-02', problem: ' ', pattern: '', why: '', fix: '' }] } }],
    ['too many errors', { [plan.id]: { ...emptyPlanProgress(), errors: Array.from({ length: MAX_ERRORS + 1 }, (_, i) => ({ id: `e${i}`, at: '2026-11-02', problem: 'x', pattern: '', why: '', fix: '' })) } }],
  ])('rejects %s', (_, value) => expect(() => parsePlans(value)).toThrow(/^Invalid backup: /))

  it('rejects progress over the size cap', () => {
    const notes = 'x'.repeat(1_000)
    const scores = Array.from({ length: 100 }, (_, i) => ({ id: `s${i}`, at: '2026-11-02', kind: 'dsa', title: 'y'.repeat(300), scores: [1, 1, 1, 1], notes }))
    const errors = Array.from({ length: 300 }, (_, i) => ({ id: `e${i}`, at: '2026-11-02', problem: 'p'.repeat(300), pattern: 'q'.repeat(300), why: 'r'.repeat(300), fix: 's'.repeat(300) }))
    expect(() => parsePlans({ [plan.id]: { ...emptyPlanProgress(), scores, errors } })).toThrow('larger than 500 KB')
  })
})

describe('backups', () => {
  it('imports an old v1 backup unchanged, with no plan progress', () => {
    const parsed = parseFullBackup(JSON.stringify(legacyBackup))
    expect(parsed.plans).toBeUndefined()
    expect(Object.keys(parsed)).toEqual(['progress'])
  })

  it('keeps the old format when there is no plan progress', () => {
    const progress = emptyProgress()
    expect(serializeFullBackup(progress, undefined, [], {})).toBe(serializeBackup(progress))
    expect(serializeFullBackup(progress, undefined, undefined, undefined)).toBe(serializeBackup(progress))
  })

  it('round-trips plan progress, alone and with boards', () => {
    const state = started({ done: { 'w1-d1-1': '2026-11-02' }, checks: { p1: 'pass' } })
    const text = serializeFullBackup(emptyProgress(), undefined, [], state)
    expect(JSON.parse(text).plans).toEqual(state)
    expect(parseFullBackup(text).plans).toEqual(state)
    expect(parseFullBackup(serializeFullBackup(emptyProgress(), [], [], state)).plans).toEqual(state)
  })

  it('rejects invalid or oversized plan progress in a backup', () => {
    const base = JSON.parse(serializeBackup(emptyProgress()))
    expect(() => parseFullBackup(JSON.stringify({ ...base, plans: { nope: emptyPlanProgress() } }))).toThrow('Invalid backup: unknown study plan nope.')
    expect(() => parseFullBackup(JSON.stringify({ ...base, plans: { [plan.id]: { ...emptyPlanProgress(), errors: hugeErrors(), scores: hugeScores() } } }))).toThrow('larger than 500 KB')
  })
})

describe('navigation and search', () => {
  const nav = navIndex as unknown as NavIndex
  it('routes #plans and known plan ids, and nothing else', () => {
    expect(parseHash('#plans', ids)).toEqual({ route: 'plans' })
    expect(parseHash(`#plans/${plan.id}`, ids)).toEqual({ route: 'plans', planId: plan.id })
    expect(hrefFor({ route: 'plans', planId: plan.id })).toBe(`#plans/${plan.id}`)
    expect(parseHash('#plans/nope', ids)).toEqual({ route: 'unknown' })
    expect(parseHash(`#plans/${plan.id}/w1`, ids)).toEqual({ route: 'unknown' })
  })

  it('lists the plan in the tree with a count for the chosen track', () => {
    const progress = emptyProgress()
    const state = started({ done: { 'w1-d1-1': '2026-11-02', 'ml-w8-d1-1': '2026-11-02' } })
    const section = deepSections(progress, nav, state).plans!
    expect(section.children.map(node => node.href)).toEqual([`#plans/${plan.id}`])
    expect(section.count).toEqual({ done: 1, total: planCount(plan, undefined).total })
    expect(deepSections(progress, nav, { [plan.id]: { ...state[plan.id], track: 'ml-engineer' } }).plans!.count!.done).toBe(2)
  })

  it('finds the plan and its weeks in the palette', () => {
    const entries = buildPaletteIndex(nav)
    expect(entries.find(entry => entry.id === `plan:${plan.id}`)).toMatchObject({ kind: 'plan', href: `#plans/${plan.id}` })
    expect(entries.filter(entry => entry.kind === 'plan')).toHaveLength(1 + plan.weeks.length)
    expect(searchPalette(entries, 'study plans')[0].items.map(item => item.href)).toContain('#plans')
    const week8 = entries.find(entry => entry.id === `plan:${plan.id}:w8:ml-engineer`)!
    expect(week8.detail).toContain('ML engineer')
  })
})
