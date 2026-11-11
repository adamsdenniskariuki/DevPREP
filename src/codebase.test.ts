import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'
import { loadPyodide, type PyodideAPI } from 'pyodide'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import legacyBackup from '../tests/fixtures/v1-progress.json' with { type: 'json' }
import content from './generated/codebase.json' with { type: 'json' }
import { parseFullBackup, serializeFullBackup } from './board-backup'
import { emptyProgress, serializeBackup } from './progress'
import {
  CODEBASE_TASK_IDS, isHiddenOutcome, parseCodebaseProgress, recordAttempt, recordScores, solutionFiles, starterFiles, submitRequest, visibleRequest,
  changedFiles, readCodebaseProgress, readTaskDraft, timerElapsed, writeCodebaseProgress, writeTaskDraft, type CodebaseContent, type CodebaseRepo, type CodebaseTask,
} from './codebase'
import { createProjectChecker, PY_PROJECT_HARNESS, runPythonProject, runTypeScriptProject, type ProjectRunRequest, type ProjectResponse } from './runner/project'
import { libClosure, TS_ENTRY_LIB, TS_RUNTIME_DECLARATIONS } from './runner/ts-core'

const codebase = content as unknown as CodebaseContent
const read = (name: string) => readFileSync(resolve('node_modules/typescript/lib', name), 'utf8')
const libs = Object.fromEntries(libClosure(read).map(name => [name, read(name)]))
const check = createProjectChecker(ts, libs, TS_ENTRY_LIB, TS_RUNTIME_DECLARATIONS)

let py: PyodideAPI
let output = ''
beforeAll(async () => {
  py = await loadPyodide({ indexURL: `${resolve('node_modules/pyodide')}/`, stdout: line => { output += `${line}\n` }, stderr: line => { output += `${line}\n` } })
  py.runPython(PY_PROJECT_HARNESS)
}, 120_000)

async function run(repo: CodebaseRepo, request: ProjectRunRequest): Promise<ProjectResponse> {
  if (repo.lang === 'py') return runPythonProject(py, request, () => { const text = output; output = ''; return text })
  return runTypeScriptProject(ts, check, request)
}
const passed = (result: ProjectResponse) => result.kind === 'done' && !result.diagnostics?.length && result.outcomes.length > 0 && result.outcomes.every(outcome => outcome.pass)
const describeFailures = (result: ProjectResponse) => result.kind === 'done'
  ? [...result.diagnostics ?? [], ...result.outcomes.filter(outcome => !outcome.pass)].map(item => JSON.stringify(item)).join('\n')
  : result.error

const cases: [string, CodebaseRepo, CodebaseTask][] = codebase.repos.flatMap(repo => repo.tasks.map(task => [`${repo.id}/${task.id}`, repo, task] as [string, CodebaseRepo, CodebaseTask]))

describe('codebase content', () => {
  it('has six small repos, half Python and half TypeScript, each with a bug and a feature task', () => {
    expect(codebase.repos).toHaveLength(6)
    expect(codebase.repos.filter(repo => repo.lang === 'py')).toHaveLength(3)
    for (const repo of codebase.repos) {
      const count = Object.keys(repo.files).length
      expect(count, repo.id).toBeGreaterThanOrEqual(4)
      expect(count, repo.id).toBeLessThanOrEqual(7)
      expect(repo.tasks.map(task => task.kind).sort(), repo.id).toEqual(['bug', 'feature'])
      for (const task of repo.tasks) {
        expect(task.minutes).toBeGreaterThanOrEqual(45)
        expect(task.minutes).toBeLessThanOrEqual(60)
        expect(Object.keys(task.hidden).length).toBeGreaterThan(0)
        expect(task.diff.length).toBeGreaterThan(0)
      }
    }
    expect(cases.map(([id]) => id)).toEqual(CODEBASE_TASK_IDS)
  })

  it('walks through seven steps and grades four areas that cover every step', () => {
    expect(codebase.guide.steps.map(step => step.id)).toEqual(['clarify', 'orient', 'reproduce', 'trace', 'change', 'verify', 'wrap-up'])
    expect(codebase.guide.rubric).toHaveLength(4)
    expect(new Set(codebase.guide.rubric.flatMap(area => area.steps))).toEqual(new Set(codebase.guide.steps.map(step => step.id)))
  })

  it('submits the visible tests plus the hidden ones, and marks hidden outcomes', () => {
    const [, repo, task] = cases[0]
    const request = submitRequest(repo.lang, starterFiles(repo, task), task)
    const hidden = Object.keys(task.hidden)
    expect(request.tests).toEqual([...visibleRequest(repo.lang, starterFiles(repo, task)).tests, ...hidden])
    expect(visibleRequest(repo.lang, starterFiles(repo, task)).tests.some(path => hidden.includes(path))).toBe(false)
    expect(isHiddenOutcome(task, `${hidden[0]}::anything`)).toBe(true)
    expect(isHiddenOutcome(task, `${request.tests[0]}::anything`)).toBe(false)
  })
})

describe.each(cases)('%s', (_id, repo, task) => {
  it('model answer passes every visible and hidden test', async () => {
    const result = await run(repo, submitRequest(repo.lang, solutionFiles(repo, task), task))
    expect(passed(result), describeFailures(result)).toBe(true)
  }, 60_000)

  it('starter fails at least one test on Submit', async () => {
    const result = await run(repo, submitRequest(repo.lang, starterFiles(repo, task), task))
    expect(result.kind === 'done' && result.outcomes.some(outcome => !outcome.pass) || result.kind === 'error').toBe(true)
  }, 60_000)
})

describe('codebase progress', () => {
  const id = CODEBASE_TASK_IDS[0]

  it('accepts valid progress and rejects anything unexpected', () => {
    const state = { [id]: { attempts: 2, best: [3, 2, 4, 3], completed: '2026-11-11', revealed: true } }
    expect(parseCodebaseProgress(state)).toEqual(state)
    expect(() => parseCodebaseProgress({ 'nope/nothing': { attempts: 1 } })).toThrow(/unknown codebase task/)
    expect(() => parseCodebaseProgress({ [id]: { attempts: 1, best: [5, 1, 1, 1] } })).toThrow(/scores/)
    expect(() => parseCodebaseProgress({ [id]: { attempts: -1 } })).toThrow(/attempt/)
    expect(() => parseCodebaseProgress({ [id]: { attempts: 1, extra: 1 } })).toThrow(/unexpected/)
    expect(() => parseCodebaseProgress([])).toThrow(/object/)
  })

  it('counts attempts, keeps the first completion day and the best scorecard', () => {
    const first = recordAttempt(undefined, false, '2026-11-10')
    expect(first).toEqual({ attempts: 1 })
    const second = recordAttempt(first, true, '2026-11-11')
    expect(recordAttempt(second, true, '2026-11-12')).toEqual({ attempts: 3, completed: '2026-11-11' })
    const scored = recordScores(second, [2, 2, 2, 2])
    expect(recordScores(scored, [1, 1, 1, 1]).best).toEqual([2, 2, 2, 2])
    expect(recordScores(scored, [3, 2, 2, 2]).best).toEqual([3, 2, 2, 2])
  })

  it('keeps only changed files in drafts and resumes a running timer', () => {
    expect(changedFiles({ a: '1', b: '2' }, { a: '1', b: '3' })).toEqual({ b: '3' })
    expect(timerElapsed({ elapsed: 1000, since: 5000 }, 8000)).toBe(4000)
    expect(timerElapsed({ elapsed: 1000 }, 8000)).toBe(1000)
  })
})

describe('codebase storage and backups', () => {
  const id = CODEBASE_TASK_IDS[0]
  const state = { [id]: { attempts: 1, best: [2, 3, 2, 3] as [number, number, number, number], completed: '2026-11-11' } }
  afterEach(() => { vi.unstubAllGlobals() })
  function memoryStorage() {
    const items = new Map<string, string>()
    vi.stubGlobal('window', { localStorage: { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => { items.set(key, value) } } })
  }

  it('saves progress and per-task drafts on the device, ignoring corrupt data', () => {
    memoryStorage()
    expect(readCodebaseProgress()).toEqual({})
    expect(writeCodebaseProgress(state)).toBe(true)
    expect(readCodebaseProgress()).toEqual(state)
    window.localStorage.setItem('devprep.codebase.v1', '{"bad/id":1}')
    expect(readCodebaseProgress()).toEqual({})
    expect(writeTaskDraft(id, { files: { 'a.py': 'x' }, timer: { elapsed: 5 }, submitted: true })).toBe(true)
    expect(readTaskDraft(id)).toEqual({ files: { 'a.py': 'x' }, timer: { elapsed: 5 }, submitted: true })
    expect(readTaskDraft('other/task')).toEqual({ files: {} })
    for (let i = 0; i < 30; i++) writeTaskDraft(`r/t${i}`, { files: {} })
    expect(readTaskDraft(id)).toEqual({ files: {} })
    expect(readTaskDraft('r/t29')).toEqual({ files: {} })
  })

  it('reports a refused save', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem: () => { throw new Error('quota') } } })
    expect(writeCodebaseProgress(state)).toBe(false)
    expect(writeTaskDraft(id, { files: {} })).toBe(false)
  })

  it('still imports an old backup, which has no codebase progress', () => {
    const parsed = parseFullBackup(JSON.stringify(legacyBackup))
    expect(Object.keys(parsed)).toEqual(['progress'])
    expect(serializeFullBackup(emptyProgress(), undefined, [], {}, {})).toBe(serializeBackup(emptyProgress()))
  })

  it('round-trips codebase progress alone and alongside other data, and rejects bad entries', () => {
    const text = serializeFullBackup(emptyProgress(), undefined, [], {}, state)
    expect(JSON.parse(text).codebase).toEqual(state)
    expect(parseFullBackup(text).codebase).toEqual(state)
    expect(parseFullBackup(serializeFullBackup(emptyProgress(), [], [], {}, state))).toMatchObject({ boards: [], codebase: state })
    const base = JSON.parse(serializeBackup(emptyProgress()))
    expect(() => parseFullBackup(JSON.stringify({ ...base, codebase: { 'nope/nothing': { attempts: 1 } } }))).toThrow('Invalid backup: unknown codebase task nope/nothing.')
    expect(() => parseFullBackup(JSON.stringify({ ...base, codebase: [] }))).toThrow('Invalid backup: codebase practice must be an object.')
  })
})