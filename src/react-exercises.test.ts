// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { runReactInJsdom } from './runner/react-jsdom'

const dir = join(process.cwd(), 'content', 'react', 'exercises')
const index = JSON.parse(readFileSync(join(process.cwd(), 'content', 'react', 'index.json'), 'utf8')) as { exercises: string[] }
const read = (id: string, kind: string) => readFileSync(join(dir, `${id}.${kind}.tsx`), 'utf8')

describe.each(index.exercises)('React exercise %s', id => {
  it('passes every test with the reference solution', async () => {
    const { result } = await runReactInJsdom(read(id, 'solution'), read(id, 'test'))
    if (result.kind !== 'done') throw new Error(`${result.error} ${JSON.stringify(result.diagnostics ?? [])}`)
    expect(result.outcomes.filter(outcome => !outcome.pass).map(outcome => `${outcome.name}: ${outcome.error}`)).toEqual([])
  })

  it('fails at least one test with the starter, without a syntax error', async () => {
    const { result } = await runReactInJsdom(read(id, 'starter'), read(id, 'test'))
    if (result.kind !== 'done') throw new Error(`${result.error} ${JSON.stringify(result.diagnostics ?? [])}`)
    expect(result.outcomes.some(outcome => !outcome.pass)).toBe(true)
  })
})
