import { describe, expect, it } from 'vitest'
import { fuzzyScore } from './fuzzy'

const rank = (query: string, texts: string[]) => texts
  .map(text => ({ text, score: fuzzyScore(query, text) }))
  .filter((item): item is { text: string; score: number } => item.score !== null)
  .sort((a, b) => b.score - a.score)
  .map(item => item.text)

describe('fuzzyScore', () => {
  it('matches everything with an empty query and nothing when letters are missing or out of order', () => {
    expect(fuzzyScore('', 'Two sum')).toBe(0)
    expect(fuzzyScore('   ', 'Two sum')).toBe(0)
    expect(fuzzyScore('xyz', 'Two sum')).toBeNull()
    expect(fuzzyScore('mus', 'Two sum')).toBeNull()
    expect(fuzzyScore('two sumz', 'Two sum')).toBeNull()
  })

  it('is case, accent and whitespace insensitive', () => {
    expect(fuzzyScore('TWO   SUM', 'two sum')).toBe(fuzzyScore('two sum', 'Two Sum'))
    expect(fuzzyScore('cafe', 'Café orders')).not.toBeNull()
  })

  it('matches letters in order as a subsequence', () => {
    expect(fuzzyScore('dkst', 'Dijkstra')).not.toBeNull()
    expect(fuzzyScore('bfs', 'Breadth-first search')).not.toBeNull()
  })

  it('ranks exact over prefix over word start over mid-word over scattered letters', () => {
    expect(rank('graph', ['Paragraphs', 'Graph colouring', 'Graph', 'Knowledge graphs', 'gxrxaxpxh'])).toEqual(['Graph', 'Graph colouring', 'Knowledge graphs', 'Paragraphs', 'gxrxaxpxh'])
  })

  it('rewards word starts in subsequence matches (acronyms)', () => {
    const acronym = fuzzyScore('lru', 'Least recently used cache')!
    const scattered = fuzzyScore('lru', 'Bulk rerun')!
    expect(acronym).toBeGreaterThan(scattered)
  })

  it('requires every query word and does not care about word order', () => {
    expect(fuzzyScore('cache lru', 'LRU cache')).not.toBeNull()
    expect(fuzzyScore('cache tree', 'LRU cache')).toBeNull()
  })

  it('prefers shorter texts when matches are otherwise equal', () => {
    expect(fuzzyScore('sum', 'Two sum')!).toBeGreaterThan(fuzzyScore('sum', 'Two sum with a much longer title')!)
  })
})
