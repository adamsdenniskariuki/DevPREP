import { BOARD_ID, BOARD_KINDS, MAX_TITLE, parseScene } from './boards'
import type { BoardKind, BoardRecord } from './boards'
import { caseIds } from './cases'
import { cleanBoard } from './design-drafts'
import { parsePractice } from './practice'
import { problemIds } from './problems'
import { parseSnippets, type Snippet } from './playground'
import { MAX_BACKUP_BYTES, parseBackup, serializeBackup } from './progress'
import type { Progress } from './progress'

/** Whiteboards ride along in backups under an optional "boards" key, with their own size caps. */
export const MAX_BOARD_BYTES = 5_000_000
export const MAX_BOARDS_BYTES = 20_000_000
/** Playground snippets: at most 50 of 20,000 characters, so about 1 MB even with escaping; 2 MB leaves room. */
export const MAX_SNIPPETS_BYTES = 2_000_000
export const MAX_FULL_BACKUP_BYTES = MAX_BACKUP_BYTES + MAX_BOARDS_BYTES + MAX_SNIPPETS_BYTES + 1_000_000
const MAX_BOARDS = 1_000

export interface FullBackup {
  progress: Progress
  /** Present only when the backup carries whiteboards. They then replace the boards on this device. */
  boards?: BoardRecord[]
  /** Present only when the backup carries Playground snippets. They then replace the snippets on this device. */
  playground?: Snippet[]
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
const OPTIONAL = ['caseId', 'problemId', 'fallback', 'practice']

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
  if (Object.hasOwn(value, 'practice') && value.kind !== 'practice') invalid(`whiteboard “${title}” has practice details but is not a practice board.`)
  let practice
  try { practice = Object.hasOwn(value, 'practice') ? parsePractice(value.practice) : undefined } catch (error) { invalid(`whiteboard “${title}” ${(error as Error).message}`) }
  let scene
  try { scene = parseScene(value, `whiteboard “${title}”`) } catch (error) { invalid((error as Error).message.replace(/^The /, 'the ')) }
  return {
    id: value.id, title, kind: value.kind as BoardKind,
    ...typeof value.caseId === 'string' ? { caseId: value.caseId } : {},
    ...typeof value.problemId === 'string' ? { problemId: value.problemId } : {},
    ...scene,
    createdAt: timestamp(value.createdAt), updatedAt: timestamp(value.updatedAt),
    ...Object.hasOwn(value, 'fallback') ? { fallback: cleanBoard(value.fallback) } : {},
    ...practice ? { practice } : {},
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

/** Reads a backup file. Progress is checked by parseBackup exactly as before; boards and snippets are checked here. */
export function parseFullBackup(text: string): FullBackup {
  if (encoder.encode(text).length > MAX_FULL_BACKUP_BYTES) invalid(`file is larger than ${formatBytes(MAX_FULL_BACKUP_BYTES)}.`)
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { return { progress: parseBackup(text) } }
  if (!isRec(parsed) || (!Object.hasOwn(parsed, 'boards') && !Object.hasOwn(parsed, 'playground'))) return { progress: parseBackup(text) }
  const { boards, playground, ...rest } = parsed
  const progress = parseBackup(JSON.stringify(rest))
  if (Object.hasOwn(parsed, 'playground') && jsonBytes(playground) > MAX_SNIPPETS_BYTES) invalid(`Playground snippets add up to more than ${formatBytes(MAX_SNIPPETS_BYTES)}.`)
  return {
    progress,
    ...Object.hasOwn(parsed, 'boards') ? { boards: parseBoards(boards) } : {},
    ...Object.hasOwn(parsed, 'playground') ? { playground: parseSnippets(playground) } : {},
  }
}

function forBackup(board: BoardRecord): BoardRecord {
  const { id, title, kind, caseId, problemId, elements, appState, files, createdAt, updatedAt, fallback, practice } = board
  return { id, title, kind, ...caseId ? { caseId } : {}, ...problemId ? { problemId } : {}, elements, appState, files, createdAt, updatedAt, ...fallback ? { fallback } : {}, ...practice ? { practice } : {} }
}

/** Builds backup JSON. Without boards or snippets it matches the old format exactly. Throws a clear message over the caps. */
export function serializeFullBackup(progress: Progress, boards?: BoardRecord[], snippets?: Snippet[]): string {
  const base = serializeBackup(progress)
  const playground = snippets?.length ? snippets.map(({ id, name, lang, code, stdin, createdAt, updatedAt }) => ({ id, name, lang, code, ...stdin !== undefined ? { stdin } : {}, createdAt, updatedAt })) : undefined
  if (!boards && !playground) return base
  if (!boards) {
    const text = JSON.stringify({ ...JSON.parse(base), playground })
    parseFullBackup(text)
    return text
  }
  const items = boards.map(forBackup)
  for (const board of items) {
    if (jsonBytes(board) > MAX_BOARD_BYTES) throw new Error(`“${board.title}” is larger than 5 MB, so it can’t go in a backup. Export it as .excalidraw, or untick Include whiteboards.`)
  }
  if (jsonBytes(items) > MAX_BOARDS_BYTES) throw new Error('Your whiteboards add up to more than 20 MB. Delete some, or untick Include whiteboards.')
  const text = JSON.stringify({ ...JSON.parse(base), boards: items, ...playground ? { playground } : {} })
  parseFullBackup(text)
  return text
}
