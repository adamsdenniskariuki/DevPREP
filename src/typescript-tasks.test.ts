import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { createProjectChecker, runTypeScriptProject } from './runner/project'
import { libClosure, TS_ENTRY_LIB, TS_RUNTIME_DECLARATIONS } from './runner/ts-core'
import { typeScriptTaskCount, withTypeCheck } from './typescript-tasks'

const readLib = (name: string) => readFileSync(resolve('node_modules/typescript/lib', name), 'utf8')
const libs = Object.fromEntries(libClosure(readLib).map(name => [name, readLib(name)]))
const check = createProjectChecker(ts, libs, TS_ENTRY_LIB, TS_RUNTIME_DECLARATIONS)

const dir = join(process.cwd(), 'content', 'typescript-tasks')
const index = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8')) as { exercises: string[] }
const read = (id: string, kind: string) => readFileSync(join(dir, `${id}.${kind}.ts`), 'utf8')
const run = async (id: string, code: string) =>
  withTypeCheck(await runTypeScriptProject(ts, check, { files: { 'index.ts': code, 'index.test.ts': read(id, 'test') }, tests: ['index.test.ts'] }))

describe.each(index.exercises)('TypeScript skill-test task %s', id => {
  it('passes every test and the type check with the reference solution', async () => {
    const result = await run(id, read(id, 'solution'))
    if (result.kind !== 'done') throw new Error(JSON.stringify(result))
    expect(result.outcomes.filter(outcome => !outcome.pass).map(outcome => `${outcome.name}: ${outcome.error}`)).toEqual([])
    expect(result.outcomes).toHaveLength(typeScriptTaskCount(read(id, 'test')))
  })

  it('fails with the starter, without a syntax error', async () => {
    const result = await run(id, read(id, 'starter'))
    if (result.kind !== 'done') throw new Error(JSON.stringify(result))
    expect(result.outcomes.some(outcome => !outcome.pass)).toBe(true)
  })
})

describe('the type check result', () => {
  it('fails a run whose tests pass when the code has a type error', async () => {
    const solution = read('parse-config', 'solution')
    const result = await run('parse-config', solution.replace('return { ok: true, value: { port, host, tags, mode } }', 'const p: string = port\n  return { ok: true, value: { port: Number(p), host, tags, mode } }'))
    if (result.kind !== 'done') throw new Error(result.kind)
    const typeCheck = result.outcomes.at(-1)
    expect(typeCheck?.name).toBe('Type check')
    expect(typeCheck?.pass).toBe(false)
    expect(typeCheck?.error).toMatch(/index\.ts/)
    expect(result.outcomes.slice(0, -1).every(outcome => outcome.pass)).toBe(true)
  })

  it('leaves timeouts and load errors alone', () => {
    expect(withTypeCheck({ kind: 'timeout', ms: 1, limitMs: 1 })).toEqual({ kind: 'timeout', ms: 1, limitMs: 1 })
  })
})
