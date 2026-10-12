import { NODE_KINDS, STEP_KEYS } from './case-types'
import type { NodeKind, StepKey } from './case-types'

/** Design notes, boards and timers live apart from progress backups, like code drafts. */
export const DESIGN_DRAFTS_KEY = 'devprep.design.v1'
export const FREE_BOARD = 'free'
export const MAX_NOTE_LENGTH = 4_000
export const MAX_NODES = 60
export const MAX_EDGES = 120
export const MAX_LABEL = 40
export const BOARD_WIDTH = 1040
export const BOARD_HEIGHT = 540
export const NODE_WIDTH = 152
export const NODE_HEIGHT = 56
const MAX_ENTRIES = 100

export interface BoardNode { id: string; kind: NodeKind; label: string; x: number; y: number }
export interface BoardEdge { from: string; to: string; label?: string }
export interface Board { nodes: BoardNode[]; edges: BoardEdge[] }
export interface DesignTimer {
  /** Milliseconds left while paused. */
  remaining?: number
  /** Epoch milliseconds when a running timer reaches zero. */
  endsAt?: number
}
export interface DesignDraft {
  notes?: Partial<Record<StepKey, string>>
  board?: Board
  timer?: DesignTimer
}

export const emptyBoard = (): Board => ({ nodes: [], edges: [] })

const isRec = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

/** Repairs or drops anything malformed so a damaged entry can never break the screen. */
export function cleanBoard(value: unknown): Board {
  if (!isRec(value)) return emptyBoard()
  const nodes: BoardNode[] = []
  const ids = new Set<string>()
  for (const raw of Array.isArray(value.nodes) ? value.nodes.slice(0, MAX_NODES) : []) {
    if (!isRec(raw) || typeof raw.id !== 'string' || !raw.id || ids.has(raw.id) || !NODE_KINDS.includes(raw.kind as NodeKind) || !finite(raw.x) || !finite(raw.y)) continue
    ids.add(raw.id)
    nodes.push({
      id: raw.id.slice(0, 40), kind: raw.kind as NodeKind,
      label: typeof raw.label === 'string' ? raw.label.slice(0, MAX_LABEL) : '',
      x: clamp(Math.round(raw.x), 0, BOARD_WIDTH - NODE_WIDTH), y: clamp(Math.round(raw.y), 0, BOARD_HEIGHT - NODE_HEIGHT),
    })
  }
  const edges: BoardEdge[] = []
  const seen = new Set<string>()
  for (const raw of Array.isArray(value.edges) ? value.edges.slice(0, MAX_EDGES) : []) {
    if (!isRec(raw) || !ids.has(raw.from as string) || !ids.has(raw.to as string) || raw.from === raw.to) continue
    const key = `${raw.from}>${raw.to}`
    if (seen.has(key)) continue
    seen.add(key)
    const label = typeof raw.label === 'string' ? raw.label.trim().slice(0, MAX_LABEL) : ''
    edges.push({ from: raw.from as string, to: raw.to as string, ...(label ? { label } : {}) })
  }
  return { nodes, edges }
}

function readAll(): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(DESIGN_DRAFTS_KEY) ?? '{}')
    return isRec(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

export function readDesignDraft(id: string): DesignDraft {
  const raw = readAll()[id]
  if (!isRec(raw)) return {}
  const draft: DesignDraft = {}
  if (isRec(raw.notes)) {
    const notes: Partial<Record<StepKey, string>> = {}
    for (const key of STEP_KEYS) if (typeof raw.notes[key] === 'string') notes[key] = (raw.notes[key] as string).slice(0, MAX_NOTE_LENGTH)
    draft.notes = notes
  }
  if (Object.hasOwn(raw, 'board')) draft.board = cleanBoard(raw.board)
  if (isRec(raw.timer)) {
    const timer: DesignTimer = {}
    if (finite(raw.timer.remaining) && raw.timer.remaining >= 0) timer.remaining = Math.min(raw.timer.remaining, 3 * 60 * 60_000)
    if (finite(raw.timer.endsAt)) timer.endsAt = raw.timer.endsAt
    draft.timer = timer
  }
  return draft
}

/** Merges a patch into one entry. Undefined values remove a field. Returns false if the browser refused. */
export function writeDesignDraft(id: string, patch: Partial<Record<keyof DesignDraft, unknown>>): boolean {
  try {
    const all = readAll()
    const next: Record<string, unknown> = { ...(isRec(all[id]) ? all[id] as Record<string, unknown> : {}) }
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) delete next[key]
      else next[key] = value
    }
    delete all[id]
    const ids = Object.keys(all)
    for (const old of ids.slice(0, Math.max(0, ids.length - MAX_ENTRIES + 1))) delete all[old]
    if (Object.keys(next).length) all[id] = next
    window.localStorage.setItem(DESIGN_DRAFTS_KEY, JSON.stringify(all))
    return true
  } catch {
    return false
  }
}

export function clearDesignDraft(id: string): boolean {
  try {
    const all = readAll()
    delete all[id]
    window.localStorage.setItem(DESIGN_DRAFTS_KEY, JSON.stringify(all))
    return true
  } catch {
    return false
  }
}
