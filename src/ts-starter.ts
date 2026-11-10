import type { Problem } from './problem-types'

/**
 * TypeScript versions of a problem's JavaScript starter and solution. Code problems are written in JavaScript
 * and Python; for TypeScript the function signature is typed from the test cases (which every problem has), so
 * the body stays the learner's own. Starters that aren't a single plain function (design classes, test drivers)
 * keep their JavaScript with type-checking switched off, since their types can't be inferred from the tests.
 */

const LIST_KEYS = 'next,val'
const TREE_KEYS = 'left,right,val'

function shapeOf(value: unknown) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value).sort().join() : ''
}

/** The narrowest TypeScript type that covers every sample value. */
export function inferType(samples: unknown[], used: Set<string> = new Set()): string {
  const parts = new Set<string>()
  const items: unknown[] = []
  let arrays = false
  for (const value of samples) {
    if (value === null) parts.add('null')
    else if (Array.isArray(value)) { arrays = true; items.push(...value) }
    else if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') parts.add(typeof value)
    else if (shapeOf(value) === LIST_KEYS) { parts.add('ListNode'); used.add('ListNode') }
    else if (shapeOf(value) === TREE_KEYS) { parts.add('TreeNode'); used.add('TreeNode') }
    else parts.add('unknown')
  }
  if (arrays) {
    const item = items.length ? inferType(items, used) : 'unknown'
    parts.add(item.includes(' ') ? `(${item})[]` : `${item}[]`)
  }
  if (parts.has('unknown')) return 'unknown'
  const order = [...parts].sort((a, b) => Number(a === 'null') - Number(b === 'null'))
  return order.length ? order.join(' | ') : 'unknown'
}

/** Node values inside the linked lists or trees of the samples, for typing `val`. */
function nodeValues(samples: unknown[], keys: string, out: unknown[] = [], seen = new Set<unknown>()): unknown[] {
  for (const value of samples) {
    if (value === null || typeof value !== 'object' || seen.has(value)) continue
    seen.add(value)
    if (Array.isArray(value)) { nodeValues(value, keys, out, seen); continue }
    const node = value as Record<string, unknown>
    if (shapeOf(node) === keys) out.push(node.val)
    nodeValues(Object.values(node), keys, out, seen)
  }
  return out
}

const SIGNATURE = /^function (\w+)\(([^)]*)\) \{/

/** A typed signature for the problem's function, or undefined when it can't be inferred. */
function typedSignature(problem: Problem): { name: string; line: string; declarations: string[] } | undefined {
  const first = problem.starter.js.split('\n', 1)[0]
  const match = SIGNATURE.exec(first)
  const cases = [...problem.tests, ...problem.hiddenTests]
  if (!match || match[1] !== problem.function.js || !cases.length) return undefined
  const params = match[2].split(',').map(param => param.trim()).filter(Boolean)
  if (params.some(param => !/^\w+$/.test(param)) || cases.some(test => test.args.length !== params.length)) return undefined
  const used = new Set<string>()
  const typed = params.map((param, index) => `${param}: ${inferType(cases.map(test => test.args[index]), used)}`)
  const returns = inferType(cases.map(test => test.expected), used)
  const samples = cases.flatMap(test => [...test.args, test.expected])
  const declarations: string[] = []
  if (used.has('ListNode')) declarations.push(`interface ListNode {\n  val: ${inferType(nodeValues(samples, LIST_KEYS))}\n  next: ListNode | null\n}`)
  if (used.has('TreeNode')) declarations.push(`interface TreeNode {\n  val: ${inferType(nodeValues(samples, TREE_KEYS))}\n  left: TreeNode | null\n  right: TreeNode | null\n}`)
  return { name: match[1], line: `function ${match[1]}(${typed.join(', ')}): ${returns} {`, declarations }
}

function withSignature(code: string, signature: NonNullable<ReturnType<typeof typedSignature>>) {
  const lines = code.split('\n')
  if (!SIGNATURE.test(lines[0]) || SIGNATURE.exec(lines[0])![1] !== signature.name) return undefined
  lines[0] = lines[0].replace(SIGNATURE, signature.line)
  return [...signature.declarations.map(block => `${block}\n`), lines.join('\n')].join('\n')
}

export const UNTYPED_NOTE = '// @ts-nocheck — this starter is untyped JavaScript. Add types, then delete this line to type-check.'

/** The TypeScript starter: the JavaScript starter with a typed signature (and node interfaces) when possible. */
export function tsStarter(problem: Problem): string {
  const signature = typedSignature(problem)
  return (signature && withSignature(problem.starter.js, signature)) ?? `${UNTYPED_NOTE}\n${problem.starter.js}`
}

/** The JavaScript solution with the same typed signature, or undefined when it can't be typed. */
export function tsSolution(problem: Problem): string | undefined {
  const signature = typedSignature(problem)
  return signature && withSignature(problem.solution.js, signature)
}
