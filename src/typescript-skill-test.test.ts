import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { createProjectChecker } from './runner/project'
import { libClosure, TS_ENTRY_LIB, TS_RUNTIME_DECLARATIONS } from './runner/ts-core'
import type { SkillTest } from './skill-tests'

const readLib = (name: string) => readFileSync(resolve('node_modules/typescript/lib', name), 'utf8')
const libs = Object.fromEntries(libClosure(readLib).map(name => [name, readLib(name)]))
const check = createProjectChecker(ts, libs, TS_ENTRY_LIB, TS_RUNTIME_DECLARATIONS)

const test = JSON.parse(readFileSync(resolve('content/skill-tests/typescript.json'), 'utf8')) as SkillTest
const plain = (choice: string) => choice.replace(/^`|`$/g, '')
const errorsIn = (code: string) => check({ 'index.ts': code }).filter(diagnostic => diagnostic.file === 'index.ts')

/** Snippets whose answer is what they print, a type they declare, or whether they compile. */
const PRINTS = [
  'scope-var-loop', 'scope-counter', 'scope-hoisting', 'this-arrow-field', 'this-bind-call', 'this-prototype-chain', 'eq-nan', 'eq-plus-minus',
  'loop-order', 'loop-await', 'loop-nested', 'async-allsettled', 'coll-sort', 'coll-map-set-keys', 'mod-error-cause', 'class-param-props', 'enum-reverse',
]
const TYPES: Record<string, string> = {
  'types-widening': 'T', 'types-never': 'T', 'gen-infer-union': 'V', 'gen-keyof': 'R', 'gen-const-param': 'R', 'narrow-filter': 'R',
  'mapped-optional': 'R', 'cond-distributive': 'R', 'cond-infer': 'R', 'mapped-remap': 'R', 'enum-as-const': 'R', 'cfg-index-access': 'R',
}
/** Snippets that compile but whose question is about runtime behaviour. */
const COMPILE_ONLY = ['this-detached', 'async-foreach', 'async-return-await']

const question = (id: string) => {
  const found = test.questions.find(item => item.id === id)
  if (!found?.code) throw new Error(`no question with code: ${id}`)
  return { ...found, code: found.code }
}

async function output(code: string) {
  const js = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  const lines: string[] = []
  new Function('console', js)({ log: (...args: unknown[]) => lines.push(args.map(String).join(' ')) })
  await new Promise(done => setTimeout(done, 20))
  return lines.join(' ')
}

describe('TypeScript skill test snippets', () => {
  it('checks every code snippet one way or another', () => {
    const covered = new Set([...PRINTS, ...Object.keys(TYPES), ...COMPILE_ONLY, ...test.questions.filter(item => item.prompt.startsWith('Does this compile')).map(item => item.id)])
    expect(test.questions.filter(item => item.code && !covered.has(item.id)).map(item => item.id)).toEqual([])
  })

  it.each(PRINTS)('%s compiles and prints the keyed answer', async id => {
    const { code, choices, answer } = question(id)
    expect(errorsIn(code)).toEqual([])
    expect(await output(code)).toBe(plain(choices[answer]))
  })

  it.each(Object.entries(TYPES))('%s declares %s as the keyed answer', (id, probe) => {
    const { code, choices, answer } = question(id)
    expect(errorsIn(code)).toEqual([])
    const assertion = `${code}\ntype __Equal<A, B> = (<X>() => X extends A ? 1 : 2) extends (<X>() => X extends B ? 1 : 2) ? true : false\nconst __same: __Equal<${probe}, ${plain(choices[answer])}> = true\nexport {}`
    expect(errorsIn(assertion).map(diagnostic => diagnostic.message)).toEqual([])
  })

  it.each(test.questions.filter(item => item.prompt.startsWith('Does this compile')).map(item => item.id))('%s compiles exactly when the keyed answer says yes', id => {
    const { code, choices, answer } = question(id)
    expect(errorsIn(code).length === 0).toBe(choices[answer].startsWith('Yes'))
  })

  it.each(COMPILE_ONLY)('%s compiles, as its prompt says', id => {
    expect(errorsIn(question(id).code)).toEqual([])
  })
})
