import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { elementProblems } from './board-elements'
import {
  createAutosave, createBoard, deleteBoard, deleteBoardsDatabase, excalidrawFile, findBoards, getBoard, savePractice, legacyElements, listBoards,
  migrateLegacyBoard, parseExcalidrawFile, parseScene, renameBoard, replaceBoards, saveFallback, saveScene, DEFAULT_TITLE, MAX_TITLE,
} from './boards'
import type { BoardScene } from './boards'
import type { Board } from './design-drafts'
import { finish, newPractice, tick } from './practice'

const rect = (id: string, x = 0) => ({ id, type: 'rectangle', x, y: 0, width: 10, height: 10, isDeleted: false, groupIds: [], boundElements: null })
const scene = (...ids: string[]): BoardScene => ({ elements: ids.map((id, index) => rect(id, index * 20)), appState: { viewBackgroundColor: '#fff' }, files: {} })
const legacy: Board = {
  nodes: [{ id: 'n1', kind: 'client', label: 'Browser', x: 24, y: 24 }, { id: 'n2', kind: 'db', label: '', x: 400, y: 24 }],
  edges: [{ from: 'n1', to: 'n2', label: 'reads' }],
}

beforeEach(async () => { await deleteBoardsDatabase() })

describe('board storage', () => {
  it('creates, lists, gets, saves, renames and deletes', async () => {
    const first = await createBoard({ title: '  Feed   design ' })
    expect(first).toMatchObject({ title: 'Feed design', kind: 'free', elements: [], appState: {}, files: {} })
    expect(first.id).toMatch(/^[a-z0-9-]+$/)
    await new Promise(resolve => setTimeout(resolve, 5))
    const second = await createBoard({ kind: 'practice', caseId: 'url-shortener' })
    expect(second.title).toBe(DEFAULT_TITLE)
    expect((await listBoards()).map(board => board.id)).toEqual([second.id, first.id])
    expect((await listBoards('practice')).map(board => board.id)).toEqual([second.id])

    await new Promise(resolve => setTimeout(resolve, 5))
    const saved = await saveScene(first.id, { ...scene('a', 'b'), elements: [...scene('a', 'b').elements, { ...rect('gone'), isDeleted: true }] })
    expect(saved.elements.map(element => element.id)).toEqual(['a', 'b'])
    expect(saved.updatedAt > first.updatedAt).toBe(true)
    expect((await getBoard(first.id))?.appState).toEqual({ viewBackgroundColor: '#fff' })
    expect((await listBoards())[0].id).toBe(first.id)

    expect((await renameBoard(first.id, 'x'.repeat(200))).title).toHaveLength(MAX_TITLE)
    expect((await renameBoard(first.id, '   ')).title).toBe(DEFAULT_TITLE)
    expect((await saveFallback(first.id, legacy)).fallback).toEqual(legacy)
    expect((await getBoard(first.id))?.elements).toHaveLength(2)

    await deleteBoard(first.id)
    expect(await getBoard(first.id)).toBeUndefined()
    expect(await getBoard('../bad id')).toBeUndefined()
    await expect(saveScene(first.id, scene())).rejects.toThrow('no longer exists')
    expect(await listBoards()).toHaveLength(1)
  })

  it('replaces every board at once', async () => {
    await createBoard({ title: 'Old' })
    const incoming = { ...await createBoard({ title: 'New' }), id: 'restored-1' }
    await replaceBoards([incoming])
    expect((await listBoards()).map(board => board.title)).toEqual(['New'])
    await replaceBoards([])
    expect(await listBoards()).toEqual([])
  })

  it('finds practice and scratch boards by link and stores attempts', async () => {
    const practice = newPractice(35, 1_000)
    const attempt = await createBoard({ kind: 'practice', caseId: 'url-shortener', practice })
    await createBoard({ kind: 'practice', caseId: 'rate-limiter', practice: newPractice(45, 1_000) })
    const pad = await createBoard({ kind: 'scratch', problemId: 'count-pair-sums' })
    await createBoard({ title: 'Free' })
    expect(attempt.practice).toEqual(practice)
    expect((await findBoards('practice', { caseId: 'url-shortener' })).map(board => board.id)).toEqual([attempt.id])
    expect(await findBoards('practice', { caseId: 'chat-app' })).toEqual([])
    expect((await findBoards('scratch', { problemId: 'count-pair-sums' })).map(board => board.id)).toEqual([pad.id])
    expect(await findBoards('scratch', { problemId: 'two-sum' })).toEqual([])
    const done = tick(finish(practice, 31 * 60_000), 2, true)
    await savePractice(attempt.id, done)
    expect((await getBoard(attempt.id))?.practice).toEqual(done)
    expect((await getBoard(attempt.id))?.elements).toEqual([])
    await expect(savePractice('missing-1', done)).rejects.toThrow()
  })
})

describe('legacy free board', () => {
  it('converts nodes to labelled rectangles and edges to bound arrows', () => {
    const elements = legacyElements(legacy)
    expect(elementProblems(elements)).toEqual([])
    expect(elements.filter(element => element.type === 'rectangle')).toHaveLength(2)
    expect(elements.filter(element => element.type === 'arrow')).toHaveLength(1)
    expect(elements.filter(element => element.type === 'text').map(element => element.text)).toEqual(['Browser', 'Database', 'reads'])
  })

  it('migrates once and only when there is something to copy', async () => {
    const board = await migrateLegacyBoard(legacy)
    expect(board).toMatchObject({ title: 'My first board', kind: 'free' })
    expect(board?.elements).toHaveLength(6)
    expect(await migrateLegacyBoard(legacy)).toBeUndefined()
    expect(await listBoards()).toHaveLength(1)

    await deleteBoardsDatabase()
    expect(await migrateLegacyBoard({ nodes: [], edges: [] })).toBeUndefined()
    expect(await migrateLegacyBoard(legacy)).toBeUndefined()
    expect(await listBoards()).toEqual([])
  })

  it('survives racing tabs', async () => {
    const results = await Promise.all([migrateLegacyBoard(legacy), migrateLegacyBoard(legacy)])
    expect(results.filter(Boolean)).toHaveLength(1)
    expect(await listBoards()).toHaveLength(1)
  })
})

describe('excalidraw files', () => {
  it('round-trips a scene', () => {
    const original = { ...scene('a'), files: { f1: { id: 'f1', mimeType: 'image/png', dataURL: 'data:image/png;base64,AA==', created: 1 } } }
    const parsed = parseExcalidrawFile(excalidrawFile(original))
    expect(parsed.elements).toEqual(original.elements)
    expect(parsed.files).toEqual(original.files)
    expect(parsed.appState.viewBackgroundColor).toBe('#fff')
  })

  it('rejects malformed files clearly', () => {
    expect(() => parseExcalidrawFile('nope')).toThrow('not valid JSON')
    expect(() => parseExcalidrawFile('{"type":"other"}')).toThrow('not an Excalidraw file')
    expect(() => parseExcalidrawFile('{"type":"excalidraw","elements":{}}')).toThrow('no element list')
    expect(() => parseExcalidrawFile('{"type":"excalidraw","elements":[{"id":"a"}]}')).toThrow('malformed shape')
    expect(() => parseScene({ elements: [rect('a'), rect('a')] })).toThrow('same id')
    expect(() => parseScene({ elements: [], files: { x: { id: 'y' } } })).toThrow('malformed image')
    expect(() => parseScene({ elements: [], files: { x: { id: 'x', mimeType: 'image/png', dataURL: 'https://cdn/x.png', created: 1 } } })).toThrow('malformed image')
  })

  it('keeps only the app state it understands', () => {
    expect(parseScene({ elements: [], appState: { theme: 'dark', zoom: { value: 2 }, scrollX: 5, gridModeEnabled: true, collaborators: [] } }).appState)
      .toEqual({ zoom: 2, scrollX: 5, gridModeEnabled: true })
  })
})

describe('autosave', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('debounces to the latest value and reports status', async () => {
    const saves: number[] = []
    const statuses: string[] = []
    const autosave = createAutosave<number>(async value => { saves.push(value) }, status => statuses.push(status), 500)
    autosave.schedule(1)
    autosave.schedule(2)
    vi.advanceTimersByTime(400)
    autosave.schedule(3)
    expect(saves).toEqual([])
    await vi.advanceTimersByTimeAsync(500)
    expect(saves).toEqual([3])
    expect(statuses.at(-1)).toBe('saved')
    autosave.schedule(4)
    await autosave.flush()
    expect(saves).toEqual([3, 4])
    autosave.schedule(5)
    autosave.cancel()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(saves).toEqual([3, 4])
  })

  it('reports errors and recovers on the next save', async () => {
    let fail = true
    const statuses: string[] = []
    const autosave = createAutosave<number>(async () => { if (fail) throw new Error('Disk full') }, (status, error) => statuses.push(error ? `${status}: ${error}` : status), 10)
    autosave.schedule(1)
    await autosave.flush()
    expect(statuses.at(-1)).toBe('error: Disk full')
    fail = false
    autosave.schedule(2)
    await autosave.flush()
    expect(statuses.at(-1)).toBe('saved')
  })
})
