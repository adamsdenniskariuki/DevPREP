import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import legacyBackup from '../tests/fixtures/v1-progress.json' with { type: 'json' }
import { MAX_CODE_LENGTH } from './code-drafts'
import { MAX_SNIPPETS_BYTES, parseFullBackup, serializeFullBackup } from './board-backup'
import {
  DEFAULT_STDIN, duplicateSnippet, editSnippet, makeSnippet, MAX_SNIPPET_NAME, MAX_SNIPPETS, MAX_STDIN_LENGTH, parseSnippets, PLAYGROUND_KEY,
  readSnippets, saveAsSnippet, SNIPPET_ID, SNIPPET_LANGS, snippetIndex, STARTERS, writeSnippets, type Snippet,
} from './playground'
import { emptyProgress, serializeBackup } from './progress'

class MemoryStorage {
  data = new Map<string, string>()
  full = false
  getItem(key: string) { return this.data.get(key) ?? null }
  setItem(key: string, value: string) { if (this.full) throw new Error('QuotaExceededError'); this.data.set(key, value) }
  removeItem(key: string) { this.data.delete(key) }
}

const at = '2026-10-01T10:00:00.000Z'
const later = '2026-10-02T09:30:00.000Z'
function snippet(id: string, extra: Partial<Snippet> = {}): Snippet {
  return { id, name: `Snippet ${id}`, lang: 'js', code: 'console.log(1)', createdAt: at, updatedAt: at, ...extra }
}

let storage: MemoryStorage
beforeEach(() => {
  storage = new MemoryStorage()
  vi.stubGlobal('window', { localStorage: storage })
})
afterEach(() => { vi.unstubAllGlobals() })

describe('snippet storage', () => {
  it('starts empty and round-trips snippets newest first', () => {
    expect(readSnippets()).toEqual([])
    const list = [snippet('a'), snippet('b', { updatedAt: later, lang: 'py', stdin: 'x\ny\n' })]
    expect(writeSnippets(list)).toBe(true)
    expect(readSnippets().map(item => item.id)).toEqual(['b', 'a'])
    expect(readSnippets()[0].stdin).toBe('x\ny\n')
    expect(snippetIndex()).toEqual([{ id: 'b', name: 'Snippet b', lang: 'py' }, { id: 'a', name: 'Snippet a', lang: 'js' }])
  })

  it('skips malformed or duplicate items instead of breaking the page', () => {
    storage.setItem(PLAYGROUND_KEY, JSON.stringify([snippet('ok'), { id: 'bad' }, snippet('ok'), snippet('Bad Id'), snippet('x', { lang: 'rb' as never }), 'junk']))
    expect(readSnippets().map(item => item.id)).toEqual(['ok'])
    storage.setItem(PLAYGROUND_KEY, '{not json')
    expect(readSnippets()).toEqual([])
    storage.setItem(PLAYGROUND_KEY, '{"a":1}')
    expect(readSnippets()).toEqual([])
  })

  it('reports when the browser refuses to save', () => {
    storage.full = true
    expect(writeSnippets([snippet('a')])).toBe(false)
    expect(() => saveAsSnippet('js', 'Two sum', 'return 1')).toThrow('would not save')
  })

  it('makes snippets with starters, unique names and valid ids', () => {
    const now = new Date(at)
    const first = makeSnippet([], 'js', {}, now)
    expect(first).toMatchObject({ name: 'JavaScript snippet', lang: 'js', code: STARTERS.js, stdin: DEFAULT_STDIN, createdAt: at, updatedAt: at })
    expect(first.id).toMatch(SNIPPET_ID)
    const second = makeSnippet([first], 'js', {}, now)
    expect(second.name).toBe('JavaScript snippet 2')
    expect(second.id).not.toBe(first.id)
    expect(makeSnippet([], 'sql', {}, now)).not.toHaveProperty('stdin')
    expect(makeSnippet([], 'ts', {}, now)).not.toHaveProperty('stdin')
    for (const lang of SNIPPET_LANGS) expect(STARTERS[lang].length).toBeGreaterThan(20)
    expect(makeSnippet([], 'py', { code: 'x'.repeat(MAX_CODE_LENGTH + 5) }, now).code).toHaveLength(MAX_CODE_LENGTH)
  })

  it('caps the number of snippets', () => {
    const list = Array.from({ length: MAX_SNIPPETS }, (_, index) => snippet(`s${index}`))
    expect(() => makeSnippet(list, 'js')).toThrow(`up to ${MAX_SNIPPETS} snippets`)
    expect(() => duplicateSnippet(list, list[0])).toThrow(`up to ${MAX_SNIPPETS} snippets`)
    writeSnippets([...list, snippet('extra')])
    expect(readSnippets()).toHaveLength(MAX_SNIPPETS)
  })

  it('renames, edits and duplicates with clamping and fresh timestamps', () => {
    const base = snippet('a', { stdin: 'in' })
    const edited = editSnippet(base, { name: '  Renamed  ', code: 'y'.repeat(MAX_CODE_LENGTH + 1), stdin: 'z'.repeat(MAX_STDIN_LENGTH + 1) }, new Date(later))
    expect(edited).toMatchObject({ id: 'a', name: 'Renamed', createdAt: at, updatedAt: later })
    expect(edited.code).toHaveLength(MAX_CODE_LENGTH)
    expect(edited.stdin).toHaveLength(MAX_STDIN_LENGTH)
    expect(editSnippet(base, { name: '   ' }).name).toBe('Snippet a')
    expect(editSnippet(base, { name: 'n'.repeat(200) }).name).toHaveLength(MAX_SNIPPET_NAME)
    const copy = duplicateSnippet([base], base, new Date(later))
    expect(copy).toMatchObject({ name: 'Snippet a copy', lang: 'js', code: base.code, stdin: 'in', createdAt: later })
    expect(copy.id).not.toBe(base.id)
  })

  it('saves code from a problem as a new snippet for "Open in Playground"', () => {
    writeSnippets([snippet('old')])
    const id = saveAsSnippet('py', 'Two sum', 'def two_sum(nums, target):\n    pass\n', new Date(later))
    const [made, old] = readSnippets()
    expect(made).toMatchObject({ id, name: 'Two sum', lang: 'py', code: 'def two_sum(nums, target):\n    pass\n' })
    expect(old.id).toBe('old')
    expect(saveAsSnippet('sql', 'Two sum', 'SELECT 1')).not.toBe(id)
    expect(readSnippets().map(item => item.name)).toContain('Two sum 2')
  })
})

describe('parseSnippets (backup validation)', () => {
  it('accepts valid snippets and drops nothing', () => {
    const list = [snippet('a'), snippet('b', { lang: 'sql' }), snippet('c', { lang: 'py', stdin: '' })]
    expect(parseSnippets(list)).toEqual(list)
  })

  it.each([
    ['not a list', { a: 1 }, 'must be a list'],
    ['too many', Array.from({ length: MAX_SNIPPETS + 1 }, (_, index) => snippet(`s${index}`)), `more than ${MAX_SNIPPETS}`],
    ['not an object', ['x'], 'not an object'],
    ['missing field', [{ id: 'a', name: 'A', lang: 'js', code: '', createdAt: at }], 'unexpected or missing fields'],
    ['extra field', [{ ...snippet('a'), owner: 'me' }], 'unexpected or missing fields'],
    ['bad id', [snippet('../etc')], 'invalid id'],
    ['blank name', [snippet('a', { name: ' ' })], 'invalid name'],
    ['long name', [snippet('a', { name: 'n'.repeat(MAX_SNIPPET_NAME + 1) })], 'invalid name'],
    ['unknown language', [snippet('a', { lang: 'rb' as never })], 'unknown language'],
    ['code not text', [snippet('a', { code: 5 as never })], 'has no code'],
    ['code too long', [snippet('a', { code: 'x'.repeat(MAX_CODE_LENGTH + 1) })], 'longer than'],
    ['stdin too long', [snippet('a', { stdin: 'x'.repeat(MAX_STDIN_LENGTH + 1) })], 'invalid input text'],
    ['bad timestamp', [snippet('a', { updatedAt: 'yesterday' })], 'invalid timestamp'],
    ['duplicate ids', [snippet('a'), snippet('a')], 'share an id'],
  ])('rejects %s', (_, value, message) => {
    expect(() => parseSnippets(value)).toThrow(message)
    expect(() => parseSnippets(value)).toThrow(/^Invalid backup: /)
  })
})

describe('backups with Playground snippets', () => {
  const progress = emptyProgress(new Date(at))

  it('round-trips snippets with progress, and with whiteboards too', () => {
    const list = [snippet('a', { stdin: 'Ada\n' }), snippet('b', { lang: 'sql', code: 'SELECT 1;' })]
    const text = serializeFullBackup(progress, undefined, list)
    const parsed = parseFullBackup(text)
    expect(parsed.progress).toEqual(progress)
    expect(parsed.playground).toEqual(list)
    expect(parsed).not.toHaveProperty('boards')
    const both = parseFullBackup(serializeFullBackup(progress, [], list))
    expect(both.boards).toEqual([])
    expect(both.playground).toEqual(list)
  })

  it('keeps the old format when there are no snippets', () => {
    expect(serializeFullBackup(progress, undefined, [])).toBe(serializeBackup(progress))
    expect(serializeFullBackup(progress)).toBe(serializeBackup(progress))
    expect(parseFullBackup(serializeBackup(progress))).not.toHaveProperty('playground')
  })

  it('imports old v1 backups unchanged, leaving device snippets alone', () => {
    const parsed = parseFullBackup(JSON.stringify(legacyBackup))
    expect(parsed).not.toHaveProperty('playground')
    expect(parsed.progress.records).toBeTypeOf('object')
  })

  it('treats an empty list as "replace with none", distinct from no key', () => {
    const text = JSON.stringify({ ...JSON.parse(serializeBackup(progress)), playground: [] })
    expect(parseFullBackup(text).playground).toEqual([])
  })

  it('rejects malformed or oversized snippets with a clear message', () => {
    const withPlayground = (value: unknown) => JSON.stringify({ ...JSON.parse(serializeBackup(progress)), playground: value })
    expect(() => parseFullBackup(withPlayground('nope'))).toThrow('Invalid backup: playground snippets must be a list.')
    expect(() => parseFullBackup(withPlayground([snippet('a', { lang: 'rb' as never })]))).toThrow('unknown language')
    const huge = [snippet('a', { code: '"'.repeat(MAX_SNIPPETS_BYTES / 2 + 10) })]
    expect(() => parseFullBackup(withPlayground(huge))).toThrow('Playground snippets add up to more than 2.0 MB')
  })

  it('drops unknown fields when serializing', () => {
    const extra = { ...snippet('a'), junk: true } as Snippet
    expect(parseFullBackup(serializeFullBackup(progress, undefined, [extra])).playground).toEqual([snippet('a')])
  })
})
