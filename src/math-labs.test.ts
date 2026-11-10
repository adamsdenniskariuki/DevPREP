import { resolve } from 'node:path'
import { loadPyodide, type PyodideAPI } from 'pyodide'
import { beforeAll, describe, expect, it } from 'vitest'
// @ts-expect-error plain JS build script
import { buildMathLabs, MATH_LAB_PLAN, MATH_TOPICS as BUILD_TOPICS } from '../scripts/build-content.mjs'
import { validateMathLabDiagram } from './content-schema'
import { lessons } from './curriculum'
import mathLabsJson from './generated/math-labs.json' with { type: 'json' }
import plansJson from './generated/plans.json' with { type: 'json' }
import { DEFAULT_TOLERANCE, labTolerance, loadMathLabs, MATH_PACKAGES, MATH_PLAN_ID, MATH_TOPICS, mathLabHref, type MathLab } from './math-labs'
import { PY_HARNESS, runPython } from './runner/core'
import { NUMPY_WHEEL } from './runner/pyodide-version'
import { weekItems, type StudyPlan } from './study-plans'

const labs = mathLabsJson as unknown as MathLab[]
const plan = (plansJson as unknown as StudyPlan[]).find(item => item.id === MATH_PLAN_ID)!

describe('math lab content', () => {
  it('builds from content/math and matches the generated file', async () => {
    expect(buildMathLabs()).toEqual(labs)
    await expect(loadMathLabs()).resolves.toEqual(labs)
    expect(MATH_LAB_PLAN).toBe(MATH_PLAN_ID)
    expect([...MATH_TOPICS]).toEqual(BUILD_TOPICS)
  })

  it('covers every topic, in plan order, with unique ids and functions', () => {
    expect(labs.length).toBeGreaterThanOrEqual(20)
    expect(new Set(labs.map(lab => lab.id)).size).toBe(labs.length)
    expect(new Set(labs.map(lab => lab.topic))).toEqual(new Set(MATH_TOPICS))
    const linked = plan.weeks.flatMap(weekItems).map(item => item.href).filter(href => href?.startsWith(mathLabHref('')))
    expect(linked).toEqual(labs.map(lab => mathLabHref(lab.id)))
  })

  it('uses NumPy, existing lessons and valid diagrams', () => {
    const lessonIds = new Set(lessons.map(lesson => lesson.id))
    expect(MATH_PACKAGES).toEqual(['numpy'])
    expect(labs.filter(lab => lab.solution.includes('import numpy as np')).length).toBeGreaterThanOrEqual(labs.length - 2)
    for (const lab of labs) {
      for (const lesson of lab.lessons ?? []) expect(lessonIds.has(lesson), `${lab.id} ${lesson}`).toBe(true)
      if (lab.diagram) expect(() => validateMathLabDiagram(lab.diagram, `content/math/${lab.id}.json: diagram`), lab.id).not.toThrow()
    }
    expect(labs.filter(lab => lab.diagram).length).toBeGreaterThanOrEqual(3)
    expect(labs.find(lab => lab.diagram?.type === 'flow')).toBeDefined()
  })

  it('seeds every random generator', () => {
    for (const lab of labs.filter(item => /random/.test(item.solution))) expect(lab.solution, lab.id).toContain('default_rng(seed)')
  })

  it('loosens the tolerance only for sampling labs', () => {
    expect(labTolerance(labs[0])).toEqual(DEFAULT_TOLERANCE)
    expect(labs.filter(lab => lab.tolerance).map(lab => lab.id)).toEqual(['monte-carlo-dice', 'bootstrap-standard-error'])
  })

  it('has visible and hidden tests with finite expected values', () => {
    for (const lab of labs) {
      expect(lab.tests.length, lab.id).toBeGreaterThanOrEqual(2)
      expect(lab.hiddenTests.length, lab.id).toBeGreaterThanOrEqual(1)
      expect(JSON.stringify([...lab.tests, ...lab.hiddenTests]), lab.id).not.toMatch(/NaN|Infinity/)
    }
  })

  it('has no personal or employer details', () => {
    const text = JSON.stringify(labs)
    for (const word of ['Microsoft', 'EntityServe', 'Polymer', 'Fitto', 'Substrate']) expect(text).not.toContain(word)
  })
})

describe('math labs in Pyodide with NumPy', () => {
  let py: PyodideAPI
  beforeAll(async () => {
    py = await loadPyodide({ indexURL: `${resolve('node_modules/pyodide')}/` })
    await py.loadPackage(resolve('vendor/pyodide', NUMPY_WHEEL).replace(/\\/g, '/'), { messageCallback: () => {}, errorCallback: message => { throw new Error(message) } })
    py.runPython(PY_HARNESS)
  }, 180_000)

  const run = (lab: MathLab, code: string) => runPython(py, { code, name: lab.function, cases: [...lab.tests, ...lab.hiddenTests], tolerance: labTolerance(lab) })

  it.each(labs.map(lab => [lab.id, lab] as const))('%s: the solution passes every test and the starter fails one', (_id, lab) => {
    const solved = run(lab, lab.solution)
    expect(solved.kind, lab.id).toBe('done')
    if (solved.kind === 'done') expect(solved.outcomes.filter(outcome => !outcome.pass), lab.id).toEqual([])
    const started = run(lab, lab.starter)
    if (started.kind === 'done') expect(started.outcomes.some(outcome => !outcome.pass), lab.id).toBe(true)
  }, 60_000)

  it('matches the hand-worked answers in the lab text', () => {
    const answer = (id: string, args: unknown[]) => {
      const lab = labs.find(item => item.id === id)!
      const result = runPython(py, { code: lab.solution, name: lab.function, cases: [{ args, expected: null }] })
      return result.kind === 'done' ? JSON.parse(result.outcomes[0].actual ?? 'null') : undefined
    }
    expect(answer('bayes-posterior', [0.01, 0.99, 0.05])).toBeCloseTo(1 / 6, 10)
    expect(answer('least-squares-line', [[1, 2, 3, 4], [2, 3, 5, 6]])).toEqual([expect.closeTo(1.4, 10), expect.closeTo(0.5, 10)])
    const [z, p] = answer('ab-test-z', [200, 2000, 240, 2000])
    expect(z).toBeCloseTo(2.0214, 3)
    expect(p).toBeCloseTo(0.0432, 3)
    expect(answer('mean-confidence-interval', [[2, 4, 4, 4, 5, 5, 7, 9], 1.96])).toEqual([expect.closeTo(3.5184, 3), expect.closeTo(6.4816, 3)])
    expect(answer('stable-cross-entropy', [[1000, 0], 1])).toBeCloseTo(1000, 6)
  })

  it('fails a starter that overflows instead of crashing the run', () => {
    const lab = labs.find(item => item.id === 'stable-cross-entropy')!
    const result = run(lab, lab.starter)
    expect(result.kind).toBe('done')
    if (result.kind === 'done') expect(result.outcomes.some(outcome => !outcome.pass)).toBe(true)
  })
})
