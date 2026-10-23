import { boundArrow, labelledShape, type SceneElement } from './board-elements'
import { STENCILS } from './board-library'
import { NODE_KIND_LABELS } from './case-types'
import type { NodeKind } from './case-types'
import { NODE_HEIGHT, NODE_WIDTH } from './design-drafts'
import type { Board } from './design-drafts'
import type { PracticeState } from './practice'

/** Whiteboards live in IndexedDB, not localStorage, because drawings and pasted images get large. */
export const BOARDS_DB = 'devprep-boards'
const DB_VERSION = 1
const STORE = 'boards'
const META = 'meta'
/** Set once the old single free board has been copied into a board, so it is never copied twice. */
export const LEGACY_FLAG = 'legacy-free-board'

export type BoardKind = 'free' | 'practice' | 'scratch'
export const BOARD_KINDS: readonly BoardKind[] = ['free', 'practice', 'scratch']
export const BOARD_ID = /^[a-z0-9-]{1,64}$/
export const MAX_TITLE = 80
export const MAX_ELEMENTS = 20_000
export const DEFAULT_TITLE = 'Untitled board'

/** The parts of Excalidraw's app state worth keeping between visits. Theme follows the app instead. */
export interface BoardAppState {
  viewBackgroundColor?: string
  gridModeEnabled?: boolean
  scrollX?: number
  scrollY?: number
  zoom?: number
}
export interface BoardFile {
  id: string
  mimeType: string
  dataURL: string
  created: number
  lastRetrieved?: number
}
export interface BoardScene {
  elements: SceneElement[]
  appState: BoardAppState
  files: Record<string, BoardFile>
}
export interface BoardRecord extends BoardScene {
  id: string
  title: string
  /** free: from the board list. practice: a timed design case. scratch: a coding problem's scratchpad. */
  kind: BoardKind
  caseId?: string
  problemId?: string
  createdAt: string
  updatedAt: string
  /** Sketch from the simple whiteboard, used only when the drawing tool can't load. */
  fallback?: Board
  /** Timer and self-review for a practice board. */
  practice?: PracticeState
}

export const emptyScene = (): BoardScene => ({ elements: [], appState: {}, files: {} })

const isRec = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

function bad(message: string): never {
  throw new Error(message)
}

export function cleanTitle(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE) || DEFAULT_TITLE
}

/** Strictly checks a scene from a file or backup. Elements are checked lightly; Excalidraw repairs details on load. */
export function parseScene(value: unknown, what = 'board'): BoardScene {
  if (!isRec(value)) bad(`The ${what} is not an object.`)
  if (!Array.isArray(value.elements)) bad(`The ${what} has no element list.`)
  if (value.elements.length > MAX_ELEMENTS) bad(`The ${what} has more than ${MAX_ELEMENTS} shapes.`)
  const ids = new Set<string>()
  const elements = value.elements.map(element => {
    if (!isRec(element) || typeof element.id !== 'string' || !element.id || typeof element.type !== 'string' ||
      !finite(element.x) || !finite(element.y)) bad(`The ${what} has a malformed shape.`)
    if (ids.has(element.id)) bad(`The ${what} has two shapes with the same id.`)
    ids.add(element.id)
    return element as SceneElement
  }).filter(element => element.isDeleted !== true)
  const appState: BoardAppState = {}
  if (value.appState !== undefined && value.appState !== null) {
    if (!isRec(value.appState)) bad(`The ${what} settings are malformed.`)
    const raw = value.appState
    if (typeof raw.viewBackgroundColor === 'string' && raw.viewBackgroundColor.length <= 40) appState.viewBackgroundColor = raw.viewBackgroundColor
    if (typeof raw.gridModeEnabled === 'boolean') appState.gridModeEnabled = raw.gridModeEnabled
    if (finite(raw.scrollX)) appState.scrollX = raw.scrollX
    if (finite(raw.scrollY)) appState.scrollY = raw.scrollY
    const zoom = isRec(raw.zoom) ? raw.zoom.value : raw.zoom
    if (finite(zoom) && zoom > 0) appState.zoom = zoom
  }
  const files: Record<string, BoardFile> = {}
  if (value.files !== undefined && value.files !== null) {
    if (!isRec(value.files)) bad(`The ${what} images are malformed.`)
    for (const [id, file] of Object.entries(value.files)) {
      if (!isRec(file) || file.id !== id || typeof file.mimeType !== 'string' || typeof file.dataURL !== 'string' ||
        !file.dataURL.startsWith('data:') || !finite(file.created)) bad(`The ${what} has a malformed image.`)
      files[id] = { id, mimeType: file.mimeType, dataURL: file.dataURL, created: file.created, ...finite(file.lastRetrieved) ? { lastRetrieved: file.lastRetrieved } : {} }
    }
  }
  return { elements, appState, files }
}

/** Reads a .excalidraw file. */
export function parseExcalidrawFile(text: string): BoardScene {
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { bad('This file is not valid JSON.') }
  if (!isRec(parsed) || parsed.type !== 'excalidraw') bad('This is not an Excalidraw file.')
  return parseScene(parsed, 'file')
}

/** Excalidraw's own file format, so exports open in excalidraw.com and other tools. */
export function excalidrawFile(scene: BoardScene): string {
  return JSON.stringify({
    type: 'excalidraw', version: 2, source: 'DevPREP',
    elements: scene.elements,
    appState: { viewBackgroundColor: scene.appState.viewBackgroundColor ?? '#ffffff', gridSize: 20 },
    files: scene.files,
  }, null, 2)
}

// ---- Legacy free board ----

const KIND_STENCIL: Record<NodeKind, string> = {
  client: 'client', cdn: 'cdn', lb: 'load-balancer', service: 'service', worker: 'worker',
  cache: 'cache', db: 'database-sql', queue: 'queue', storage: 'object-storage', external: 'api-gateway',
}

/** Turns the old node/edge whiteboard into Excalidraw elements: labelled rectangles and bound arrows. */
export function legacyElements(board: Board): SceneElement[] {
  const shapes = new Map<string, SceneElement>()
  const elements: SceneElement[] = []
  board.nodes.forEach((node, index) => {
    const style = STENCILS.find(item => item.id === KIND_STENCIL[node.kind])?.style ?? {}
    const pair = labelledShape({
      id: `legacy-node-${index}`, type: 'rectangle', x: node.x, y: node.y, width: NODE_WIDTH, height: NODE_HEIGHT,
      text: node.label.trim() || NODE_KIND_LABELS[node.kind], style: { ...style, rounded: true },
    })
    shapes.set(node.id, pair[0])
    elements.push(...pair)
  })
  board.edges.forEach((edge, index) => {
    const from = shapes.get(edge.from), to = shapes.get(edge.to)
    if (from && to) elements.push(...boundArrow(`legacy-edge-${index}`, from, to, edge.label))
  })
  return elements
}

// ---- IndexedDB ----

let opening: Promise<IDBDatabase> | undefined

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Browser storage failed.'))
  })
}

function storageError(error: unknown): Error {
  const name = error instanceof DOMException ? error.name : ''
  if (name === 'QuotaExceededError') return new Error('Browser storage is full. Delete a board or free up space.')
  return error instanceof Error ? error : new Error('Browser storage failed.')
}

function database(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('Whiteboards need browser storage (IndexedDB), which is off here.'))
  opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const open = indexedDB.open(BOARDS_DB, DB_VERSION)
    open.onupgradeneeded = () => {
      const db = open.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META)
    }
    open.onsuccess = () => {
      const db = open.result
      // Let a newer tab upgrade the schema; this tab reopens on its next call.
      db.onversionchange = () => { db.close(); opening = undefined }
      resolve(db)
    }
    open.onerror = () => { opening = undefined; reject(open.error ?? new Error('Whiteboard storage could not open.')) }
    open.onblocked = () => { opening = undefined; reject(new Error('Whiteboard storage is busy in another tab. Close it and try again.')) }
  })
  return opening
}

/** Runs work in one transaction and resolves after it commits. */
async function transact<T>(stores: string[], mode: IDBTransactionMode, work: (tx: IDBTransaction) => Promise<T> | T): Promise<T> {
  const db = await database()
  const tx = db.transaction(stores, mode)
  const done = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(storageError(tx.error))
    tx.onabort = () => reject(storageError(tx.error ?? new Error('Saving was cancelled.')))
  })
  done.catch(() => { /* Reported through the awaited path below. */ })
  try {
    const result = await work(tx)
    await done
    return result
  } catch (error) {
    try { tx.abort() } catch { /* Already finished. */ }
    throw storageError(error)
  }
}

function newId(): string {
  return crypto.randomUUID().toLowerCase()
}

export interface NewBoard {
  title?: string
  kind?: BoardKind
  caseId?: string
  problemId?: string
  scene?: BoardScene
  practice?: PracticeState
}

function record(options: NewBoard, now = new Date()): BoardRecord {
  const at = now.toISOString()
  return {
    id: newId(), title: cleanTitle(options.title ?? ''), kind: options.kind ?? 'free',
    ...options.caseId ? { caseId: options.caseId } : {}, ...options.problemId ? { problemId: options.problemId } : {},
    ...options.scene ?? emptyScene(), createdAt: at, updatedAt: at, ...options.practice ? { practice: options.practice } : {},
  }
}

export async function createBoard(options: NewBoard = {}): Promise<BoardRecord> {
  const board = record(options)
  await transact([STORE], 'readwrite', tx => request(tx.objectStore(STORE).add(board)))
  return board
}

/** Boards newest first, optionally of one kind. */
export async function listBoards(kind?: BoardKind): Promise<BoardRecord[]> {
  const all = await transact([STORE], 'readonly', tx => request(tx.objectStore(STORE).getAll() as IDBRequest<BoardRecord[]>))
  return all.filter(board => !kind || board.kind === kind).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.title.localeCompare(b.title))
}

/** Boards of one kind linked to a case or problem, newest first. */
export async function findBoards(kind: BoardKind, link: { caseId?: string; problemId?: string }): Promise<BoardRecord[]> {
  return (await listBoards(kind)).filter(board => (!link.caseId || board.caseId === link.caseId) && (!link.problemId || board.problemId === link.problemId))
}

export async function getBoard(id: string): Promise<BoardRecord | undefined> {
  if (!BOARD_ID.test(id)) return undefined
  return transact([STORE], 'readonly', tx => request(tx.objectStore(STORE).get(id) as IDBRequest<BoardRecord | undefined>))
}

async function update(id: string, change: (board: BoardRecord) => BoardRecord): Promise<BoardRecord> {
  return transact([STORE], 'readwrite', async tx => {
    const store = tx.objectStore(STORE)
    const current = await request(store.get(id) as IDBRequest<BoardRecord | undefined>)
    if (!current) bad('This board no longer exists. It may have been deleted in another tab.')
    const next = { ...change(current), id, updatedAt: new Date().toISOString() }
    await request(store.put(next))
    return next
  })
}

export function saveScene(id: string, scene: BoardScene): Promise<BoardRecord> {
  return update(id, board => ({ ...board, elements: scene.elements.filter(element => !element.isDeleted), appState: scene.appState, files: scene.files }))
}

export function saveFallback(id: string, fallback: Board): Promise<BoardRecord> {
  return update(id, board => ({ ...board, fallback }))
}

export function savePractice(id: string, practice: PracticeState): Promise<BoardRecord> {
  return update(id, board => ({ ...board, practice }))
}

export function renameBoard(id: string, title: string): Promise<BoardRecord> {
  return update(id, board => ({ ...board, title: cleanTitle(title) }))
}

export async function deleteBoard(id: string): Promise<void> {
  await transact([STORE], 'readwrite', tx => request(tx.objectStore(STORE).delete(id)))
}

/** Swaps every board for the given ones in one step, as a backup restore does. */
export async function replaceBoards(boards: BoardRecord[]): Promise<void> {
  await transact([STORE], 'readwrite', async tx => {
    const store = tx.objectStore(STORE)
    await request(store.clear())
    for (const board of boards) await request(store.put(board))
  })
}

/**
 * Copies the old single free board into a new board once. The old draft is left as it was.
 * Returns the new board, or undefined if there was nothing to copy or it was already copied.
 */
export async function migrateLegacyBoard(legacy: Board | undefined): Promise<BoardRecord | undefined> {
  return transact([STORE, META], 'readwrite', async tx => {
    const meta = tx.objectStore(META)
    if (await request(meta.get(LEGACY_FLAG)) !== undefined) return undefined
    await request(meta.put(new Date().toISOString(), LEGACY_FLAG))
    if (!legacy?.nodes.length) return undefined
    const board = record({ title: 'My first board', scene: { elements: legacyElements(legacy), appState: {}, files: {} } })
    await request(tx.objectStore(STORE).add(board))
    return board
  })
}

/** Closes and deletes the database. Used by tests. */
export async function deleteBoardsDatabase(): Promise<void> {
  const db = await opening?.catch(() => undefined)
  db?.close()
  opening = undefined
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(BOARDS_DB)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

// ---- Autosave ----

export type SaveStatus = 'saved' | 'pending' | 'saving' | 'error'

/** Debounces saves: the latest scene is written once changes pause. flush() writes any pending scene now. */
export function createAutosave<T>(save: (value: T) => Promise<unknown>, onStatus: (status: SaveStatus, error?: string) => void, delay = 700) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: { value: T } | undefined
  let running: Promise<void> = Promise.resolve()
  const write = () => {
    timer = undefined
    const next = pending
    pending = undefined
    if (!next) return running
    onStatus('saving')
    running = running.then(() => save(next.value)).then(
      () => { if (!pending) onStatus('saved') },
      error => onStatus('error', error instanceof Error ? error.message : 'Saving failed.'),
    )
    return running
  }
  return {
    schedule(value: T) {
      pending = { value }
      onStatus('pending')
      if (timer !== undefined) clearTimeout(timer)
      timer = setTimeout(() => { void write() }, delay)
    },
    flush(): Promise<void> {
      if (timer !== undefined) clearTimeout(timer)
      return write()
    },
    cancel() {
      if (timer !== undefined) clearTimeout(timer)
      timer = undefined
      pending = undefined
    },
  }
}
