import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import knownIds from '../tests/fixtures/case-ids.json' with { type: 'json' }
import type { DesignCase } from './case-types'
import { caseIndex, loadCases } from './cases'
import { validateCase } from './content-schema'
import { lessons } from './curriculum'
import { DESIGN_FRAMEWORK } from './design-framework'
import { STEP_KEYS } from './case-types'

const dir = 'content/cases'
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as unknown
const files = readdirSync(dir).filter(name => name.endsWith('.json') && name !== 'index.json')
const cases = files.map(name => read(join(dir, name)) as DesignCase)
const lessonIds = new Set(lessons.map(lesson => lesson.id))

describe('case study content', () => {
  it('index.json lists exactly the case files, in a stable order', () => {
    const { cases: order } = read(join(dir, 'index.json')) as { cases: string[] }
    expect([...order].sort()).toEqual(files.map(name => name.replace(/\.json$/, '')).sort())
    expect(caseIndex.map(item => item.id)).toEqual(order)
  })

  it.each(files)('%s is valid, links real lessons and its id matches the file', name => {
    const item = read(join(dir, name)) as DesignCase
    expect(validateCase(item, name, lessonIds)).toEqual([])
    expect(item.id).toBe(name.replace(/\.json$/, ''))
  })

  it('offers about 20 cases across both levels, linked only to system design lessons', () => {
    expect(cases.length).toBeGreaterThanOrEqual(20)
    expect(cases.filter(item => item.level === 'se').length).toBeGreaterThanOrEqual(8)
    expect(cases.filter(item => item.level === 'sse').length).toBeGreaterThanOrEqual(8)
    const tracks = new Set(cases.flatMap(item => item.lessons).map(id => lessons.find(lesson => lesson.id === id)?.track))
    expect([...tracks]).toEqual(['system-design'])
  })

  it('lazy-loads the same cases the index lists', async () => {
    const loaded = await loadCases()
    expect([...loaded.keys()]).toEqual(caseIndex.map(item => item.id))
  })

  it('rejects malformed cases with readable errors', () => {
    const bad = {
      id: 'Bad', level: 'staff', minutes: 3, lessons: ['nope'], steps: {},
      diagram: { nodes: [{ id: 'a', kind: 'robot', label: 'x'.repeat(30), col: 9, row: 0 }, { id: 'a', kind: 'db', label: 'B', col: 0, row: 0 }, { id: 'c', kind: 'db', label: 'C', col: 0, row: 0 }], edges: [{ from: 'a', to: 'zzz' }, { from: 'a', to: 'c' }] },
      rubric: [{ text: 'only one' }],
    }
    expect(validateCase(bad, 'case', lessonIds)).toEqual(expect.arrayContaining([
      'case.id: expected kebab-case id',
      'case.level: expected se or sse',
      'case.minutes: expected integer 15–90',
      'case.lessons[0]: unknown lesson nope',
      'case.steps: missing "requirements"',
      'case.diagram.nodes[0].kind: unknown node kind',
      'case.diagram.nodes[0].label: expected at most 18 characters',
      'case.diagram.nodes[0]: position outside the grid',
      'case.diagram.nodes[1].id: expected unique id',
      'case.diagram.nodes[2]: two nodes share a grid cell',
      'case.diagram.edges[0]: edge must join two different nodes',
      'case.rubric: expected 5–10 items',
      'case: missing "title"',
    ]))
  })
})

describe('design framework', () => {
  it('has one step per case answer section, in the same order', () => {
    expect(DESIGN_FRAMEWORK.map(step => step.key)).toEqual([...STEP_KEYS])
    for (const step of DESIGN_FRAMEWORK) expect(step.questions.length).toBeGreaterThanOrEqual(2)
  })
  it('suggests minutes that fit a 45-minute interview', () => {
    expect(DESIGN_FRAMEWORK.reduce((sum, step) => sum + step.minutes, 0)).toBe(45)
  })
})

// Case IDs are stored in backups (the "designs" map). Append-only, like lesson IDs.
describe('case id registry', () => {
  const current = new Set(cases.map(item => item.id))
  it('keeps every case id that has ever shipped', () => expect(knownIds.filter(id => !current.has(id))).toEqual([]))
  it('records every current case id', () => expect([...current].filter(id => !knownIds.includes(id))).toEqual([]))
})
