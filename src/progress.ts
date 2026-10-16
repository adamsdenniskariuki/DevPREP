import { lessons, tracks } from './curriculum'
import type { Track } from './curriculum'
import { lessonSections } from './lesson-sections'
import { isPathId } from './learning-paths'
import type { PathId } from './learning-paths'
import { problemIds } from './problems'
import { caseIds } from './cases'
import { guideIds } from './guides'
import { cardIds } from './flashcards'
import { COMPETENCY_IDS } from './stories'
import type { Competency } from './stories'
import type { CodeLanguage } from './problem-types'

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
  profile?: Profile
  /** Runnable problems whose tests all passed, with the first passing time per language. */
  solved?: Record<string, SolvedProblem>
  /** Best self-scored rubric percentage per system design case study. */
  designs?: Record<string, DesignScore>
  /** Best Field Guide quiz percentage per guide or case study read to the end. */
  guides?: Record<string, DesignScore>
  /** Spaced-repetition state per flashcard that has been reviewed at least once. */
  cards?: Record<string, CardState>
  /** Finished mock interviews, oldest first. */
  mocks?: MockResult[]
  /** The behavioral story bank, in the order the user created them. */
  stories?: Story[]
  /** Latest placement check per language track, with the lessons it marked as already known. */
  placements?: Partial<Record<Track, Placement>>
}
export interface Placement {
  percent: number
  at: string
  /** Lessons answered correctly in the check. They stay openable but the planner skips them. */
  known: string[]
}
export interface CardState {
  /** Leitner box 0-6; higher boxes wait longer before the next review. */
  box: number
  due: string
  at: string
  reviews: number
}
export interface MockResult {
  track: Track
  at: string
  percent: number
  minutes: number
}
export interface Story {
  id: string
  title: string
  competencies: Competency[]
  situation: string
  task: string
  action: string
  result: string
  updatedAt: string
}
export const MAX_MOCKS = 500
export const MAX_STORIES = 50
export const MAX_STORY_FIELD = 2_000
export type SolvedProblem = Partial<Record<CodeLanguage, string>>
export interface DesignScore {
  best: number
  at: string
}
/** Optional study profile used by Home and the planner. Omitted when empty. */
export interface Profile {
  interviewDate?: string
  focusTracks?: Track[]
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
  const root = object(parsed, ['version', 'updatedAt', 'records', 'session', 'activity'], ['selectedPath', 'profile', 'solved', 'designs', 'cards', 'mocks', 'stories', 'guides', 'placements'])
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
  const profile = Object.hasOwn(root, 'profile') ? parseProfile(root.profile) : undefined
  const solved = Object.hasOwn(root, 'solved') ? parseSolved(root.solved) : undefined
  const designs = Object.hasOwn(root, 'designs') ? parseDesigns(root.designs) : undefined
  const cards = Object.hasOwn(root, 'cards') ? parseCards(root.cards) : undefined
  const guides = Object.hasOwn(root, 'guides') ? parseGuides(root.guides) : undefined
  const mocks = Object.hasOwn(root, 'mocks') ? parseMocks(root.mocks) : undefined
  const stories = Object.hasOwn(root, 'stories') ? parseStories(root.stories) : undefined
  const placements = Object.hasOwn(root, 'placements') ? parsePlacements(root.placements) : undefined
  return {
    version: 1, updatedAt, records, session, activity,
    ...(isPathId(root.selectedPath) ? { selectedPath: root.selectedPath } : {}),
    ...(profile ? { profile } : {}),
    ...(solved ? { solved } : {}),
    ...(designs ? { designs } : {}),
    ...(cards ? { cards } : {}),
    ...(mocks ? { mocks } : {}),
    ...(stories ? { stories } : {}),
    ...(guides ? { guides } : {}),
    ...(placements ? { placements } : {}),
  }
}

function parsePlacements(value: unknown): Partial<Record<Track, Placement>> {
  const raw = object(value)
  const placements: Partial<Record<Track, Placement>> = {}
  for (const [id, entry] of Object.entries(raw)) {
    const track = tracks.find(item => item.id === id)
    if (!track?.placement) invalid('unknown placement track. This backup may need a newer app version.')
    const item = object(entry, ['percent', 'at', 'known'])
    if (!Array.isArray(item.known) || new Set(item.known).size !== item.known.length ||
      item.known.some(lessonId => lessonFor(lessonId).track !== track.id)) invalid('invalid placement lessons.')
    placements[track.id] = { percent: integer(item.percent, 0, 100), at: timestamp(item.at), known: item.known as string[] }
  }
  return placements
}

/** Saves a placement check result for a language track, replacing any earlier one. */
export function recordPlacement(progress: Progress, track: Track, percent: number, known: string[], now = new Date()): Progress {
  const info = tracks.find(item => item.id === track)
  if (!info?.placement) throw new Error('This track has no placement check.')
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) throw new Error('Score must be a whole percentage.')
  const unique = [...new Set(known)]
  if (unique.some(id => lessonFor(id).track !== track)) throw new Error('Placement lessons must belong to the track.')
  return { ...progress, updatedAt: now.toISOString(), placements: { ...progress.placements, [track]: { percent, at: now.toISOString(), known: unique } } }
}

/** Lesson ids a placement check marked as known. */
export function knownLessons(progress: Pick<Progress, 'placements'>): Set<string> {
  return new Set(Object.values(progress.placements ?? {}).flatMap(item => item?.known ?? []))
}

function parseCards(value: unknown): Record<string, CardState> {
  const raw = object(value)
  const cards: Record<string, CardState> = {}
  for (const [id, entry] of Object.entries(raw)) {
    if (!cardIds.has(id)) invalid('unknown flashcard. This backup may need a newer app version.')
    const card = object(entry, ['box', 'due', 'at', 'reviews'])
    cards[id] = { box: integer(card.box, 0, 6), due: day(card.due), at: timestamp(card.at), reviews: integer(card.reviews, 1, 100_000) }
  }
  return cards
}

/** Stores a flashcard grade computed by gradeCard (src/flashcards.ts). */
export function recordCard(progress: Progress, cardId: string, state: CardState, now = new Date()): Progress {
  if (!cardIds.has(cardId)) throw new Error('Unknown flashcard.')
  return { ...progress, updatedAt: now.toISOString(), cards: { ...progress.cards, [cardId]: state } }
}

function parseMocks(value: unknown): MockResult[] {
  if (!Array.isArray(value) || value.length > MAX_MOCKS) invalid('invalid mock interview history.')
  return value.map(entry => {
    const raw = object(entry, ['track', 'at', 'percent', 'minutes'])
    if (!tracks.some(track => track.id === raw.track)) invalid('unknown mock interview track.')
    return { track: raw.track as Track, at: timestamp(raw.at), percent: integer(raw.percent, 0, 100), minutes: integer(raw.minutes, 0, 600) }
  })
}

export function recordMock(progress: Progress, result: Omit<MockResult, 'at'>, now = new Date()): Progress {
  if (!tracks.some(track => track.id === result.track)) throw new Error('Unknown track.')
  if (!Number.isInteger(result.percent) || result.percent < 0 || result.percent > 100) throw new Error('Score must be a whole percentage.')
  const minutes = Math.max(0, Math.min(600, Math.round(result.minutes)))
  const mocks = [...progress.mocks ?? [], { track: result.track, at: now.toISOString(), percent: result.percent, minutes }].slice(-MAX_MOCKS)
  return { ...progress, updatedAt: now.toISOString(), mocks }
}

function storyText(value: unknown, max: number): string {
  if (typeof value !== 'string' || value.length > max) invalid('invalid story text.')
  return value
}

function parseStories(value: unknown): Story[] {
  if (!Array.isArray(value) || value.length > MAX_STORIES) invalid('invalid story bank.')
  const ids = new Set<string>()
  return value.map(entry => {
    const raw = object(entry, ['id', 'title', 'competencies', 'situation', 'task', 'action', 'result', 'updatedAt'])
    if (typeof raw.id !== 'string' || !/^s[a-z0-9]{4,24}$/.test(raw.id) || ids.has(raw.id)) invalid('invalid story id.')
    ids.add(raw.id)
    const list = raw.competencies
    if (!Array.isArray(list) || new Set(list).size !== list.length || list.some(item => !COMPETENCY_IDS.includes(item as Competency))) invalid('unknown story competency.')
    return {
      id: raw.id, title: storyText(raw.title, 120), competencies: list as Competency[],
      situation: storyText(raw.situation, MAX_STORY_FIELD), task: storyText(raw.task, MAX_STORY_FIELD),
      action: storyText(raw.action, MAX_STORY_FIELD), result: storyText(raw.result, MAX_STORY_FIELD),
      updatedAt: timestamp(raw.updatedAt),
    }
  })
}

/** Adds or replaces a story by id. Text is clipped to the backup limits. */
export function saveStory(progress: Progress, story: Omit<Story, 'updatedAt'>, now = new Date()): Progress {
  if (!/^s[a-z0-9]{4,24}$/.test(story.id)) throw new Error('Invalid story id.')
  const clean: Story = {
    id: story.id, title: story.title.slice(0, 120),
    competencies: [...new Set(story.competencies)].filter(item => COMPETENCY_IDS.includes(item)),
    situation: story.situation.slice(0, MAX_STORY_FIELD), task: story.task.slice(0, MAX_STORY_FIELD),
    action: story.action.slice(0, MAX_STORY_FIELD), result: story.result.slice(0, MAX_STORY_FIELD),
    updatedAt: now.toISOString(),
  }
  const list = progress.stories ?? []
  const exists = list.some(item => item.id === story.id)
  if (!exists && list.length >= MAX_STORIES) throw new Error(`The story bank holds up to ${MAX_STORIES} stories.`)
  const stories = exists ? list.map(item => item.id === story.id ? clean : item) : [...list, clean]
  return { ...progress, updatedAt: now.toISOString(), stories }
}

export function deleteStory(progress: Progress, id: string, now = new Date()): Progress {
  const stories = (progress.stories ?? []).filter(item => item.id !== id)
  const next: Progress = { ...progress, updatedAt: now.toISOString(), stories }
  if (!stories.length) delete next.stories
  return next
}

function parseDesigns(value: unknown): Record<string, DesignScore> {
  const raw = object(value)
  const designs: Record<string, DesignScore> = {}
  for (const [id, entry] of Object.entries(raw)) {
    if (!caseIds.has(id)) invalid('unknown design case. This backup may need a newer app version.')
    const score = object(entry, ['best', 'at'])
    designs[id] = { best: integer(score.best, 0, 100), at: timestamp(score.at) }
  }
  return designs
}

/** Saves a self-scored design attempt, keeping the best score and the time it was last scored. */
export function recordDesign(progress: Progress, caseId: string, score: number, now = new Date()): Progress {
  if (!caseIds.has(caseId)) throw new Error('Unknown design case.')
  if (!Number.isInteger(score) || score < 0 || score > 100) throw new Error('Score must be a whole percentage.')
  const best = Math.max(progress.designs?.[caseId]?.best ?? 0, score)
  return { ...progress, updatedAt: now.toISOString(), designs: { ...progress.designs, [caseId]: { best, at: now.toISOString() } } }
}

function parseGuides(value: unknown): Record<string, DesignScore> {
  const raw = object(value)
  const guides: Record<string, DesignScore> = {}
  for (const [id, entry] of Object.entries(raw)) {
    if (!guideIds.has(id)) invalid('unknown Field Guide entry. This backup may need a newer app version.')
    const score = object(entry, ['best', 'at'])
    guides[id] = { best: integer(score.best, 0, 100), at: timestamp(score.at) }
  }
  return guides
}

/** Marks a Field Guide entry as read with its quiz score, keeping the best score. */
export function recordGuide(progress: Progress, guideId: string, score: number, now = new Date()): Progress {
  if (!guideIds.has(guideId)) throw new Error('Unknown Field Guide entry.')
  if (!Number.isInteger(score) || score < 0 || score > 100) throw new Error('Score must be a whole percentage.')
  const best = Math.max(progress.guides?.[guideId]?.best ?? 0, score)
  return { ...progress, updatedAt: now.toISOString(), guides: { ...progress.guides, [guideId]: { best, at: now.toISOString() } } }
}

function parseSolved(value: unknown): Record<string, SolvedProblem> {
  const raw = object(value)
  const solved: Record<string, SolvedProblem> = {}
  for (const [id, entry] of Object.entries(raw)) {
    if (!problemIds.has(id)) invalid('unknown coding problem. This backup may need a newer app version.')
    const langs = object(entry, [], ['js', 'py'])
    if (!Object.keys(langs).length) invalid('solved problem has no language.')
    solved[id] = Object.fromEntries(Object.entries(langs).map(([lang, at]) => [lang, timestamp(at)]))
  }
  return solved
}

/** Records the first time a problem's tests all pass in a language. Later passes keep the original time. */
export function recordSolve(progress: Progress, problemId: string, lang: CodeLanguage, now = new Date()): Progress {
  if (!problemIds.has(problemId)) throw new Error('Unknown coding problem.')
  if (progress.solved?.[problemId]?.[lang]) return progress
  return {
    ...progress, updatedAt: now.toISOString(),
    solved: { ...progress.solved, [problemId]: { ...progress.solved?.[problemId], [lang]: now.toISOString() } },
  }
}

function parseProfile(value: unknown): Profile {
  const raw = object(value, [], ['interviewDate', 'focusTracks'])
  const profile: Profile = {}
  if (Object.hasOwn(raw, 'interviewDate')) {
    try { profile.interviewDate = day(raw.interviewDate) } catch { invalid('invalid interview date.') }
  }
  if (Object.hasOwn(raw, 'focusTracks')) {
    const list = raw.focusTracks
    if (!Array.isArray(list) || list.length > tracks.length || new Set(list).size !== list.length ||
      list.some(item => !tracks.some(track => track.id === item))) invalid('unknown focus track.')
    profile.focusTracks = list as Track[]
  }
  return profile
}

/** Merges profile changes; empty values are removed so backups stay minimal. */
export function updateProfile(progress: Progress, patch: { interviewDate?: string; focusTracks?: Track[] }, now = new Date()): Progress {
  const profile: Profile = { ...progress.profile, ...patch }
  if (!profile.interviewDate) delete profile.interviewDate
  if (!profile.focusTracks?.length) delete profile.focusTracks
  const next: Progress = { ...progress, updatedAt: now.toISOString() }
  if (Object.keys(profile).length) next.profile = profile
  else delete next.profile
  return next
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
