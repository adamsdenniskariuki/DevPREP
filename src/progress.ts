import { lessons } from './curriculum'
import { lessonSections } from './lesson-sections'
import { isPathId } from './learning-paths'
import type { PathId } from './learning-paths'

export const STORAGE_KEY = 'devprep.progress.v1'
export const MAX_BACKUP_BYTES = 1_000_000
export const MAX_DRAFT_LENGTH = 20_000
export type Rating = 'again' | 'okay' | 'confident'
export type Phase = 'lesson' | 'practice' | 'assess'
export type Mode = 'learn' | 'review'
export interface StudySession {
  lessonId: string
  mode: Mode
  phase: Phase
  draft: string
  hintsRevealed: number
  solutionRevealed: boolean
  checks: boolean[]
  startedAt: string
  readingSection?: string
}
export interface LessonProgress {
  attempts: number
  lastCompleted: string
  due: string
  rating: Rating
  intervalDays: number
}
export interface Activity {
  lessonId: string
  at: string
  mode: Mode
  rating: Rating
}
export interface Progress {
  version: 1
  updatedAt: string
  records: Record<string, LessonProgress>
  session: StudySession | null
  activity: Activity[]
  selectedPath?: PathId
}

export function emptyProgress(now = new Date()): Progress {
  return { version: 1, updatedAt: now.toISOString(), records: {}, session: null, activity: [] }
}

export function localDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function invalid(message: string): never {
  throw new Error(`Invalid backup: ${message}`)
}

function object(value: unknown, keys?: string[], optionalKeys: string[] = []): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) invalid('expected an object.')
  const result = value as Record<string, unknown>
  if (keys && (Object.keys(result).some(key => !keys.includes(key) && !optionalKeys.includes(key)) || keys.some(key => !Object.hasOwn(result, key)))) {
    invalid('unexpected or missing fields.')
  }
  return result
}

function integer(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) invalid('number out of range.')
  return value
}

function timestamp(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) ||
    !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) invalid('invalid timestamp.')
  return value
}

function day(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(`${value}T12:00:00.000Z`)) ||
    new Date(`${value}T12:00:00.000Z`).toISOString().slice(0, 10) !== value) invalid('invalid review date.')
  return value
}

function rating(value: unknown): Rating {
  if (value !== 'again' && value !== 'okay' && value !== 'confident') invalid('unknown confidence rating.')
  return value
}

function mode(value: unknown): Mode {
  if (value !== 'learn' && value !== 'review') invalid('unknown session mode.')
  return value
}

function lessonFor(value: unknown) {
  const lesson = lessons.find(item => item.id === value)
  if (!lesson) invalid('unknown lesson. This backup may need a newer app version.')
  return lesson
}

export function parseBackup(text: string): Progress {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) invalid('file is larger than 1 MB.')
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { invalid('not valid JSON.') }
  const root = object(parsed, ['version', 'updatedAt', 'records', 'session', 'activity'], ['selectedPath'])
  if (root.version !== 1) invalid('unsupported version.')
  if (Object.hasOwn(root, 'selectedPath') && !isPathId(root.selectedPath)) invalid('unknown learning path.')
  const updatedAt = timestamp(root.updatedAt)
  const rawRecords = object(root.records)
  const records: Record<string, LessonProgress> = {}
  for (const [id, value] of Object.entries(rawRecords)) {
    lessonFor(id)
    const record = object(value, ['attempts', 'lastCompleted', 'due', 'rating', 'intervalDays'])
    records[id] = {
      attempts: integer(record.attempts, 1, Number.MAX_SAFE_INTEGER),
      lastCompleted: timestamp(record.lastCompleted),
      due: day(record.due),
      rating: rating(record.rating),
      intervalDays: integer(record.intervalDays, 1, 60),
    }
  }
  let session: StudySession | null = null
  if (root.session !== null) {
    const raw = object(root.session, ['lessonId', 'mode', 'phase', 'draft', 'hintsRevealed', 'solutionRevealed', 'checks', 'startedAt'], ['readingSection'])
    const lesson = lessonFor(raw.lessonId)
    if (raw.phase !== 'lesson' && raw.phase !== 'practice' && raw.phase !== 'assess') invalid('unknown study step.')
    if (typeof raw.draft !== 'string' || raw.draft.length > MAX_DRAFT_LENGTH) invalid('answer too long.')
    if (raw.phase === 'assess' && !raw.draft.trim()) invalid('reflection requires a written attempt.')
    if (Object.hasOwn(raw, 'readingSection') &&
      (typeof raw.readingSection !== 'string' || !lessonSections(lesson).some(section => section.id === raw.readingSection))) {
      invalid('unknown reading section.')
    }
    if (typeof raw.solutionRevealed !== 'boolean') invalid('invalid solution state.')
    if (!Array.isArray(raw.checks) || raw.checks.length !== lesson.checklist.length || raw.checks.some(value => typeof value !== 'boolean')) {
      invalid('invalid self-assessment checklist.')
    }
    const sessionMode = mode(raw.mode)
    if (sessionMode === 'review' && !Object.hasOwn(records, lesson.id)) invalid('review has no completed lesson.')
    session = {
      lessonId: lesson.id, mode: sessionMode, phase: raw.phase, draft: raw.draft,
      hintsRevealed: integer(raw.hintsRevealed, 0, lesson.hints.length),
      solutionRevealed: raw.solutionRevealed, checks: raw.checks as boolean[],
      startedAt: timestamp(raw.startedAt),
      ...(typeof raw.readingSection === 'string' ? { readingSection: raw.readingSection } : {}),
    }
  }
  if (!Array.isArray(root.activity) || root.activity.length > 5_000) invalid('invalid activity history.')
  const activity = root.activity.map(value => {
    const raw = object(value, ['lessonId', 'at', 'mode', 'rating'])
    const lesson = lessonFor(raw.lessonId)
    if (!Object.hasOwn(records, lesson.id)) invalid('activity has no completed lesson.')
    return { lessonId: lesson.id, at: timestamp(raw.at), mode: mode(raw.mode), rating: rating(raw.rating) }
  })
  return { version: 1, updatedAt, records, session, activity, ...(isPathId(root.selectedPath) ? { selectedPath: root.selectedPath } : {}) }
}

export function beginSession(progress: Progress, lessonId: string, sessionMode: Mode, now = new Date()): Progress {
  const lesson = lessonFor(lessonId)
  if (sessionMode === 'review' && !progress.records[lessonId]) throw new Error('Complete this lesson before reviewing it.')
  return {
    ...progress, updatedAt: now.toISOString(),
    session: {
      lessonId, mode: sessionMode, phase: sessionMode === 'review' ? 'practice' : 'lesson',
      draft: '', hintsRevealed: 0, solutionRevealed: false,
      checks: lesson.checklist.map(() => false), startedAt: now.toISOString(), readingSection: 'overview',
    },
  }
}

export function completeSession(progress: Progress, confidence: Rating, now = new Date()): Progress {
  const session = progress.session
  if (!session || session.phase !== 'assess' || !session.draft.trim()) throw new Error('Write an answer and assess it before finishing.')
  const old = progress.records[session.lessonId]
  const intervalDays = confidence === 'again' ? 1
    : confidence === 'okay' ? Math.min(60, Math.ceil((old?.intervalDays ?? 2) * 1.5))
    : Math.min(60, old ? old.intervalDays * 2 : 7)
  const due = new Date(now)
  due.setDate(due.getDate() + intervalDays)
  return {
    ...progress, updatedAt: now.toISOString(), session: null,
    records: {
      ...progress.records,
      [session.lessonId]: {
        attempts: (old?.attempts ?? 0) + 1, lastCompleted: now.toISOString(),
        due: localDay(due), rating: confidence, intervalDays,
      },
    },
    activity: [...progress.activity, { lessonId: session.lessonId, at: now.toISOString(), mode: session.mode, rating: confidence }].slice(-5_000),
  }
}

export function dueLessons(progress: Progress, now = new Date()) {
  const today = localDay(now)
  return lessons.filter(lesson => progress.records[lesson.id]?.due <= today)
    .sort((a, b) => progress.records[a.id].due.localeCompare(progress.records[b.id].due))
}

export interface StoragePort {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export function readProgress(storage: StoragePort): Progress {
  const raw = storage.getItem(STORAGE_KEY)
  return raw === null ? emptyProgress() : parseBackup(raw)
}

export function writeProgress(storage: StoragePort, progress: Progress): void {
  storage.setItem(STORAGE_KEY, serializeBackup(progress))
}

export function serializeBackup(progress: Progress): string {
  const serialized = JSON.stringify(progress)
  parseBackup(serialized)
  return serialized
}
