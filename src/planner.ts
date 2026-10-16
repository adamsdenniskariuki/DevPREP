import { lessons } from './curriculum'
import type { Track } from './curriculum-types'
import { caseIndex } from './cases'
import { isPathCore, patternProgress, problemIndex } from './problems'
import { trackOptedIn, weakAreas } from './gamification'
import { getLearningPath, pathLessonIds } from './learning-paths'
import { knownLessons } from './progress'
import type { Progress } from './progress'
import { MOCK_MINUTES } from './mocks'
import { guideIndex } from './guides'
import { TOPIC_TRACK } from './guide-types'

export type PlanKind = 'lesson' | 'cards' | 'problem' | 'case' | 'guide' | 'mock' | 'rest'
export interface PlanItem {
  kind: PlanKind
  /** Lesson, problem, case or Field Guide id; the track for mocks. */
  ref?: string
  title: string
  minutes: number
}
export interface PlanDay {
  day: string
  items: PlanItem[]
}
export interface StudyPlan {
  end: string
  /** True when the end date comes from the saved interview date rather than the default week. */
  dated: boolean
  days: PlanDay[]
  /** Lessons that did not fit before the interview. */
  unscheduled: number
}

export const DEFAULT_DAYS = 7
export const MAX_PLAN_DAYS = 90
export const MAX_LESSONS_PER_DAY = 3
export const CARD_MINUTES = 10
const TRACK_NAMES: Record<Track, string> = { dsa: 'DSA', 'system-design': 'System design', ml: 'ML', ai: 'AI/LLM', behavioral: 'Behavioral', python: 'Python', typescript: 'TypeScript', sql: 'SQL' }

function dayNumber(day: string): number {
  const [y, m, d] = day.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000)
}
function fromNumber(value: number): string {
  return new Date(value * 86_400_000).toISOString().slice(0, 10)
}

/**
 * Unfinished lessons in study order: role path first, then focus tracks, then weakest tracks, then the rest.
 * Language tracks join only once opted in, and lessons a placement check marked as known are skipped.
 */
export function lessonQueue(progress: Progress): string[] {
  const known = knownLessons(progress)
  const done = (id: string) => Object.hasOwn(progress.records, id) || known.has(id)
  const order: string[] = []
  const add = (ids: string[]) => { for (const id of ids) if (!done(id) && !order.includes(id)) order.push(id) }
  const path = getLearningPath(progress.selectedPath)
  if (path) add(pathLessonIds(path))
  const tracks = [...new Set([...progress.profile?.focusTracks ?? [], ...weakAreas(progress).map(area => area.track)])]
  for (const track of tracks) add(lessons.filter(lesson => lesson.track === track).map(lesson => lesson.id))
  add(lessons.filter(lesson => trackOptedIn(progress, lesson.track)).map(lesson => lesson.id))
  return order
}

const DIFFICULTY_ORDER = { 'warm-up': 0, core: 1, stretch: 2 } as const

/**
 * Unsolved problems in plan order: core problems on the chosen path first, then patterns with the
 * lowest share solved (weak areas), then easier problems first. SSE-only problems need the senior path.
 */
export function problemQueue(progress: Progress) {
  const path = progress.selectedPath
  const share = new Map(patternProgress(progress).map(row => [row.pattern, row.solved / row.total]))
  return problemIndex
    .filter(problem => !progress.solved?.[problem.id] && (path === 'senior' || problem.level === 'se'))
    .map((problem, order) => ({ problem, order }))
    .sort((a, b) => Number(isPathCore(b.problem, path)) - Number(isPathCore(a.problem, path))
      || share.get(a.problem.pattern)! - share.get(b.problem.pattern)!
      || DIFFICULTY_ORDER[a.problem.difficulty] - DIFFICULTY_ORDER[b.problem.difficulty]
      || a.order - b.order)
    .map(item => item.problem)
}

/**
 * Unread Field Guide entries in plan order: topics that feed focus or weak tracks first, then entries
 * at the user's level (SSE first on the senior path, SE first otherwise), then content order.
 */
export function guideQueue(progress: Progress) {
  const senior = progress.selectedPath === 'senior'
  const tracks = [...new Set([...progress.profile?.focusTracks ?? [], ...weakAreas(progress).map(area => area.track)])]
  const rank = (track: Track) => { const at = tracks.indexOf(track); return at < 0 ? tracks.length : at }
  return guideIndex
    .map((item, order) => ({ item, order }))
    .filter(({ item }) => !progress.guides?.[item.id])
    .sort((a, b) => rank(TOPIC_TRACK[a.item.topic]) - rank(TOPIC_TRACK[b.item.topic])
      || Number((a.item.level === 'sse') !== senior) - Number((b.item.level === 'sse') !== senior)
      || a.order - b.order)
    .map(({ item }) => item)
}

/**
 * Builds a day-by-day plan from today until the interview (or a default week).
 * Every day has flashcards; lessons are spread evenly (up to 3 a day); coding problems and
 * design cases alternate; every third day adds a Field Guide entry; mocks land weekly and on the two days before the interview,
 * which itself is a light review day.
 */
export function planStudy(progress: Progress, today: string): StudyPlan {
  const start = dayNumber(today)
  const saved = progress.profile?.interviewDate
  const dated = !!saved && dayNumber(saved) >= start
  const endNumber = dated ? Math.min(dayNumber(saved!), start + MAX_PLAN_DAYS - 1) : start + DEFAULT_DAYS - 1
  const total = endNumber - start + 1
  const studyDays = dated && total > 1 ? total - 1 : total
  const queue = lessonQueue(progress)
  const perDay = Math.min(MAX_LESSONS_PER_DAY, Math.max(1, Math.ceil(queue.length / studyDays)))
  const lessonById = new Map(lessons.map(lesson => [lesson.id, lesson]))
  const senior = progress.selectedPath === 'senior'
  const problems = problemQueue(progress)
  const cases = caseIndex.filter(item => !progress.designs?.[item.id]).sort((a, b) => Number(senior ? b.level === 'sse' : a.level === 'sse') - Number(senior ? a.level === 'sse' : b.level === 'sse'))
  const mockTracks = [...new Set([...progress.profile?.focusTracks ?? [], ...weakAreas(progress).map(area => area.track)])]
  const guides = guideQueue(progress)
  let lessonAt = 0, problemAt = 0, caseAt = 0, mockAt = 0, guideAt = 0
  const days: PlanDay[] = []
  for (let index = 0; index < total; index++) {
    const value = start + index
    const items: PlanItem[] = [{ kind: 'cards', title: 'Flashcard review', minutes: CARD_MINUTES }]
    if (dated && value === dayNumber(saved!)) {
      items.push({ kind: 'rest', title: 'Interview day: light review only', minutes: 0 })
      days.push({ day: fromNumber(value), items })
      continue
    }
    for (let n = 0; n < perDay && lessonAt < queue.length; n++) {
      const lesson = lessonById.get(queue[lessonAt++])!
      items.push({ kind: 'lesson', ref: lesson.id, title: lesson.title, minutes: lesson.minutes })
    }
    if (index % 2 === 0 && problemAt < problems.length) {
      const problem = problems[problemAt++]
      items.push({ kind: 'problem', ref: problem.id, title: problem.title, minutes: 30 })
    } else if (index % 2 === 1 && caseAt < cases.length) {
      const item = cases[caseAt++]
      items.push({ kind: 'case', ref: item.id, title: item.title, minutes: item.minutes })
    }
    if (index % 3 === 2 && guideAt < guides.length) {
      const item = guides[guideAt++]
      items.push({ kind: 'guide', ref: item.id, title: item.title, minutes: item.minutes })
    }
    const daysLeft = dated ? dayNumber(saved!) - value : Infinity
    if (index % 7 === 6 || daysLeft === 1 || daysLeft === 2) {
      const track = mockTracks[mockAt++ % mockTracks.length] ?? 'dsa'
      items.push({ kind: 'mock', ref: track, title: `${TRACK_NAMES[track]} mock interview`, minutes: MOCK_MINUTES[track] })
    }
    days.push({ day: fromNumber(value), items })
  }
  return { end: fromNumber(endNumber), dated, days, unscheduled: queue.length - lessonAt }
}
