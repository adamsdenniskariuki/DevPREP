import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { createProjectChecker, runTypeScriptProject } from './runner/project'
import { libClosure, TS_ENTRY_LIB, TS_RUNTIME_DECLARATIONS } from './runner/ts-core'

const readLib = (name: string) => readFileSync(resolve('node_modules/typescript/lib', name), 'utf8')
const libs = Object.fromEntries(libClosure(readLib).map(name => [name, readLib(name)]))
const check = createProjectChecker(ts, libs, TS_ENTRY_LIB, TS_RUNTIME_DECLARATIONS)

const dir = join(process.cwd(), 'content', 'node', 'exercises')
const index = JSON.parse(readFileSync(join(process.cwd(), 'content', 'node', 'index.json'), 'utf8')) as { exercises: string[] }
const read = (id: string, kind: string) => readFileSync(join(dir, `${id}.${kind}.ts`), 'utf8')
const run = (id: string, kind: 'starter' | 'solution') =>
  runTypeScriptProject(ts, check, { files: { 'index.ts': read(id, kind), 'index.test.ts': read(id, 'test') }, tests: ['index.test.ts'] })

describe.each(index.exercises)('Node.js exercise %s', id => {
  it('passes every test with the reference solution, without type errors', async () => {
    const result = await run(id, 'solution')
    if (result.kind !== 'done') throw new Error(`${result.error} ${JSON.stringify(result.diagnostics ?? [])}`)
    expect(result.diagnostics ?? []).toEqual([])
    expect(result.outcomes.length).toBeGreaterThan(0)
    expect(result.outcomes.filter(outcome => !outcome.pass).map(outcome => `${outcome.name}: ${outcome.error}`)).toEqual([])
  })

  it('fails at least one test with the starter, without a syntax error', async () => {
    const result = await run(id, 'starter')
    if (result.kind !== 'done') throw new Error(`${result.error} ${JSON.stringify(result.diagnostics ?? [])}`)
    expect(result.outcomes.some(outcome => !outcome.pass)).toBe(true)
  })
})
