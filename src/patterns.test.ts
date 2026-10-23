import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'
import { loadPyodide, type PyodideAPI } from 'pyodide'
import { beforeAll, describe, expect, it } from 'vitest'
import knownIds from '../tests/fixtures/pattern-ids.json' with { type: 'json' }
import { validatePattern } from './content-schema'
import { cardIds } from './flashcards'
import { gameStats, patternPageDone, patternXp, XP_RULES } from './gamification'
import { buildMock, PATTERN_RUBRIC, seeded } from './mocks'
import { PICKER_CHOICES, PICKER_ROUND, loadPatterns, patternIndex, patternsForProblem, patternTree, pickerRound, pickerScore } from './patterns'
import { stripMarkers } from './patterns/markers'
import { getTracer, TRACERS } from './patterns/tracers'
import { patternQueue, planStudy } from './planner'
import { emptyProgress, parseBackup, recordPatternExercise, recordPatternQuiz, recordPicker, serializeBackup } from './progress'
import { loadProblems, problemIndex } from './problems'
import { PY_HARNESS, runJs, runJsAsync, runPython } from './runner/core'
import { createTsCompiler, libClosure } from './runner/ts-core'
import type { PatternPage, PatternSummary } from './pattern-types'

const pages = [...(await loadPatterns()).values()]
const order = (JSON.parse(readFileSync('content/patterns/index.json', 'utf8')) as { patterns: string[] }).patterns
const RANDOM_RUNS = 50
const NOW = new Date('2025-03-10T12:00:00Z')

/** The visualiser's tracer input for each example plus random inputs, as function arguments. */
function traceInputs(page: PatternPage) {
  const tracer = getTracer(page.visualiser.tracer)!
  const random = seeded(page.id.length * 7919)
  const inputs = [...page.visualiser.examples.map(example => example.input), ...Array.from({ length: RANDOM_RUNS }, () => tracer.random(random))]
  return inputs.map(input => {
    const parsed = tracer.parse(input)
    if (!parsed.ok) throw new Error(`${page.id}: ${JSON.stringify(input)} did not parse: ${JSON.stringify(parsed.errors)}`)
    return { args: parsed.args, trace: tracer.run(parsed.args) }
  })
}

describe('pattern content', () => {
  it('index.json lists the published pages in learning order, and ids are append-only', () => {
    expect(patternIndex.map(page => page.id)).toEqual(order)
    expect(pages.map(page => page.id)).toEqual(order)
    expect(order.slice(0, knownIds.length)).toEqual(knownIds)
    expect(order).toEqual(knownIds)
  })

  it.each(order)('%s is valid, links real problems and covers its category', id => {
    const page = pages.find(item => item.id === id)!
    expect(validatePattern(page, id)).toEqual([])
    for (const link of page.problems) expect(problemIndex.some(problem => problem.id === link.id), link.id).toBe(true)
    expect(page.quiz).toHaveLength(3)
    expect(TRACERS[page.visualiser.tracer], page.visualiser.tracer).toBeDefined()
  })

  it('rejects malformed pages with readable errors', () => {
    const page = structuredClone(pages[0]) as unknown as Record<string, unknown>
    expect(validatePattern({ id: 'Bad', level: 'staff' })).toEqual(expect.arrayContaining([
      'pattern.id: expected kebab-case id',
      'pattern.level: expected se or sse',
    ]))
    expect(validatePattern({ ...page, category: 'Juggling' })).toContain('pattern.category: expected a known pattern')
    expect(validatePattern({ ...page, problems: (page.problems as unknown[]).slice(0, 1) })).toContain('pattern.problems: expected 2–4 linked problems')
    expect(validatePattern({ ...page, problems: [{ id: 'a', role: 'core' }, { id: 'b', role: 'core' }] })).toContain('pattern.problems: expected at least two different roles')
    expect(validatePattern({ ...page, problems: [{ id: 'a', role: 'stretch' }, { id: 'b', role: 'warm-up' }] })).toContain('pattern.problems: expected warm-up, then core, then stretch')
    expect(validatePattern({ ...page, parent: page.id })).toContain('pattern.parent: expected another page id')
    expect(validatePattern({ ...page, minutes: 2 })).toContain('pattern.minutes: expected integer 5–45')
    expect(validatePattern({ ...page, surprise: true }).length).toBeGreaterThan(0)
  })

  it('supports sub-pages: the tree nests children under their parent', () => {
    const base = patternIndex[0]
    const child: PatternSummary = { ...base, id: 'child-page', parent: base.id }
    const tree = patternTree([...patternIndex, child])
    expect(tree.map(item => item.page.id)).toEqual(patternIndex.filter(page => !page.parent).map(page => page.id))
    expect(tree[0].children.map(item => item.id)).toEqual(['child-page'])
    const real = patternTree(patternIndex)
    const kids = (id: string) => real.find(item => item.page.id === id)!.children.map(item => item.id)
    expect(kids('stack')).toEqual(['basic-stack', 'monotonic-stack'])
    expect(kids('binary-search')).toEqual(['search-on-answer'])
    expect(kids('linked-lists')).toEqual(['fast-slow-pointers', 'in-place-reversal'])
  })

  it('links problems to their pattern page', () => {
    for (const page of pages) for (const link of page.problems) {
      const problem = problemIndex.find(item => item.id === link.id)!
      expect(patternsForProblem(problem).map(item => item.id), link.id).toContain(page.id)
    }
    const twoSum = problemIndex.find(problem => problem.pattern === 'Two pointers')!
    expect(patternsForProblem(twoSum).map(item => item.id)).toContain('two-pointers')
  })

  it('adds signal and quiz flashcards to the DSA deck with stable ids', () => {
    for (const page of pages) {
      const ids = [...cardIds].filter(id => id.startsWith(`dsa-pt-${page.id}-`))
      expect(ids.length, page.id).toBe(page.recognise.signals.length + page.quiz.length)
    }
  })
})

describe('pattern visualisers', () => {
  it.each(order)('%s: every frame line has a marker in both languages and every frame has text', id => {
    const page = pages.find(item => item.id === id)!
    const js = stripMarkers(page.visualiser.code.js)
    const py = stripMarkers(page.visualiser.code.py)
    expect(js.code).not.toMatch(/\/\/@/)
    expect(py.code).not.toMatch(/#@/)
    for (const { trace } of traceInputs(page)) {
      expect(trace.frames.length).toBeGreaterThan(1)
      for (const frame of trace.frames) {
        expect(js.lines[frame.line], `js ${frame.line}`).toBeGreaterThan(0)
        expect(py.lines[frame.line], `py ${frame.line}`).toBeGreaterThan(0)
        expect(frame.text.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it.each(order)('%s: the tracer result matches the shown JavaScript', id => {
    const page = pages.find(item => item.id === id)!
    const cases = traceInputs(page).map(({ args, trace }) => ({ args, expected: trace.result }))
    const result = runJs({ code: stripMarkers(page.visualiser.code.js).code, name: page.visualiser.function.js, cases })
    expect(result.kind).toBe('done')
    if (result.kind === 'done') expect(result.outcomes.filter(outcome => !outcome.pass)).toEqual([])
  })

  it('rejects custom input outside the small limits with a message per field', () => {
    for (const tracer of Object.values(TRACERS)) {
      const input = Object.fromEntries(tracer.params.map(param => [param.name, 'abc']))
      const parsed = tracer.parse(input)
      expect(parsed.ok, tracer.id).toBe(false)
      if (!parsed.ok) expect(Object.keys(parsed.errors).length).toBeGreaterThan(0)
      const big = Object.fromEntries(tracer.params.map(param => [param.name, param.kind === 'int' ? '1' : Array.from({ length: 40 }, () => 1).join(', ')]))
      expect(tracer.parse(big).ok, `${tracer.id} long list`).toBe(false)
    }
  })
})

describe('pattern code in Python (Pyodide)', () => {
  let py: PyodideAPI
  beforeAll(async () => {
    py = await loadPyodide({ indexURL: `${resolve('node_modules/pyodide')}/` })
    py.runPython(PY_HARNESS)
  }, 120_000)

  it.each(order)('%s: the tracer result matches the shown Python', id => {
    const page = pages.find(item => item.id === id)!
    const cases = traceInputs(page).map(({ args, trace }) => ({ args, expected: trace.result }))
    const result = runPython(py, { code: stripMarkers(page.visualiser.code.py).code, name: page.visualiser.function.py, cases })
    expect(result.kind).toBe('done')
    if (result.kind === 'done') expect(result.outcomes.filter(outcome => !outcome.pass)).toEqual([])
  })

  it.each(order)('%s: the Python exercise solution passes and the starter fails', id => {
    const { exercise } = pages.find(item => item.id === id)!
    const cases = [...exercise.tests, ...exercise.hiddenTests]
    const solved = runPython(py, { code: exercise.solution.py, name: exercise.function.py, cases })
    expect(solved.kind).toBe('done')
    if (solved.kind === 'done') expect(solved.outcomes.filter(outcome => !outcome.pass)).toEqual([])
    const starter = runPython(py, { code: exercise.starter.py, name: exercise.function.py, cases })
    expect(starter.kind === 'done' && starter.outcomes.every(outcome => outcome.pass)).toBe(false)
  })

  it.each(order)('%s: the Python template runs', id => {
    const page = pages.find(item => item.id === id)!
    expect(() => py.runPython(stripMarkers(page.template.py).code, { globals: py.toPy({}) })).not.toThrow()
  })
})

describe('pattern exercises in JavaScript and TypeScript', () => {
  const read = (name: string) => readFileSync(resolve('node_modules/typescript/lib', name), 'utf8')
  const compiler = createTsCompiler(ts, Object.fromEntries(libClosure(read).map(name => [name, read(name)])))

  it.each(order)('%s: the JavaScript solution passes and the starter fails', id => {
    const { exercise } = pages.find(item => item.id === id)!
    const cases = [...exercise.tests, ...exercise.hiddenTests]
    const solved = runJs({ code: exercise.solution.js, name: exercise.function.js, cases })
    expect(solved.kind).toBe('done')
    if (solved.kind === 'done') expect(solved.outcomes.filter(outcome => !outcome.pass)).toEqual([])
    const starter = runJs({ code: exercise.starter.js, name: exercise.function.js, cases })
    expect(starter.kind === 'done' && starter.outcomes.every(outcome => outcome.pass)).toBe(false)
  })

  it.each(order)('%s: the TypeScript solution type-checks and passes, and the starter fails', async id => {
    const { exercise } = pages.find(item => item.id === id)!
    const cases = [...exercise.tests, ...exercise.hiddenTests]
    expect(compiler.check(exercise.solution.ts).map(diagnostic => diagnostic.message)).toEqual([])
    const solved = await runJsAsync({ code: compiler.transpile(exercise.solution.ts), name: exercise.function.js, cases })
    expect(solved.kind).toBe('done')
    if (solved.kind === 'done') expect(solved.outcomes.filter(outcome => !outcome.pass)).toEqual([])
    const starter = await runJsAsync({ code: compiler.transpile(exercise.starter.ts), name: exercise.function.js, cases })
    expect(starter.kind === 'done' && starter.outcomes.every(outcome => outcome.pass)).toBe(false)
  })

  it.each(order)('%s: the JavaScript and TypeScript templates compile', id => {
    const page = pages.find(item => item.id === id)!
    expect(() => new Function(stripMarkers(page.template.js).code)).not.toThrow()
    expect(compiler.check(stripMarkers(page.template.ts).code).map(diagnostic => diagnostic.message)).toEqual([])
  })
})

describe('pattern picker', () => {
  it('builds a deterministic round of PICKER_ROUND questions from published pages', () => {
    const round = pickerRound(42)
    expect(round).toHaveLength(PICKER_ROUND)
    expect(pickerRound(42)).toEqual(round)
    expect(pickerRound(43)).not.toEqual(round)
    expect(new Set(round.map(item => item.prompt)).size).toBe(PICKER_ROUND)
    for (const question of round) {
      expect(question.choices).toHaveLength(PICKER_CHOICES)
      expect(question.choices).toContain(question.answer)
      expect(question.choices).toEqual(order.filter(id => question.choices.includes(id)))
      const answer = patternIndex.find(page => page.id === question.answer)!
      for (const id of question.choices.filter(id => id !== question.answer)) {
        const other = patternIndex.find(page => page.id === id)!
        expect(other.parent === answer.id || answer.parent === other.id, `${id} is related to ${answer.id}`).toBe(false)
        expect(other.drills, `${id} shares the prompt`).not.toContain(question.prompt)
      }
      expect(question.explain.length).toBeGreaterThan(10)
    }
  })

  it('scores answers and needs at least two pages', () => {
    const round = pickerRound(7)
    expect(pickerScore(round, round.map(item => item.answer))).toBe(PICKER_ROUND)
    expect(pickerScore(round, [])).toBe(0)
    expect(pickerRound(1, patternIndex.slice(0, 1))).toEqual([])
  })
})

describe('pattern progress, XP and badges', () => {
  const page = order[0]

  it('records exercises per language, keeps the best quiz and counts picker rounds', () => {
    let progress = emptyProgress(NOW)
    progress = recordPatternExercise(progress, page, 'py', NOW)
    expect(recordPatternExercise(progress, page, 'py', NOW)).toBe(progress)
    progress = recordPatternExercise(progress, page, 'ts', NOW)
    progress = recordPatternQuiz(progress, page, 67, NOW)
    progress = recordPatternQuiz(progress, page, 33, NOW)
    progress = recordPicker(progress, 6, NOW)
    progress = recordPicker(progress, 4, NOW)
    expect(progress.patterns?.[page]).toEqual({ exercise: { py: NOW.toISOString(), ts: NOW.toISOString() }, quiz: { best: 67, at: NOW.toISOString() } })
    expect(progress.patternPicker).toEqual({ best: 6, rounds: 2, at: NOW.toISOString() })
    expect(patternXp(progress)).toBe(XP_RULES.patternExercise + XP_RULES.patternSecondLanguage + XP_RULES.patternQuiz + 2 * XP_RULES.pickerRound)
  })

  it('round-trips through a backup and old backups load unchanged', () => {
    let progress = recordPatternExercise(emptyProgress(NOW), page, 'js', NOW)
    progress = recordPatternQuiz(progress, page, 100, NOW)
    progress = recordPicker(progress, 9, NOW)
    const restored = parseBackup(serializeBackup(progress))
    expect(restored.patterns).toEqual(progress.patterns)
    expect(restored.patternPicker).toEqual(progress.patternPicker)
    const old = parseBackup(serializeBackup(emptyProgress(NOW)))
    expect(old.patterns).toBeUndefined()
    expect(old.patternPicker).toBeUndefined()
    expect(serializeBackup(emptyProgress(NOW))).not.toContain('pattern')
  })

  it('rejects invalid pattern progress', () => {
    const base = JSON.parse(serializeBackup(emptyProgress(NOW))) as Record<string, unknown>
    const bad = (extra: Record<string, unknown>) => () => parseBackup(JSON.stringify({ ...base, ...extra }))
    const at = NOW.toISOString()
    expect(bad({ patterns: { 'no-such-page': { quiz: { best: 50, at } } } })).toThrow(/unknown pattern page/)
    expect(bad({ patterns: { [page]: {} } })).toThrow()
    expect(bad({ patterns: { [page]: { exercise: {} } } })).toThrow()
    expect(bad({ patterns: { [page]: { exercise: { rb: at } } } })).toThrow()
    expect(bad({ patterns: { [page]: { quiz: { best: 101, at } } } })).toThrow()
    expect(bad({ patternPicker: { best: 11, rounds: 1, at } })).toThrow()
    expect(bad({ patternPicker: { best: 5, rounds: 0, at } })).toThrow()
    expect(bad({ patternPicker: { best: 5, rounds: 1, at: 'yesterday' } })).toThrow()
  })

  it('awards XP from saved data and appends badges', () => {
    const before = gameStats(emptyProgress(NOW), NOW)
    let progress = emptyProgress(NOW)
    progress = recordPatternExercise(progress, page, 'py', NOW)
    expect(patternPageDone(progress, page)).toBe(false)
    progress = recordPatternQuiz(progress, page, 100, NOW)
    expect(patternPageDone(progress, page)).toBe(true)
    const stats = gameStats(progress, NOW)
    expect(stats.xp - before.xp).toBe(XP_RULES.patternExercise + XP_RULES.patternQuiz + XP_RULES.patternQuizPerfect)
    const earned = new Set(stats.badges.filter(badge => badge.earned).map(badge => badge.id))
    expect(earned).toContain(`pattern-course-${page}`)
    expect(earned).toContain('first-pattern')
    expect(earned).not.toContain('patterns-course')
    expect(earned).not.toContain('picker-sharp')
    // Existing badge ids keep their positions; pattern badges are appended.
    const ids = stats.badges.map(badge => badge.id)
    expect(ids.slice(-order.length - 3)).toEqual([...order.map(id => `pattern-course-${id}`), 'first-pattern', 'patterns-course', 'picker-sharp'])
    for (const id of order) progress = recordPatternQuiz(recordPatternExercise(progress, id, 'js', NOW), id, 67, NOW)
    progress = recordPicker(progress, 9, NOW)
    const all = new Set(gameStats(progress, NOW).badges.filter(badge => badge.earned).map(badge => badge.id))
    expect(all).toContain('patterns-course')
    expect(all).toContain('picker-sharp')
  })
})

describe('pattern planner and mocks', () => {
  it('plans a pattern page every third day, then picker drills', () => {
    const plan = planStudy(emptyProgress(NOW), '2025-03-10')
    const items = plan.days.flatMap(day => day.items.filter(item => item.kind === 'pattern'))
    expect(items.length).toBeGreaterThan(0)
    expect(items[0]).toMatchObject({ kind: 'pattern', ref: order[0] })
    expect(plan.days[0].items.some(item => item.kind === 'pattern')).toBe(true)
    expect(plan.days[1].items.some(item => item.kind === 'pattern')).toBe(false)

    let done = emptyProgress(NOW)
    for (const id of order) done = recordPatternQuiz(recordPatternExercise(done, id, 'py', NOW), id, 100, NOW)
    expect(patternQueue(done)).toEqual([])
    const drills = planStudy(done, '2025-03-10').days.flatMap(day => day.items.filter(item => item.kind === 'pattern'))
    expect(drills.length).toBeGreaterThan(0)
    expect(drills.every(item => item.ref === 'pick')).toBe(true)
  })

  it('ends DSA mocks with one pattern-recognition question when pages are given', async () => {
    const data = { problems: await loadProblems(), cases: new Map(), patterns: patternIndex }
    for (const seed of [1, 2, 3]) {
      const mock = buildMock('dsa', 'se', seed, data)
      const last = mock.questions[mock.questions.length - 1]
      expect(last).toMatchObject({ kind: 'pattern', rubric: PATTERN_RUBRIC })
      expect(order).toContain(last.ref)
      expect(mock.questions.filter(question => question.kind === 'pattern')).toHaveLength(1)
    }
    const without = buildMock('dsa', 'se', 1, { problems: data.problems, cases: new Map() })
    expect(without.questions.some(question => question.kind === 'pattern')).toBe(false)
  })
})
