import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import legacyBackup from '../tests/fixtures/v1-progress.json' with { type: 'json' }
import knownItemIds from '../tests/fixtures/plan-item-ids.json' with { type: 'json' }
import knownFdeItemIds from '../tests/fixtures/fde-plan-item-ids.json' with { type: 'json' }
import knownMathItemIds from '../tests/fixtures/math-plan-item-ids.json' with { type: 'json' }
import knownReactItemIds from '../tests/fixtures/react-plan-item-ids.json' with { type: 'json' }
import knownNodeItemIds from '../tests/fixtures/node-plan-item-ids.json' with { type: 'json' }
import knownReactNativeItemIds from '../tests/fixtures/react-native-plan-item-ids.json' with { type: 'json' }
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
  daysBetween, emptyPlanProgress, forLanguage, isDay, itemText, loadPlans, markDone, MAX_ERRORS, newEntryId, parsePlans, PLAN_IDS, PLAN_LANGUAGES, planCount, planHref, planLanguage, PLANS_KEY, positionFor,
  readPlans, removeEntry, SCORE_AREAS, SCORE_KIND_LABELS, scoreAverage, setCheck, toDay, toggleItem, upsert, weekCount, weekItems, weeksFor, withPlan, writePlans,
  type PlansState, type ScoreKind, type StudyPlan,
} from './study-plans'

const plans = plansJson as unknown as StudyPlan[]
const plan = plans.find(item => item.id === 'applied-ai-ml-10wk')!
const fde = plans.find(item => item.id === 'forward-deployed-engineer-8wk')!
const math = plans.find(item => item.id === 'math-for-ml-6wk')!
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
  }, 30_000)

  it('is a 10-week plan in three phases with the Applied AI track first', () => {
    expect(weekCount(plan)).toBe(10)
    expect(plan.phases.map(phase => phase.weeks)).toEqual([[1, 4], [5, 7], [8, 10]])
    expect(plan.tracks.map(track => track.id)).toEqual(['applied-ai', 'ml-engineer'])
    expect(plan.languages).toEqual(['python', 'typescript'])
  })

  it('lists every plan, Applied AI first', () => {
    expect(plans.map(item => item.id)).toEqual(['applied-ai-ml-10wk', 'forward-deployed-engineer-8wk', 'math-for-ml-6wk', 'react-skill-test-2wk', 'node-skill-test-2wk', 'react-native-skill-test-2wk'])
    expect([...PLAN_IDS]).toEqual(plans.map(item => item.id))
  })

  it.each(plans.map(item => [item.id, item] as const))('%s links every item to content that exists, and every link parses with the app router', (_id, plan) => {
    const lessonIds = new Set(lessons.map(lesson => lesson.id))
    for (const item of plan.weeks.flatMap(weekItems)) {
      if (item.lesson) expect(lessonIds.has(item.lesson), item.id).toBe(true)
      if (item.href) {
        const parsed = parseHash(item.href, ids)
        expect(parsed.route, `${item.id} ${item.href}`).not.toBe('unknown')
        expect(hrefFor(parsed), item.href).toBe(item.href)
        for (const lang of PLAN_LANGUAGES) expect(parseHash(planHref(item.href, lang.id), ids).route, `${item.id} ${lang.id}`).toBe(parsed.route)
      }
    }
    for (const lang of plan.languages) expect(parseHash(plan.refresher[lang]!, ids)).toEqual({ route: 'tracks', track: lang })
  })

  it.each(plans.filter(item => item.languages.length > 1).map(item => [item.id, item] as const))('%s only uses the {lang} placeholder and fills it with the language label', (_id, plan) => {
    const items = plan.weeks.flatMap(weekItems)
    const templated = items.find(item => itemText(item, 'python') !== itemText(item, 'typescript'))!
    expect(itemText(templated, 'python')).toContain('Python')
    expect(itemText(templated, 'typescript')).toContain('TypeScript')
    expect(itemText(templated, undefined)).toBe(itemText(templated, 'python'))
    for (const lang of [undefined, ...plan.languages]) for (const item of items) expect(itemText(item, lang), item.id).not.toMatch(/[{}]/)
  })

  it('resolves per-language text, falling back to the default language', () => {
    const item = { id: 'x', minutes: 10, text: { python: 'Use heapq in {lang}.', typescript: 'Write a heap in {lang}.' } }
    expect(itemText(item, 'python')).toBe('Use heapq in Python.')
    expect(itemText(item, 'typescript')).toBe('Write a heap in TypeScript.')
    expect(itemText(item, undefined)).toBe('Use heapq in Python.')
    expect(itemText(item, 'cobol')).toBe('Use heapq in Python.')
    expect(itemText({ ...item, text: { python: 'Only {lang}.' } }, 'typescript')).toBe('Only TypeScript.')
    expect(forLanguage({ python: 1, typescript: 2 }, 'typescript')).toBe(2)
    expect(forLanguage({ python: 1 }, 'typescript')).toBe(1)
    expect(forLanguage(undefined, 'typescript')).toBeUndefined()
    const w3 = plan.weeks.flatMap(weekItems).find(entry => entry.id === 'w3-d4-4')!
    expect(itemText(w3, 'python')).toContain('heapq')
    expect(itemText(w3, 'typescript')).toContain('binary heap')
  })

  it('has idioms for every language, and they differ by language', () => {
    for (const lang of plan.languages) expect(plan.tips[lang]!.length, lang).toBeGreaterThan(3)
    expect(plan.tips.python!.join()).toContain('heapq')
    expect(plan.tips.typescript!.join()).toContain('(a, b) => a - b')
    const tipped = plan.weeks.filter(week => week.tip)
    expect(tipped.map(week => week.n)).toEqual([1, 2, 3, 4, 5, 6, 7])
    for (const week of tipped) expect(forLanguage(week.tip, 'python'), `week ${week.n}`).not.toBe(forLanguage(week.tip, 'typescript'))
  })

  it('opens code problems in the chosen language and leaves other links alone', () => {
    expect(planHref('#code/two-sum', 'python')).toBe('#code/two-sum/py')
    expect(planHref('#code/two-sum', 'typescript')).toBe('#code/two-sum/ts')
    expect(planHref('#code/two-sum', undefined)).toBe('#code/two-sum/py')
    for (const href of ['#code', '#playground', '#patterns/heaps', '#sql/x']) expect(planHref(href, 'typescript')).toBe(href)
    expect(planLanguage('typescript').code).toBe('ts')
    expect(planLanguage(undefined).id).toBe('python')
    expect(planLanguage('cobol').id).toBe('python')
  })

  it('keeps the language list in step with the build script', () => {
    expect(PLAN_LANGUAGES.map(lang => lang.id)).toEqual(BUILD_LANGUAGES)
  })

  it('has no personal or employer details', () => {
    const text = JSON.stringify(plans)
    for (const word of ['Microsoft', 'EntityServe', 'Polymer', 'Fitto', 'Substrate']) expect(text).not.toContain(word)
    for (const href of plans.flatMap(item => item.weeks.flatMap(weekItems)).map(item => item.href ?? '')) expect(href).not.toMatch(/^#(company|mock)\//)
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
    const repeated = copy()
    repeated.languages = ['python', 'python']
    expect(() => validatePlan(repeated, plan.id, opts)).toThrow('must not repeat')
    const missingTips = copy()
    delete missingTips.tips.typescript
    expect(() => validatePlan(missingTips, plan.id, opts)).toThrow('tips need 1–8 short strings for each of python, typescript')
    const extraTips = copy()
    extraTips.tips = { ...extraTips.tips, cobol: ['x'] } as StudyPlan['tips']
    expect(() => validatePlan(extraTips, plan.id, opts)).toThrow('tips need')
    const longTip = copy()
    longTip.tips.python = ['x'.repeat(201)]
    expect(() => validatePlan(longTip, plan.id, opts)).toThrow('tips need')
    const badRefresher = copy()
    badRefresher.refresher.typescript = '#tracks/nope'
    expect(() => validatePlan(badRefresher, plan.id, opts)).toThrow('refresher')
    const oneWeekTip = copy()
    oneWeekTip.weeks[0].tip = { python: 'Only Python.' }
    expect(() => validatePlan(oneWeekTip, plan.id, opts)).toThrow('week 1: tip needs')
    const stringTip = copy()
    stringTip.weeks[0].tip = 'Not per language.' as unknown as StudyPlan['weeks'][number]['tip']
    expect(() => validatePlan(stringTip, plan.id, opts)).toThrow('week 1: tip needs')
    const halfText = copy()
    halfText.weeks[0].days[0].items[0].text = { python: 'Only Python.' }
    expect(() => validatePlan(halfText, plan.id, opts)).toThrow('one such text per language')
    const badPlaceholder = copy()
    badPlaceholder.weeks[0].days[0].items[0].text = { python: 'Fine.', typescript: 'Use {language}.' }
    expect(() => validatePlan(badPlaceholder, plan.id, opts)).toThrow('{lang} placeholder')
    const perLanguage = copy()
    perLanguage.weeks[0].days[0].items[0].text = { python: 'In {lang}.', typescript: 'In {lang} too.' }
    expect(validatePlan(perLanguage, plan.id, opts)).toBeTruthy()
    const pythonOnly = copy()
    pythonOnly.languages = ['python']
    expect(() => validatePlan(pythonOnly, plan.id, opts)).toThrow('tips need 1–8 short strings for each of python')
  })
})

describe.each([['applied-ai-ml-10wk', knownItemIds], ['forward-deployed-engineer-8wk', knownFdeItemIds], ['math-for-ml-6wk', knownMathItemIds], ['react-skill-test-2wk', knownReactItemIds], ['node-skill-test-2wk', knownNodeItemIds], ['react-native-skill-test-2wk', knownReactNativeItemIds]] as const)('plan item id registry for %s', (id, known) => {
  const current = new Set(plans.find(item => item.id === id)!.weeks.flatMap(weekItems).map(item => item.id))
  it('keeps every item id that has ever shipped', () => expect(known.filter(itemId => !current.has(itemId))).toEqual([]))
  it('records every current item id', () => expect([...current].filter(itemId => !(known as readonly string[]).includes(itemId))).toEqual([]))
  it('has a registry for every plan', () => expect(plans.map(item => item.id)).toContain(id))
})

describe('the Forward Deployed Engineer plan', () => {
  const items = fde.weeks.flatMap(weekItems)
  const hrefs = new Set(items.map(item => item.href))
  it('is an 8-week plan in three phases, Python first with TypeScript too', () => {
    expect(fde.title).toBe('8-week Forward Deployed Engineer plan')
    expect(fde.hoursPerWeek).toBe('8–10')
    expect(weekCount(fde)).toBe(8)
    expect(fde.phases.map(phase => phase.weeks)).toEqual([[1, 2], [3, 5], [6, 8]])
    expect(fde.languages).toEqual(['python', 'typescript'])
    expect(fde.tracks.map(track => track.id)).toEqual(['llm-apps', 'data-integration'])
  })

  it('shares weeks 1–5 and 8, and swaps weeks 6–7 with the track', () => {
    const llm = weeksFor(fde, 'llm-apps')
    const data = weeksFor(fde, 'data-integration')
    expect(llm.map(week => week.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(data.map(week => week.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(llm.slice(0, 5)).toEqual(data.slice(0, 5))
    expect(llm[7]).toEqual(data[7])
    for (const n of [6, 7]) expect(weekItems(llm[n - 1]).map(item => item.id)).not.toEqual(weekItems(data[n - 1]).map(item => item.id))
    expect(weekItems(data[5])[0].id).toBe('di-w6-d1-1')
  })

  it('links the customer-engineering guides, the cleanup problem, SQL, design cases and stories', () => {
    for (const href of ['#guide/customer-discovery-scoping', '#guide/decomposition-case-interview', '#guide/messy-data-integration', '#guide/rapid-prototyping-demos', '#guide/on-site-deployment-debugging',
      '#code/latest-customer-records', '#sql/dedupe-mailing-list-signups', '#design/rag-doc-copilot', '#design/support-agent', '#stories', '#playground']) expect(hrefs, href).toContain(href)
    expect(items.some(item => item.lesson?.startsWith('behavioral-'))).toBe(true)
  })

  it('has idioms and week tips that differ by language', () => {
    expect(fde.tips.python!.join()).toContain('ValueError')
    expect(fde.tips.typescript!.join()).toContain('Number.isFinite')
    const tipped = fde.weeks.filter(week => week.tip)
    expect(tipped.length).toBeGreaterThanOrEqual(5)
    for (const week of tipped) expect(forLanguage(week.tip, 'python'), `week ${week.n}`).not.toBe(forLanguage(week.tip, 'typescript'))
    const code = items.find(item => item.href === '#code/latest-customer-records')!
    expect(itemText(code, 'typescript')).toContain('TypeScript')
    expect(planHref(code.href!, 'typescript')).toBe('#code/latest-customer-records/ts')
  })

  it('keeps every week inside the 8–10 hour budget', () => {
    for (const track of fde.tracks) for (const week of weeksFor(fde, track.id)) {
      const minutes = weekItems(week).reduce((sum, item) => sum + item.minutes, 0)
      expect(minutes / 60, `week ${week.n} ${track.id}`).toBeGreaterThanOrEqual(6)
      expect(minutes / 60, `week ${week.n} ${track.id}`).toBeLessThanOrEqual(10.5)
    }
  })
})

describe('the Math for AI and ML plan', () => {
  const items = math.weeks.flatMap(weekItems)
  it('is a 6-week Python plan in three phases with no tracks', () => {
    expect(math.title).toBe('6-week Math for AI and ML plan')
    expect(math.hoursPerWeek).toBe('6–8')
    expect(weekCount(math)).toBe(6)
    expect(math.phases.map(phase => phase.weeks)).toEqual([[1, 2], [3, 4], [5, 6]])
    expect(math.languages).toEqual(['python'])
    expect(math.tracks).toEqual([])
    expect(weeksFor(math, undefined)).toHaveLength(6)
    expect(planCount(math, undefined).total).toBe(items.length)
  })

  it('links every math lab once, in order, and the related lessons, guides and plans', () => {
    const labs = items.filter(item => item.href?.startsWith(`#plans/${math.id}/`)).map(item => item.href!.split('/')[2])
    expect(labs).toEqual(JSON.parse(readFileSync('content/math/index.json', 'utf8')).labs)
    const hrefs = new Set(items.map(item => item.href))
    for (const href of ['#plans/applied-ai-ml-10wk', '#plans/forward-deployed-engineer-8wk', '#guide/ml-experimentation', '#guide/llm-evals', '#cards', '#playground', '#mock']) expect(hrefs, href).toContain(href)
    expect(items.filter(item => item.lesson).length).toBeGreaterThanOrEqual(10)
  })

  it('keeps every week inside the 6–8 hour budget', () => {
    for (const week of math.weeks) {
      const hours = weekItems(week).reduce((sum, item) => sum + item.minutes, 0) / 60
      expect(hours, `week ${week.n}`).toBeGreaterThanOrEqual(6)
      expect(hours, `week ${week.n}`).toBeLessThanOrEqual(8)
    }
  })
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

  it('marks items done without unticking or redating them', () => {
    const entry = toggleItem(emptyPlanProgress(), 'w1-d1-1', '2026-11-02')
    expect(markDone(entry, ['w1-d1-1', 'w1-d2-1'], '2026-11-05').done).toEqual({ 'w1-d1-1': '2026-11-02', 'w1-d2-1': '2026-11-05' })
    expect(markDone(entry, [], '2026-11-05')).toEqual(entry)
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

  it('keeps the TypeScript choice, and reads old progress without a language as Python', () => {
    const state = started({ lang: 'typescript' })
    expect(writePlans(state)).toBe(true)
    expect(readPlans()[plan.id].lang).toBe('typescript')
    const old = started()
    expect(old[plan.id].lang).toBeUndefined()
    storage.setItem(PLANS_KEY, JSON.stringify(old))
    expect(readPlans()[plan.id].lang).toBeUndefined()
    expect(planLanguage(readPlans()[plan.id].lang).id).toBe('python')
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
  it('accepts each plan language', () => {
    for (const lang of PLAN_LANGUAGES) expect(parsePlans(started({ lang: lang.id }))[plan.id].lang).toBe(lang.id)
  })
  it('accepts every scorecard kind, including the customer case', () => {
    expect(SCORE_KIND_LABELS.case).toBe('Customer case')
    expect(SCORE_AREAS.case).toEqual(['Problem framing', 'Decomposition', 'Technical depth', 'Communication'])
    for (const kind of Object.keys(SCORE_AREAS) as ScoreKind[]) {
      const state = started({ scores: [{ id: 's', at: '2026-11-02', kind, title: 'x', scores: [1, 2, 3, 4], notes: '' }] })
      expect(parsePlans(state)).toEqual(state)
    }
  })

  it.each([
    ['not an object', []],
    ['unknown plan', { nope: emptyPlanProgress() }],
    ['bad start', { [plan.id]: { ...emptyPlanProgress(), start: '2026-02-30' } }],
    ['unknown language', { [plan.id]: { ...emptyPlanProgress(), lang: 'cobol' } }],
    ['language in the wrong case', { [plan.id]: { ...emptyPlanProgress(), lang: 'TypeScript' } }],
    ['language that is not a string', { [plan.id]: { ...emptyPlanProgress(), lang: 1 } }],
    ['extra field', { [plan.id]: { ...emptyPlanProgress(), extra: 1 } }],
    ['bad item day', { [plan.id]: { ...emptyPlanProgress(), done: { 'w1-d1-1': 'yesterday' } } }],
    ['bad check', { [plan.id]: { ...emptyPlanProgress(), checks: { p1: 'maybe' } } }],
    ['score out of range', { [plan.id]: { ...emptyPlanProgress(), scores: [{ id: 's', at: '2026-11-02', kind: 'dsa', title: 'x', scores: [1, 2, 3, 5], notes: '' }] } }],
    ['unknown score kind', { [plan.id]: { ...emptyPlanProgress(), scores: [{ id: 's', at: '2026-11-02', kind: 'toString', title: 'x', scores: [1, 2, 3, 4], notes: '' }] } }],
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
    const typescript = started({ lang: 'typescript', done: { 'w3-d4-4': '2026-11-20' } })
    expect(parseFullBackup(serializeFullBackup(emptyProgress(), undefined, [], typescript)).plans).toEqual(typescript)
  })

  it('round-trips progress in two plans at once, with a customer case scorecard', () => {
    const state: PlansState = {
      ...started({ done: { 'w1-d1-1': '2026-11-02' } }),
      [fde.id]: { ...emptyPlanProgress(), start: '2026-11-09', track: 'data-integration', lang: 'typescript', done: { 'di-w6-d1-1': '2026-12-14' }, checks: { p1: 'pass' },
        scores: [{ id: 'score-1', at: '2026-11-15', kind: 'case', title: 'AI for a support inbox', scores: [3, 2, 3, 4], notes: '' }] },
    }
    expect(parseFullBackup(serializeFullBackup(emptyProgress(), undefined, [], state)).plans).toEqual(state)
    expect(writePlans(state)).toBe(true)
    expect(readPlans()).toEqual(state)
  })

  it('rejects an unknown language in a backup', () => {
    const base = JSON.parse(serializeBackup(emptyProgress()))
    expect(() => parseFullBackup(JSON.stringify({ ...base, plans: { [plan.id]: { ...emptyPlanProgress(), lang: 'rust' } } }))).toThrow(/^Invalid backup: /)
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
    expect(parseHash(`#plans/${plan.id}/w1/d1`, ids)).toEqual({ route: 'unknown' })
    expect(parseHash('#plans/nope/vector-norms', ids)).toEqual({ route: 'unknown' })
    expect(parseHash(`#plans/${math.id}/Not_A_Lab`, ids)).toEqual({ route: 'unknown' })
    expect(parseHash(`#plans/${math.id}/vector-norms`, ids)).toEqual({ route: 'plans', planId: math.id, labId: 'vector-norms' })
    expect(hrefFor({ route: 'plans', planId: math.id, labId: 'vector-norms' })).toBe(`#plans/${math.id}/vector-norms`)
  })

  it('lists the plan in the tree with a count for the chosen track', () => {
    const progress = emptyProgress()
    const state = started({ done: { 'w1-d1-1': '2026-11-02', 'ml-w8-d1-1': '2026-11-02' } })
    const section = deepSections(progress, nav, state).plans!
    expect(section.children.map(node => node.href)).toEqual(plans.map(item => `#plans/${item.id}`))
    expect(section.count).toEqual({ done: 1, total: plans.reduce((sum, item) => sum + planCount(item, undefined).total, 0) })
    expect(deepSections(progress, nav, { [plan.id]: { ...state[plan.id], track: 'ml-engineer' } }).plans!.count!.done).toBe(2)
    const both = { ...state, [fde.id]: { ...emptyPlanProgress(), done: { 'w1-d1-1': '2026-11-09', 'di-w6-d1-1': '2026-11-09' } } }
    expect(deepSections(progress, nav, both).plans!.count!.done).toBe(2)
    expect(deepSections(progress, nav, { ...both, [fde.id]: { ...both[fde.id], track: 'data-integration' } }).plans!.count!.done).toBe(3)
  })

  it('finds both plans and their weeks in the palette', () => {
    const entries = buildPaletteIndex(nav)
    expect(entries.find(entry => entry.id === `plan:${plan.id}`)).toMatchObject({ kind: 'plan', href: `#plans/${plan.id}` })
    expect(entries.find(entry => entry.id === `plan:${fde.id}`)).toMatchObject({ kind: 'plan', href: `#plans/${fde.id}`, detail: 'Study plan · 8 weeks' })
    expect(entries.filter(entry => entry.kind === 'plan')).toHaveLength(plans.reduce((sum, item) => sum + 1 + item.weeks.length, 0))
    expect(searchPalette(entries, 'study plans')[0].items.map(item => item.href)).toContain('#plans')
    expect(searchPalette(entries, 'forward deployed').flatMap(group => group.items.map(item => item.href))).toContain(`#plans/${fde.id}`)
    expect(searchPalette(entries, 'fde').flatMap(group => group.items.map(item => item.href))).toContain('#plans')
    const week8 = entries.find(entry => entry.id === `plan:${plan.id}:w8:ml-engineer`)!
    expect(week8.detail).toContain('ML engineer')
    expect(entries.find(entry => entry.id === `plan:${fde.id}:w6:data-integration`)!.detail).toContain('Data integration')
  })
})
