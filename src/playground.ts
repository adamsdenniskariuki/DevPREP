import { MAX_CODE_LENGTH } from './code-drafts'

/** Playground snippets live in localStorage apart from progress. They are small and capped, and ride along in backups. */
export const PLAYGROUND_KEY = 'devprep.playground.v1'
export const MAX_SNIPPETS = 50
export const MAX_SNIPPET_NAME = 80
export const MAX_STDIN_LENGTH = 10_000
export const SNIPPET_ID = /^[a-z0-9-]{1,64}$/
export const SNIPPET_LANGS = ['js', 'ts', 'py', 'sql'] as const
export type SnippetLang = typeof SNIPPET_LANGS[number]

export const LANG_LABELS: Record<SnippetLang, string> = { js: 'JavaScript', ts: 'TypeScript', py: 'Python', sql: 'SQL' }

export interface Snippet {
  id: string
  name: string
  lang: SnippetLang
  code: string
  /** Text fed to input()/readline() for Python and JavaScript runs. */
  stdin?: string
  createdAt: string
  updatedAt: string
}

export const STARTERS: Record<SnippetLang, string> = {
  js: `// JavaScript runs in a sandboxed worker (5 s limit, no network).
// console.log prints; a top-level \`return\` shows a value.
// readline() and input() read lines from the stdin box.
const name = readline() ?? 'world'
console.log(\`Hello, \${name}!\`)

const squares = [1, 2, 3, 4].map(n => n * n)
return squares
`,
  ts: `// TypeScript is type-checked, then run as JavaScript (no network).
// Type errors are listed, but the code still runs.
interface Point { x: number; y: number }

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

console.log(distance({ x: 0, y: 0 }, { x: 3, y: 4 }))
return distance({ x: 1, y: 1 }, { x: 4, y: 5 })
`,
  py: `# Python (Pyodide, standard library only; 10 s limit, no network).
# input() reads lines from the stdin box. The last expression's value is shown.
name = input("Name? ")
print(f"Hello, {name}!")

from collections import Counter
Counter("mississippi").most_common(2)
`,
  sql: `-- Postgres in your browser. This database is kept on this device between visits.
-- Load the sample data, or create your own tables. Separate statements with ;
SELECT c.name, count(o.id) AS orders, coalesce(sum(o.total), 0) AS spent
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.name
ORDER BY spent DESC;
`,
}

export const DEFAULT_STDIN = 'Ada\n'

const isRec = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const isTimestamp = (value: unknown): value is string => typeof value === 'string' && ISO.test(value) && new Date(value).toISOString() === value
const KEYS = ['id', 'name', 'lang', 'code', 'createdAt', 'updatedAt']
const OPTIONAL = ['stdin']

/** Checks one snippet; returns a reason when it is not valid. */
function problem(value: unknown): string | undefined {
  if (!isRec(value)) return 'a snippet is not an object.'
  if (Object.keys(value).some(key => !KEYS.includes(key) && !OPTIONAL.includes(key)) || KEYS.some(key => !Object.hasOwn(value, key))) return 'a snippet has unexpected or missing fields.'
  if (typeof value.id !== 'string' || !SNIPPET_ID.test(value.id)) return 'a snippet has an invalid id.'
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.length > MAX_SNIPPET_NAME) return 'a snippet has an invalid name.'
  if (!SNIPPET_LANGS.includes(value.lang as SnippetLang)) return `snippet “${value.name}” has an unknown language.`
  if (typeof value.code !== 'string') return `snippet “${value.name}” has no code.`
  if (value.code.length > MAX_CODE_LENGTH) return `snippet “${value.name}” is longer than ${MAX_CODE_LENGTH.toLocaleString('en')} characters.`
  if (Object.hasOwn(value, 'stdin') && (typeof value.stdin !== 'string' || value.stdin.length > MAX_STDIN_LENGTH)) return `snippet “${value.name}” has invalid input text.`
  if (!isTimestamp(value.createdAt) || !isTimestamp(value.updatedAt)) return `snippet “${value.name}” has an invalid timestamp.`
}

function clean(value: Record<string, unknown>): Snippet {
  return {
    id: value.id as string, name: value.name as string, lang: value.lang as SnippetLang, code: value.code as string,
    ...typeof value.stdin === 'string' ? { stdin: value.stdin } : {},
    createdAt: value.createdAt as string, updatedAt: value.updatedAt as string,
  }
}

/** Validates snippets from a backup file. Throws "Invalid backup: …" on the first problem. */
export function parseSnippets(value: unknown): Snippet[] {
  if (!Array.isArray(value)) throw new Error('Invalid backup: playground snippets must be a list.')
  if (value.length > MAX_SNIPPETS) throw new Error(`Invalid backup: more than ${MAX_SNIPPETS} playground snippets.`)
  const ids = new Set<string>()
  return value.map(item => {
    const reason = problem(item)
    if (reason) throw new Error(`Invalid backup: ${reason}`)
    const snippet = clean(item as Record<string, unknown>)
    if (ids.has(snippet.id)) throw new Error('Invalid backup: two playground snippets share an id.')
    ids.add(snippet.id)
    return snippet
  })
}

/** Snippets saved on this device, newest first. Anything malformed is skipped rather than breaking the page. */
export function readSnippets(): Snippet[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(PLAYGROUND_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    const seen = new Set<string>()
    const list: Snippet[] = []
    for (const item of parsed) {
      if (problem(item) || seen.has((item as Snippet).id)) continue
      seen.add((item as Snippet).id)
      list.push(clean(item as Record<string, unknown>))
    }
    return sortSnippets(list).slice(0, MAX_SNIPPETS)
  } catch {
    return []
  }
}

export function sortSnippets(list: Snippet[]): Snippet[] {
  return [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.name.localeCompare(b.name))
}

/** Saves the whole list; returns false when the browser refused (private mode, quota). */
export function writeSnippets(list: Snippet[]): boolean {
  try {
    window.localStorage.setItem(PLAYGROUND_KEY, JSON.stringify(list.slice(0, MAX_SNIPPETS)))
    return true
  } catch {
    return false
  }
}

export function newSnippetId(taken: Iterable<string> = []): string {
  const used = new Set(taken)
  for (;;) {
    const id = `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    if (!used.has(id)) return id
  }
}

/** A name not already used: "JavaScript snippet", "JavaScript snippet 2", … */
export function uniqueName(base: string, list: Snippet[]): string {
  const trimmed = base.trim().slice(0, MAX_SNIPPET_NAME - 4) || 'Snippet'
  const names = new Set(list.map(snippet => snippet.name))
  if (!names.has(trimmed)) return trimmed
  for (let n = 2; ; n++) if (!names.has(`${trimmed} ${n}`)) return `${trimmed} ${n}`
}

export function makeSnippet(list: Snippet[], lang: SnippetLang, options: { name?: string; code?: string; stdin?: string } = {}, now = new Date()): Snippet {
  if (list.length >= MAX_SNIPPETS) throw new Error(`You can keep up to ${MAX_SNIPPETS} snippets. Delete one to make room.`)
  const at = now.toISOString()
  const code = (options.code ?? STARTERS[lang]).slice(0, MAX_CODE_LENGTH)
  const stdin = options.stdin ?? (lang === 'js' || lang === 'py' ? DEFAULT_STDIN : undefined)
  return {
    id: newSnippetId(list.map(snippet => snippet.id)),
    name: uniqueName(options.name ?? `${LANG_LABELS[lang]} snippet`, list),
    lang, code, ...stdin !== undefined ? { stdin: stdin.slice(0, MAX_STDIN_LENGTH) } : {},
    createdAt: at, updatedAt: at,
  }
}

export function duplicateSnippet(list: Snippet[], source: Snippet, now = new Date()): Snippet {
  return makeSnippet(list, source.lang, { name: `${source.name} copy`, code: source.code, stdin: source.stdin ?? '' }, now)
}

/** Applies an edit and bumps updatedAt. Code, names and input are clamped to the caps. */
export function editSnippet(snippet: Snippet, patch: Partial<Pick<Snippet, 'name' | 'lang' | 'code' | 'stdin'>>, now = new Date()): Snippet {
  const next = { ...snippet, ...patch, updatedAt: now.toISOString() }
  next.name = next.name.trim().slice(0, MAX_SNIPPET_NAME) || snippet.name
  next.code = next.code.slice(0, MAX_CODE_LENGTH)
  if (next.stdin !== undefined) next.stdin = next.stdin.slice(0, MAX_STDIN_LENGTH)
  return next
}

/** Snippet ids and names for search, without validating everything twice. */
export function snippetIndex(): { id: string; name: string; lang: SnippetLang }[] {
  return readSnippets().map(({ id, name, lang }) => ({ id, name, lang }))
}

/**
 * "Open in Playground": copies code into a new snippet and returns its id. Throws a readable error when the
 * list is full or storage refuses, so nothing is replaced silently.
 */
export function saveAsSnippet(lang: SnippetLang, name: string, code: string, now = new Date()): string {
  const list = readSnippets()
  const snippet = makeSnippet(list, lang, { name, code }, now)
  if (!writeSnippets([snippet, ...list])) throw new Error('This browser would not save the snippet (private mode or storage full).')
  return snippet.id
}