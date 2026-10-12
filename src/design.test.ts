import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BOARD_HEIGHT, BOARD_WIDTH, cleanBoard, clearDesignDraft, DESIGN_DRAFTS_KEY, MAX_NODES, NODE_HEIGHT, NODE_WIDTH, readDesignDraft, writeDesignDraft } from './design-drafts'
import { rubricPercent, scoredItems } from './design-score'
import { describeBoard, modelBoard } from './components/Whiteboard'
import { loadCases } from './cases'

class MemoryStorage {
  data = new Map<string, string>()
  getItem(key: string) { return this.data.get(key) ?? null }
  setItem(key: string, value: string) { this.data.set(key, value) }
}

describe('design drafts', () => {
  let storage: MemoryStorage
  beforeEach(() => { storage = new MemoryStorage(); vi.stubGlobal('window', { localStorage: storage }) })
  afterEach(() => { vi.unstubAllGlobals() })

  it('merges patches, deletes undefined fields and clears entries', () => {
    expect(writeDesignDraft('url-shortener', { notes: { api: 'POST /links' } })).toBe(true)
    expect(writeDesignDraft('url-shortener', { timer: { remaining: 1000 } })).toBe(true)
    expect(readDesignDraft('url-shortener')).toEqual({ notes: { api: 'POST /links' }, timer: { remaining: 1000 } })
    writeDesignDraft('url-shortener', { timer: undefined })
    expect(readDesignDraft('url-shortener')).toEqual({ notes: { api: 'POST /links' } })
    expect(clearDesignDraft('url-shortener')).toBe(true)
    expect(readDesignDraft('url-shortener')).toEqual({})
  })

  it('ignores unknown note keys and survives corrupt storage', () => {
    storage.setItem(DESIGN_DRAFTS_KEY, JSON.stringify({ a: { notes: { api: 'x', bogus: 'y' }, timer: { remaining: -5 } } }))
    expect(readDesignDraft('a')).toEqual({ notes: { api: 'x' }, timer: {} })
    storage.setItem(DESIGN_DRAFTS_KEY, '{not json')
    expect(readDesignDraft('a')).toEqual({})
  })

  it('keeps at most 100 entries, dropping the oldest', () => {
    for (let i = 0; i < 105; i++) writeDesignDraft(`case-${i}`, { notes: { api: String(i) } })
    const all = JSON.parse(storage.getItem(DESIGN_DRAFTS_KEY)!)
    expect(Object.keys(all)).toHaveLength(100)
    expect(all['case-0']).toBeUndefined()
    expect(all['case-104']).toBeDefined()
  })

  it('reports a refused write', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem: () => { throw new Error('quota') } } })
    expect(writeDesignDraft('a', { notes: {} })).toBe(false)
  })
})

describe('cleanBoard', () => {
  it('drops malformed nodes, dangling or duplicate edges and clamps positions', () => {
    const board = cleanBoard({
      nodes: [
        { id: 'a', kind: 'service', label: 'API', x: -50, y: 9999 },
        { id: 'a', kind: 'cache', label: 'dupe', x: 0, y: 0 },
        { id: 'b', kind: 'not-a-kind', label: 'bad', x: 0, y: 0 },
        { id: 'c', kind: 'db', label: 'x'.repeat(100), x: 10.4, y: Number.NaN },
        { id: 'd', kind: 'db', x: 10.4, y: 20.6 },
      ],
      edges: [{ from: 'a', to: 'd', label: '  reads  ' }, { from: 'a', to: 'd' }, { from: 'a', to: 'b' }, { from: 'd', to: 'd' }],
    })
    expect(board.nodes).toEqual([
      { id: 'a', kind: 'service', label: 'API', x: 0, y: BOARD_HEIGHT - NODE_HEIGHT },
      { id: 'd', kind: 'db', label: '', x: 10, y: 21 },
    ])
    expect(board.edges).toEqual([{ from: 'a', to: 'd', label: 'reads' }])
    expect(cleanBoard('nope')).toEqual({ nodes: [], edges: [] })
    expect(cleanBoard({ nodes: Array.from({ length: 80 }, (_, i) => ({ id: `n${i}`, kind: 'service', label: '', x: 0, y: 0 })) }).nodes).toHaveLength(MAX_NODES)
  })
})

describe('model diagrams', () => {
  it('fit every case diagram on the board and describe each edge', async () => {
    for (const item of (await loadCases()).values()) {
      const board = modelBoard(item.diagram)
      for (const node of board.nodes) {
        expect(node.x + NODE_WIDTH).toBeLessThanOrEqual(BOARD_WIDTH)
        expect(node.y + NODE_HEIGHT).toBeLessThanOrEqual(BOARD_HEIGHT)
      }
      expect(cleanBoard(board)).toEqual(board)
      expect(describeBoard(board)).toHaveLength(board.nodes.length + board.edges.length)
    }
  })
})

describe('rubric scoring', () => {
  const rubric = [{ text: 'a' }, { text: 'b' }, { text: 'c', sse: true as const }]
  it('scores SSE items only when included', () => {
    expect(scoredItems(rubric, false)).toEqual([0, 1])
    expect(scoredItems(rubric, true)).toEqual([0, 1, 2])
    expect(rubricPercent(rubric, [2, 1, undefined], false)).toBe(75)
    expect(rubricPercent(rubric, [2, 1, undefined], true)).toBeUndefined()
    expect(rubricPercent(rubric, [2, 1, 0], true)).toBe(50)
    expect(rubricPercent(rubric, [2, 2, 2], true)).toBe(100)
    expect(rubricPercent([], [], true)).toBeUndefined()
  })
})
