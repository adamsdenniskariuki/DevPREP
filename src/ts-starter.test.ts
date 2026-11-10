import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import problemsJson from './generated/problems.json' with { type: 'json' }
import type { Problem } from './problem-types'
import { inferType, tsSolution, tsStarter, UNTYPED_NOTE } from './ts-starter'

const problems = problemsJson as unknown as Problem[]
const byId = (id: string) => problems.find(problem => problem.id === id)!

/** Type errors per file, checked as strictly as the in-browser runner checks learner code. Each file is its own module. */
function typeErrors(files: Record<string, string>) {
  const options: ts.CompilerOptions = { strict: true, target: ts.ScriptTarget.ES2022, lib: ['lib.es2023.d.ts'], noEmit: true, types: [], moduleDetection: ts.ModuleDetectionKind.Force }
  const host = ts.createCompilerHost(options)
  const read = host.getSourceFile
  host.getSourceFile = (name, version, ...rest) => name in files ? ts.createSourceFile(name, files[name], version, true) : read(name, version, ...rest)
  const program = ts.createProgram(Object.keys(files), options, host)
  const errors: Record<string, string[]> = Object.fromEntries(Object.keys(files).map(name => [name, []]))
  for (const diagnostic of ts.getPreEmitDiagnostics(program)) errors[diagnostic.file?.fileName ?? '']?.push(`TS${diagnostic.code}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`)
  return errors
}

describe('inferType', () => {
  it('names primitives, arrays, unions and nodes', () => {
    expect(inferType([1, 2])).toBe('number')
    expect(inferType(['a'])).toBe('string')
    expect(inferType([true])).toBe('boolean')
    expect(inferType([[1], []])).toBe('number[]')
    expect(inferType([[[1, 2]], []])).toBe('number[][]')
    expect(inferType([[]])).toBe('unknown[]')
    expect(inferType([[1, [2]]])).toBe('(number | number[])[]')
    expect(inferType([{ val: 1, next: null }, null])).toBe('ListNode | null')
    expect(inferType([{ val: 1, left: null, right: null }])).toBe('TreeNode')
    expect(inferType([{ id: 1 }])).toBe('unknown')
    expect(inferType([])).toBe('unknown')
  })
})

describe('TypeScript starters', () => {
  it('types plain function starters from the tests', () => {
    expect(tsStarter(byId('count-pair-sums')).split('\n')[0]).toBe('function countPairs(values: number[], target: number): number {')
    const merge = tsStarter(byId('merge-sorted-lists'))
    expect(merge).toContain('interface ListNode {\n  val: number\n  next: ListNode | null\n}')
    expect(merge).toContain('function mergeLists(a: ListNode | null, b: ListNode | null): ListNode | null {')
    expect(tsStarter(byId('tree-height'))).toContain('function treeHeight(root: TreeNode | null): number {')
  })

  it('keeps class and test-driver starters as untyped JavaScript, clearly marked', () => {
    for (const id of ['lru-cache', 'cycle-entry']) {
      const problem = byId(id)
      expect(tsStarter(problem)).toBe(`${UNTYPED_NOTE}\n${problem.starter.js}`)
      expect(tsSolution(problem)).toBeUndefined()
    }
  })

  it('gives every problem a starter whose only type errors come from the unfinished body', () => {
    const errors = typeErrors(Object.fromEntries(problems.map(problem => [`${problem.id}.ts`, tsStarter(problem)])))
    // An empty starter body can't yet return the declared type; nothing else should be wrong.
    for (const problem of problems) expect(errors[`${problem.id}.ts`].filter(error => !/^TS(2355|2322|2366):/.test(error)), problem.id).toEqual([])
  }, 60_000)

  it('types the signature of most solutions without changing their bodies', () => {
    const typed = problems.filter(problem => tsSolution(problem))
    expect(typed.length).toBeGreaterThan(100)
    for (const problem of typed) {
      const solution = tsSolution(problem)!
      expect(solution.split('\n').filter(line => !problem.solution.js.includes(line) && !/^(interface \w+ \{|  (val|next|left|right): )/.test(line)).length, problem.id).toBeLessThanOrEqual(1)
      expect(ts.transpileModule(solution, { reportDiagnostics: true }).diagnostics, problem.id).toEqual([])
    }
  })
})
