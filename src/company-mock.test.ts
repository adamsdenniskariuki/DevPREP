import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import legacyBackup from '../tests/fixtures/v1-progress.json' with { type: 'json' }
import { loadCases } from './cases'
import { companyIds, loadCompanies } from './companies'
import { buildCompanyMock } from './company-mock'
import type { Company } from './company-types'
import { validateCompany } from './content-schema'
import { caseIds } from './cases'
import { companyMockXp, gameStats } from './gamification'
import { mockScore, SSE_STAR_RUBRIC } from './mocks'
import { patternIds } from './patterns'
import { COMPANY_MOCK_LEAD, planStudy } from './planner'
import { problemIds, loadProblems } from './problems'
import { emptyProgress, parseBackup, recordCompanyMock, recordCompanyRun, serializeBackup, updateProfile } from './progress'

const at = new Date('2026-10-01T10:00:00.000Z')
const refs = { problems: problemIds, patterns: patternIds, cases: caseIds }
const read = (id: string) => JSON.parse(readFileSync(`content/companies/${id}.json`, 'utf8')) as Company

describe('company mock content', () => {
  it.each(['stripe', 'uber', 'safaricom'])('%s is a shipped company with a valid page', id => {
    expect(companyIds).toContain(id)
    expect(validateCompany(read(id), id, refs)).toEqual([])
  })

  it('every company has a mock loop with a coding round that its content can fill', () => {
    for (const id of companyIds) {
      const { mock, practice, design, values } = read(id)
      expect(mock.rounds.length).toBeGreaterThanOrEqual(2)
      expect(mock.rounds.some(round => round.kind === 'coding')).toBe(true)
      expect(mock.rounds.filter(round => round.kind === 'coding').length).toBeLessThanOrEqual(practice.problems.length)
      expect(mock.rounds.filter(round => round.kind === 'design').length).toBeLessThanOrEqual(design.cases.length)
      expect(mock.rounds.filter(round => round.kind === 'behavioural').length).toBeLessThanOrEqual(values.prompts.length)
    }
  })

  it('rejects malformed mock loops', () => {
    const good = read('google')
    const check = (mock: unknown) => validateCompany({ ...good, mock }, 'co', refs)
    expect(check(undefined)).toContain('co.mock: expected object')
    expect(check({ note: 'x', rounds: [{ kind: 'coding', minutes: 45 }] })).toContain('co.mock.rounds: expected 2–6 rounds')
    expect(check({ note: 'x', rounds: [{ kind: 'design', minutes: 45 }, { kind: 'behavioural', minutes: 30 }] })).toContain('co.mock.rounds: expected at least 1 coding round')
    expect(check({ note: 'x', rounds: [{ kind: 'coding', minutes: 5 }, { kind: 'lunch', minutes: 30 }] })).toEqual(expect.arrayContaining([
      'co.mock.rounds[0].minutes: expected integer 10–60', 'co.mock.rounds[1].kind: expected coding, design or behavioural',
    ]))
    const many = Array.from({ length: 5 }, () => ({ kind: 'design', minutes: 45 }))
    expect(check({ note: 'x', rounds: [{ kind: 'coding', minutes: 45 }, ...many] })).toContain('co.mock.rounds: more design rounds than items to draw from')
  })
})

describe('buildCompanyMock', async () => {
  const [companies, problems, cases] = await Promise.all([loadCompanies(), loadProblems(), loadCases()])
  const data = { problems, cases }

  it.each([...companyIds])('%s follows the company format with distinct, valid picks', id => {
    const company = companies.get(id)!
    const mock = buildCompanyMock(company, 'se', 42, data)
    expect(mock.rounds.map(round => round.kind)).toEqual(company.mock.rounds.map(round => round.kind))
    expect(mock.minutes).toBe(company.mock.rounds.reduce((sum, round) => sum + round.minutes, 0))
    expect(mock.questions).toEqual(mock.rounds.map(round => round.question))
    const coding = mock.rounds.filter(round => round.kind === 'coding').map(round => round.question)
    expect(coding.every(question => question.kind === 'problem' && company.practice.problems.includes(question.ref))).toBe(true)
    expect(new Set(coding.map(question => question.ref)).size).toBe(coding.length)
    for (const round of mock.rounds.filter(item => item.kind === 'design')) expect(company.design.cases).toContain(round.question.ref)
    for (const round of mock.rounds.filter(item => item.kind === 'behavioural')) {
      expect(round.question.kind).toBe('behavioral')
      expect(company.values.prompts.map(prompt => prompt.id)).toContain(round.question.ref)
    }
    for (const question of mock.questions) expect(question.rubric.length).toBeGreaterThan(0)
  })

  it('is deterministic per seed, varies across seeds and adds the senior rubric at SSE', () => {
    const amazon = companies.get('amazon')!
    expect(buildCompanyMock(amazon, 'se', 7, data)).toEqual(buildCompanyMock(amazon, 'se', 7, data))
    const refsFor = (seed: number) => buildCompanyMock(amazon, 'se', seed, data).questions.map(question => question.ref).join()
    expect(new Set([1, 2, 3, 4, 5, 6, 7, 8].map(refsFor)).size).toBeGreaterThan(1)
    const senior = buildCompanyMock(amazon, 'sse', 7, data)
    expect(senior.rounds.find(round => round.kind === 'behavioural')!.question.rubric).toContain(SSE_STAR_RUBRIC)
  })

  it('scores with the shared mock rubric scorer', () => {
    const mock = buildCompanyMock(companies.get('stripe')!, 'se', 3, data)
    expect(mockScore(mock, [])).toBe(0)
    expect(mockScore(mock, mock.questions.map(question => question.rubric.map(() => true)))).toBe(100)
  })
})

describe('company mock results', () => {
  const result = { level: 'se' as const, percent: 85, minutes: 160, rounds: 4 }

  it('earn XP and the first-company-mock badge, count as practice days, and survive a backup round-trip', () => {
    const start = emptyProgress(at)
    const one = recordCompanyMock(start, 'stripe', result, at)
    const two = recordCompanyMock(one, 'stripe', { ...result, percent: 40 }, at)
    expect(companyMockXp(one) - companyMockXp(start)).toBe(40)
    expect(companyMockXp(two) - companyMockXp(one)).toBe(30)
    expect(gameStats(two, at).xp - gameStats(start, at).xp).toBe(70)
    const badge = (progress: typeof start) => gameStats(progress, at).badges.find(item => item.id === 'first-company-mock')?.earned
    expect(badge(start)).toBe(false)
    expect(badge(one)).toBe(true)
    expect(gameStats(one, at).streak.current).toBe(1)
    expect(parseBackup(serializeBackup(two)).companyMocks).toEqual(two.companyMocks)
    expect(two.companyMocks?.stripe.map(item => item.percent)).toEqual([85, 40])
  })

  it('clamps input, keeps the latest 20 and rejects unknown companies or bad scores', () => {
    let progress = emptyProgress(at)
    for (let index = 0; index < 22; index++) progress = recordCompanyMock(progress, 'uber', { ...result, percent: index, minutes: 9_999, rounds: 0 }, at)
    expect(progress.companyMocks?.uber).toHaveLength(20)
    expect(progress.companyMocks?.uber[0]).toMatchObject({ percent: 2, minutes: 600, rounds: 1 })
    expect(() => recordCompanyMock(progress, 'acme', result)).toThrow('Unknown company')
    expect(() => recordCompanyMock(progress, 'uber', { ...result, percent: 50.5 })).toThrow()
  })

  it('rejects malformed results in backups and still imports old backups, including PR 1-shaped company data', () => {
    const pr1 = recordCompanyRun(emptyProgress(at), 'google', { seconds: 60, done: 1, total: 2 }, at)
    const base = JSON.parse(serializeBackup(pr1)) as Record<string, unknown>
    expect(base.companyMocks).toBeUndefined()
    const imported = parseBackup(JSON.stringify(base))
    expect(imported.companies).toEqual(pr1.companies)
    expect(imported.companyMocks).toBeUndefined()
    expect(imported.profile?.targetCompany).toBeUndefined()
    expect(parseBackup(JSON.stringify(legacyBackup)).companyMocks).toBeUndefined()
    const entry = { at: at.toISOString(), ...result }
    const load = (companyMocks: unknown) => () => parseBackup(JSON.stringify({ ...base, companyMocks }))
    expect(load({ acme: [entry] })).toThrow('unknown company')
    expect(load({ google: [] })).toThrow('invalid company mock history')
    expect(load({ google: [{ ...entry, level: 'staff' }] })).toThrow('unknown company mock level')
    expect(load({ google: [{ ...entry, percent: 101 }] })).toThrow()
    expect(load({ google: [{ ...entry, extra: 1 }] })).toThrow()
    expect(load({ google: [entry] })().companyMocks).toEqual({ google: [entry] })
  })

  it('stores the target company in the profile and backups', () => {
    const progress = updateProfile(emptyProgress(at), { targetCompany: 'safaricom' })
    expect(progress.profile?.targetCompany).toBe('safaricom')
    expect(parseBackup(serializeBackup(progress)).profile?.targetCompany).toBe('safaricom')
    expect(updateProfile(progress, { targetCompany: undefined }).profile?.targetCompany).toBeUndefined()
    expect(updateProfile(progress, { targetCompany: 'acme' }).profile?.targetCompany).toBeUndefined()
    const base = JSON.parse(serializeBackup(progress)) as { profile: Record<string, unknown> }
    expect(() => parseBackup(JSON.stringify({ ...base, profile: { ...base.profile, targetCompany: 'acme' } }))).toThrow('unknown target company')
  })
})

describe('planner with a target company', async () => {
  const companies = await loadCompanies()
  const stripe = companies.get('stripe')!
  const today = '2026-10-01'
  const dated = updateProfile(emptyProgress(at), { interviewDate: '2026-10-15' })

  it('leaves plans without a company unchanged', () => {
    for (const progress of [emptyProgress(at), dated]) {
      const plan = planStudy(progress, today)
      expect(planStudy(progress, today, undefined)).toEqual(plan)
      expect(plan.days.flatMap(day => day.items).some(item => item.kind === 'values' || item.kind === 'company-mock')).toBe(false)
    }
  })

  it('adds the practice set, values prompts and a mock loop a few days before the interview', () => {
    const plan = planStudy(dated, today, stripe)
    const items = plan.days.flatMap(day => day.items)
    const mocks = plan.days.filter(day => day.items.some(item => item.kind === 'company-mock'))
    expect(mocks.map(day => day.day)).toEqual(['2026-10-12'])
    expect(COMPANY_MOCK_LEAD).toBe(3)
    expect(mocks[0].items.find(item => item.kind === 'company-mock')).toEqual({ kind: 'company-mock', ref: 'stripe', title: 'Stripe mock loop', minutes: 175 })
    const values = items.filter(item => item.kind === 'values')
    expect(values.length).toBe(stripe.values.prompts.length)
    expect(values.every(item => item.ref === 'stripe')).toBe(true)
    const problems = items.filter(item => item.kind === 'problem')
    expect(problems.length).toBeGreaterThanOrEqual(stripe.practice.count)
    expect(problems.slice(0, 3).every(item => stripe.practice.problems.includes(item.ref!) && item.title.startsWith('Stripe set: '))).toBe(true)
    expect(plan.days.at(-1)!.items.some(item => item.kind === 'company-mock' || item.kind === 'values')).toBe(false)
    const base = planStudy(dated, today)
    expect(items.filter(item => item.kind === 'lesson')).toEqual(base.days.flatMap(day => day.items).filter(item => item.kind === 'lesson'))
  })

  it('puts the mock loop on the last day of an undated week, or today when the interview is close', () => {
    const week = planStudy(emptyProgress(at), today, stripe)
    expect(week.days.findIndex(day => day.items.some(item => item.kind === 'company-mock'))).toBe(week.days.length - 1)
    const soon = planStudy(updateProfile(emptyProgress(at), { interviewDate: '2026-10-02' }), today, stripe)
    expect(soon.days[0].items.some(item => item.kind === 'company-mock')).toBe(true)
    const solved = Object.fromEntries(stripe.practice.problems.map(id => [id, { js: at.toISOString() }]))
    const done = planStudy({ ...dated, solved }, today, stripe).days.flatMap(day => day.items).filter(item => item.kind === 'problem')
    expect(done.some(item => stripe.practice.problems.includes(item.ref!))).toBe(false)
  })
})
