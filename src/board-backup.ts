import { BOARD_ID, BOARD_KINDS, MAX_TITLE, parseScene } from './boards'
import type { BoardKind, BoardRecord } from './boards'
import { caseIds } from './cases'
import { cleanBoard } from './design-drafts'
import { problemIds } from './problems'
import { MAX_BACKUP_BYTES, parseBackup, serializeBackup } from './progress'
import type { Progress } from './progress'

/** Whiteboards ride along in backups under an optional "boards" key, with their own size caps. */
export const MAX_BOARD_BYTES = 5_000_000
export const MAX_BOARDS_BYTES = 20_000_000
export const MAX_FULL_BACKUP_BYTES = MAX_BACKUP_BYTES + MAX_BOARDS_BYTES + 1_000_000
const MAX_BOARDS = 1_000

export interface FullBackup {
  progress: Progress
  /** Present only when the backup carries whiteboards. They then replace the boards on this device. */
  boards?: BoardRecord[]
}

const isRec = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const encoder = new TextEncoder()
export const jsonBytes = (value: unknown) => encoder.encode(JSON.stringify(value)).length

export function formatBytes(bytes: number): string {
  if (bytes < 1_000) return `${bytes} B`
  if (bytes < 1_000_000) return `${Math.round(bytes / 1_000)} KB`
  return `${(bytes / 1_000_000).toFixed(1)} MB`
}

function invalid(message: string): never {
  throw new Error(`Invalid backup: ${message}`)
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
function timestamp(value: unknown): string {
  if (typeof value !== 'string' || !ISO.test(value) || new Date(value).toISOString() !== value) invalid('a whiteboard has an invalid timestamp.')
  return value
}

const KEYS = ['id', 'title', 'kind', 'elements', 'appState', 'files', 'createdAt', 'updatedAt']
const OPTIONAL = ['caseId', 'problemId', 'fallback']

function parseBoard(value: unknown): BoardRecord {
  if (!isRec(value)) invalid('a whiteboard is not an object.')
  if (Object.keys(value).some(key => !KEYS.includes(key) && !OPTIONAL.includes(key)) || KEYS.some(key => !Object.hasOwn(value, key))) invalid('a whiteboard has unexpected or missing fields.')
  if (typeof value.id !== 'string' || !BOARD_ID.test(value.id)) invalid('a whiteboard has an invalid id.')
  if (typeof value.title !== 'string' || !value.title.trim() || value.title.length > MAX_TITLE) invalid('a whiteboard has an invalid title.')
  const title = value.title
  if (jsonBytes(value) > MAX_BOARD_BYTES) invalid(`whiteboard “${title}” is larger than 5 MB.`)
  if (!BOARD_KINDS.includes(value.kind as BoardKind)) invalid(`whiteboard “${title}” has an unknown kind.`)
  if (Object.hasOwn(value, 'caseId') && (typeof value.caseId !== 'string' || !caseIds.has(value.caseId))) invalid(`whiteboard “${title}” links to an unknown case study.`)
  if (Object.hasOwn(value, 'problemId') && (typeof value.problemId !== 'string' || !problemIds.has(value.problemId))) invalid(`whiteboard “${title}” links to an unknown problem.`)
  if (Object.hasOwn(value, 'fallback') && !isRec(value.fallback)) invalid(`whiteboard “${title}” has a malformed simple sketch.`)
  let scene
  try { scene = parseScene(value, `whiteboard “${title}”`) } catch (error) { invalid((error as Error).message.replace(/^The /, 'the ')) }
  return {
    id: value.id, title, kind: value.kind as BoardKind,
    ...typeof value.caseId === 'string' ? { caseId: value.caseId } : {},
    ...typeof value.problemId === 'string' ? { problemId: value.problemId } : {},
    ...scene,
    createdAt: timestamp(value.createdAt), updatedAt: timestamp(value.updatedAt),
    ...Object.hasOwn(value, 'fallback') ? { fallback: cleanBoard(value.fallback) } : {},
  }
}

export function parseBoards(value: unknown): BoardRecord[] {
  if (!Array.isArray(value)) invalid('whiteboards must be a list.')
  if (value.length > MAX_BOARDS) invalid(`more than ${MAX_BOARDS} whiteboards.`)
  if (jsonBytes(value) > MAX_BOARDS_BYTES) invalid('whiteboards add up to more than 20 MB.')
  const ids = new Set<string>()
  return value.map(item => {
    const board = parseBoard(item)
    if (ids.has(board.id)) invalid('two whiteboards share an id.')
    ids.add(board.id)
    return board
  })
}

/** Reads a backup file. Progress is checked by parseBackup exactly as before; boards are checked here. */
export function parseFullBackup(text: string): FullBackup {
  if (encoder.encode(text).length > MAX_FULL_BACKUP_BYTES) invalid(`file is larger than ${formatBytes(MAX_FULL_BACKUP_BYTES)}.`)
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { return { progress: parseBackup(text) } }
  if (!isRec(parsed) || !Object.hasOwn(parsed, 'boards')) return { progress: parseBackup(text) }
  const { boards, ...rest } = parsed
  return { progress: parseBackup(JSON.stringify(rest)), boards: parseBoards(boards) }
}

function forBackup(board: BoardRecord): BoardRecord {
  const { id, title, kind, caseId, problemId, elements, appState, files, createdAt, updatedAt, fallback } = board
  return { id, title, kind, ...caseId ? { caseId } : {}, ...problemId ? { problemId } : {}, elements, appState, files, createdAt, updatedAt, ...fallback ? { fallback } : {} }
}

/** Builds backup JSON. Without boards it matches the old format exactly. Throws a clear message over the caps. */
export function serializeFullBackup(progress: Progress, boards?: BoardRecord[]): string {
  const base = serializeBackup(progress)
  if (!boards) return base
  const items = boards.map(forBackup)
  for (const board of items) {
    if (jsonBytes(board) > MAX_BOARD_BYTES) throw new Error(`“${board.title}” is larger than 5 MB, so it can’t go in a backup. Export it as .excalidraw, or untick Include whiteboards.`)
  }
  if (jsonBytes(items) > MAX_BOARDS_BYTES) throw new Error('Your whiteboards add up to more than 20 MB. Delete some, or untick Include whiteboards.')
  const text = JSON.stringify({ ...JSON.parse(base), boards: items })
  parseFullBackup(text)
  return text
}
