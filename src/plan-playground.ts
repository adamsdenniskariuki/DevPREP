import { makeSnippet, readSnippets, writeSnippets, type Snippet } from './playground'
import { planLanguage } from './study-plans'

/** Blank "rewrite from memory" templates for each plan language. */
export const REWRITE_TEMPLATES = {
  py: `# Rewrite one of today's solutions from memory.
# Say the time and space complexity first, then check the edge cases below.

def solve(nums: list[int]) -> int:
    return 0


print(solve([]))
print(solve([1]))
print(solve([2, 2, 3]))
`,
  ts: `// Rewrite one of today's solutions from memory.
// Say the time and space complexity first, then check the edge cases below.

function solve(nums: number[]): number {
  return 0
}

console.log(solve([]))
console.log(solve([1]))
console.log(solve([2, 2, 3]))
`,
} as const

/**
 * The plan's Playground snippet for a language: reuses "Rewrite from memory (<language>)" when it exists, so
 * daily rewrites don't fill the snippet list, or creates it from the template. Returns the snippet id; throws a
 * readable error when the list is full or storage refuses.
 */
export function planSnippet(lang: string | undefined, now = new Date()): string {
  const { code, label } = planLanguage(lang)
  const name = `Rewrite from memory (${label})`
  const list = readSnippets()
  const existing = list.find(snippet => snippet.name === name && snippet.lang === code)
  if (existing) return existing.id
  const snippet: Snippet = makeSnippet(list, code, { name, code: REWRITE_TEMPLATES[code], ...code === 'py' ? { stdin: '' } : {} }, now)
  if (!writeSnippets([snippet, ...list])) throw new Error('This browser would not save the snippet (private mode or storage full).')
  return snippet.id
}
