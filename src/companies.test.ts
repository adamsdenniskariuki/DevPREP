import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import knownIds from '../tests/fixtures/company-ids.json' with { type: 'json' }
import legacyBackup from '../tests/fixtures/v1-progress.json' with { type: 'json' }
import { caseIds } from './cases'
import { companyIds, loadCompanies } from './companies'
import { describeFocus, describeLoop, FOCUS_W, layoutFocus, layoutLoop, LOOP_W } from './company-layout'
import { COMPANY_KEY, MAX_NOTE, pickProblems, readLocal, setNote, writeLocal } from './company-notes'
import type { Company } from './company-types'
import { validateCompany } from './content-schema'
import { gameStats } from './gamification'
import { patternIds } from './patterns'
import { problemIds } from './problems'
import { emptyProgress, parseBackup, recordCompanyRun, serializeBackup } from './progress'

const dir = 'content/companies'
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as unknown
const files = readdirSync(dir).filter(name => name.endsWith('.json') && name !== 'index.json')
const companies = files.map(name => read(join(dir, name)) as Company)
const refs = { problems: problemIds, patterns: patternIds, cases: caseIds }

describe('company content', () => {
  it('index.json lists exactly the company files, in a stable order', () => {
    const { companies: order } = read(join(dir, 'index.json')) as { companies: string[] }
    expect([...order].sort()).toEqual(files.map(name => name.replace(/\.json$/, '')).sort())
    expect([...companyIds]).toEqual(order)
  })

  it.each(files)('%s is valid, links real problems, patterns and cases, and its id matches the file', name => {
    const item = read(join(dir, name)) as Company
    expect(validateCompany(item, name, refs)).toEqual([])
    expect(item.id).toBe(name.replace(/\.json$/, ''))
  })

  it('cites an official source for every company and marks every stage official or reported', () => {
    for (const company of companies) {
      expect(company.sources.some(source => source.kind === 'official')).toBe(true)
      for (const stage of company.process.stages) expect(['official', 'reported']).toContain(stage.basis)
    }
  })

  it('lazy-loads the same companies the index lists', async () => {
    const loaded = await loadCompanies()
    expect([...loaded.keys()]).toEqual([...companyIds])
  })

  it('rejects malformed companies with readable errors', () => {
    const [good] = companies
    const bad = {
      ...good, id: 'Bad', asOf: 'October 2026',
      sources: [{ title: 'Blog', url: 'http://example.com', kind: 'community' }],
      practice: { ...good.practice, problems: ['nope', ...good.practice.problems.slice(1)] },
      values: { ...good.values, prompts: good.values.prompts.slice(0, 2) },
    }
    expect(validateCompany(bad, 'co', refs)).toEqual(expect.arrayContaining([
      'co.id: expected kebab-case id',
      'co.asOf: expected YYYY-MM',
      'co.sources[0].url: expected https URL',
      'co.sources: expected at least 1 official source',
      'co.practice.problems[0]: unknown id nope',
    ]))
    expect(validateCompany(bad, 'co', refs)).toContain('co.values.prompts: expected at least 3 prompts')
  })
})

// Company IDs are stored in backups (the "companies" map). Append-only, like lesson IDs.
describe('company id registry', () => {
  const current = new Set(companies.map(item => item.id))
  it('keeps every company id that has ever shipped', () => expect(knownIds.filter(id => !current.has(id))).toEqual([]))
  it('records every current company id', () => expect([...current].filter(id => !knownIds.includes(id))).toEqual([]))
})

describe('company diagrams', () => {
  it.each(companies.map(item => [item.id, item] as const))('%s loop and focus layouts fit their width and describe every row', (_id, company) => {
    const loop = layoutLoop(company)
    expect(loop.stages).toHaveLength(company.process.stages.length)
    for (const stage of loop.stages) for (const line of stage.lines) expect(line.length).toBeLessThanOrEqual(40)
    for (let index = 1; index < loop.stages.length; index++) expect(loop.stages[index].top).toBeGreaterThanOrEqual(loop.stages[index - 1].top + loop.stages[index - 1].height)
    expect(loop.width).toBe(LOOP_W)
    expect(describeLoop(company)).toHaveLength(company.process.stages.length)
    const focus = layoutFocus(company)
    expect(focus.width).toBe(FOCUS_W)
    expect(focus.rows).toHaveLength(company.focus.length)
    for (const row of focus.rows) expect(row.width).toBeGreaterThan(0)
    expect(describeFocus(company)).toHaveLength(company.focus.length)
  })
})

describe('company notes and practice picks', () => {
  const company = { practice: { minutes: 45, count: 2, problems: ['a', 'b', 'c', 'd', 'e'], patterns: ['x', 'y'] } }

  it('rotates through the set and puts unsolved problems first', () => {
    expect(pickProblems(company, () => false, 0)).toEqual(['a', 'b'])
    expect(pickProblems(company, () => false, 1)).toEqual(['c', 'd'])
    expect(pickProblems(company, () => false, 2)).toEqual(['e', 'a'])
    expect(pickProblems(company, id => id === 'c', 1)).toEqual(['d', 'e'])
    expect(pickProblems(company, () => true, 0)).toEqual(['a', 'b'])
  })

  it('reads local state tolerantly and round-trips notes and the active run', () => {
    const store = new Map<string, string>()
    const storage = { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => void store.set(key, value) }
    expect(readLocal(storage)).toEqual({ notes: {} })
    store.set(COMPANY_KEY, '{not json')
    expect(readLocal(storage)).toEqual({ notes: {} })
    store.set(COMPANY_KEY, JSON.stringify({ notes: { google: { a: 'ok', b: 7, c: 'x'.repeat(MAX_NOTE + 1) }, meta: 'nope' }, run: { companyId: 'google' } }))
    expect(readLocal(storage)).toEqual({ notes: { google: { a: 'ok' } } })
    const run = { companyId: 'google', problems: ['a'], minutes: 45, startedAt: 1, done: [] }
    const state = setNote({ notes: {}, run }, 'google', 'conflict', 'Situation…')
    expect(writeLocal(state, storage)).toBe(true)
    expect(readLocal(storage)).toEqual(state)
    expect(setNote(state, 'google', 'conflict', '  ')).toEqual({ notes: {}, run })
    expect(setNote(state, 'google', 'x', 'y'.repeat(MAX_NOTE + 50)).notes.google.x).toHaveLength(MAX_NOTE)
    expect(writeLocal(state, { setItem: () => { throw new Error('full') } })).toBe(false)
  })
})

describe('company practice runs', () => {
  const at = new Date('2026-10-01T10:00:00.000Z')

  it('earn XP, streak days and badges, and survive a backup round-trip', () => {
    const start = emptyProgress(at)
    const one = recordCompanyRun(start, 'google', { seconds: 1800, done: 1, total: 2 }, at)
    const two = recordCompanyRun(one, 'google', { seconds: 2400, done: 2, total: 2 }, at)
    const three = recordCompanyRun(recordCompanyRun(two, 'meta', { seconds: 60, done: 0, total: 2 }, at), 'amazon', { seconds: 60, done: 2, total: 2 }, at)
    const xp = (progress: typeof start) => gameStats(progress, at).xp
    expect(xp(one) - xp(start)).toBe(20)
    expect(xp(two) - xp(one)).toBe(5)
    expect(gameStats(one, at).streak.current).toBe(1)
    const badge = (progress: typeof start, id: string) => gameStats(progress, at).badges.find(item => item.id === id)?.earned
    expect(badge(start, 'first-company')).toBe(false)
    expect(badge(one, 'first-company')).toBe(true)
    expect(badge(two, 'companies-3')).toBe(false)
    expect(badge(three, 'companies-3')).toBe(true)
    expect(parseBackup(serializeBackup(three)).companies).toEqual(three.companies)
    expect(() => recordCompanyRun(start, 'acme', { seconds: 1, done: 0, total: 1 })).toThrow('Unknown company')
  })

  it('keeps only the latest runs per company', () => {
    let progress = emptyProgress(at)
    for (let index = 0; index < 25; index++) progress = recordCompanyRun(progress, 'apple', { seconds: index, done: 0, total: 2 }, at)
    expect(progress.companies?.apple).toHaveLength(20)
    expect(progress.companies?.apple[0].seconds).toBe(5)
  })

  it('rejects unknown companies and malformed runs in backups, and still imports old backups', () => {
    const base = JSON.parse(serializeBackup(emptyProgress(at))) as Record<string, unknown>
    const run = { at: at.toISOString(), seconds: 60, done: 1, total: 2 }
    const load = (companies: unknown) => () => parseBackup(JSON.stringify({ ...base, companies }))
    expect(load({ acme: [run] })).toThrow('unknown company')
    expect(load({ google: [] })).toThrow('invalid company practice runs')
    expect(load({ google: [{ ...run, done: 3 }] })).toThrow()
    expect(load({ google: [{ ...run, extra: 1 }] })).toThrow()
    expect(load({ google: [run] })().companies).toEqual({ google: [run] })
    expect(parseBackup(JSON.stringify(legacyBackup)).companies).toBeUndefined()
  })
})
