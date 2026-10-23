import { CORE_TRACKS, languageTracks, lessons, tracks } from './curriculum'
import type { Track } from './curriculum'
import { getLearningPath, pathProgress } from './learning-paths'
import { localDay } from './progress'
import type { Activity, Progress } from './progress'
import { caseIndex } from './cases'
import { patternProgress, problemIndex } from './problems'
import { guideIndex } from './guides'
import { sqlProblemIndex, sqlTopicProgress } from './sql-problems'
import { GUIDE_TOPICS, TOPIC_LABELS } from './guide-types'
import { patternIndex, PICKER_ROUND } from './patterns'

/** Light gamification derived entirely from saved activity, so old backups need no migration. */
export const XP_RULES = { learn: 20, review: 10, confidentBonus: 5, solve: 15, secondLanguage: 5, design: 25, designStrong: 10, card: 2, mock: 30, mockStrong: 10, guide: 15, guidePerfect: 5, sqlSolve: 15, patternExercise: 15, patternSecondLanguage: 5, patternQuiz: 10, patternQuizPerfect: 5, pickerRound: 5 } as const
/** A design score at or above this percentage earns the strong-answer bonus. */
export const STRONG_DESIGN = 80
/** A mock interview score at or above this percentage earns the strong-mock bonus. */
export const STRONG_MOCK = 80
export const LEVEL_XP = 200
export const FREEZE_EVERY = 7
export const MAX_FREEZES = 2

export function activityXp(item: Pick<Activity, 'mode' | 'rating'>): number {
  return XP_RULES[item.mode] + (item.rating === 'confident' ? XP_RULES.confidentBonus : 0)
}

/** XP from runnable problems: the first passing language earns a solve, the other language a bonus. */
export function solveXp(progress: Pick<Progress, 'solved'>): number {
  return Object.values(progress.solved ?? {}).reduce((sum, langs) => {
    const count = Object.keys(langs).length
    return sum + (count ? XP_RULES.solve + (count - 1) * XP_RULES.secondLanguage : 0)
  }, 0)
}

/** XP from SQL interview problems: each first pass earns a solve. */
export function sqlSolveXp(progress: Pick<Progress, 'sqlSolved'>): number {
  return Object.keys(progress.sqlSolved ?? {}).length * XP_RULES.sqlSolve
}

/** XP from scored case studies: each scored case earns XP once, plus a bonus once its best reaches 80%. */
export function designXp(progress: Pick<Progress, 'designs'>): number {
  return Object.values(progress.designs ?? {}).reduce((sum, score) => sum + XP_RULES.design + (score.best >= STRONG_DESIGN ? XP_RULES.designStrong : 0), 0)
}

/** XP from flashcards: each review counts, so XP grows with practice rather than with cards seen. */
/** Field Guide: XP for each entry read and quizzed, plus a bonus for a perfect quiz. */
export function guideXp(progress: Pick<Progress, 'guides'>): number {
  return Object.values(progress.guides ?? {}).reduce((sum, score) => sum + XP_RULES.guide + (score.best === 100 ? XP_RULES.guidePerfect : 0), 0)
}

/** Read and total Field Guide entries per topic that has content, in topic order. */
export function guideTopicProgress(progress: Pick<Progress, 'guides'>) {
  return GUIDE_TOPICS.map(topic => {
    const items = guideIndex.filter(item => item.topic === topic)
    return { topic, label: TOPIC_LABELS[topic], total: items.length, read: items.filter(item => progress.guides?.[item.id]).length }
  }).filter(row => row.total > 0)
}

/** Pattern course: exercise passes per language, quick checks and picker rounds. */
export function patternXp(progress: Pick<Progress, 'patterns' | 'patternPicker'>): number {
  const pages = Object.values(progress.patterns ?? {}).reduce((sum, page) => {
    const langs = Object.keys(page.exercise ?? {}).length
    const exercise = langs ? XP_RULES.patternExercise + (langs - 1) * XP_RULES.patternSecondLanguage : 0
    const quiz = page.quiz ? XP_RULES.patternQuiz + (page.quiz.best === 100 ? XP_RULES.patternQuizPerfect : 0) : 0
    return sum + exercise + quiz
  }, 0)
  return pages + (progress.patternPicker?.rounds ?? 0) * XP_RULES.pickerRound
}

/** A pattern page counts as done once its exercise passes in any language and its quick check is taken. */
export function patternPageDone(progress: Pick<Progress, 'patterns'>, pageId: string): boolean {
  const page = progress.patterns?.[pageId]
  return !!page?.quiz && Object.keys(page.exercise ?? {}).length > 0
}

export function cardXp(progress: Pick<Progress, 'cards'>): number {
  return Object.values(progress.cards ?? {}).reduce((sum, card) => sum + card.reviews * XP_RULES.card, 0)
}

export function mockXp(progress: Pick<Progress, 'mocks'>): number {
  return (progress.mocks ?? []).reduce((sum, mock) => sum + XP_RULES.mock + (mock.percent >= STRONG_MOCK ? XP_RULES.mockStrong : 0), 0)
}

function dayNumber(day: string): number {
  const [y, m, d] = day.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000)
}

export interface Streak {
  /** Consecutive active days, kept alive by freezes. 0 when broken. */
  current: number
  best: number
  /** Freezes still available after covering any missed days. */
  freezes: number
  activeToday: boolean
  /** Missed days that a freeze is currently covering. */
  frozenDays: number
}

/**
 * Walks the distinct local study days in order. A freeze is earned every 7 streak days (max 2)
 * and is spent automatically on a missed day; a gap larger than the available freezes resets the streak.
 */
export function streakFrom(days: string[], today: string): Streak {
  const sorted = [...new Set(days)].filter(day => day <= today).sort()
  let current = 0, best = 0, freezes = 0, previous: number | undefined
  for (const day of sorted) {
    const value = dayNumber(day)
    const missed = previous === undefined ? 0 : value - previous - 1
    if (previous === undefined || missed > freezes) current = 1
    else { freezes -= missed; current += 1 }
    if (current % FREEZE_EVERY === 0) freezes = Math.min(MAX_FREEZES, freezes + 1)
    best = Math.max(best, current)
    previous = value
  }
  if (previous === undefined) return { current: 0, best: 0, freezes: 0, activeToday: false, frozenDays: 0 }
  const gap = dayNumber(today) - previous
  if (gap === 0) return { current, best, freezes, activeToday: true, frozenDays: 0 }
  const missed = gap - 1
  if (missed <= freezes) return { current, best, freezes: freezes - missed, activeToday: false, frozenDays: missed }
  return { current: 0, best, freezes, activeToday: false, frozenDays: 0 }
}

export interface Badge {
  id: string
  title: string
  description: string
  earned: boolean
}

export interface GameStats {
  xp: number
  level: number
  levelXp: number
  streak: Streak
  badges: Badge[]
}

export function patternSlug(pattern: string): string {
  return pattern.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function trackComplete(progress: Progress, track: Track) {
  const subset = lessons.filter(lesson => lesson.track === track)
  return subset.length > 0 && subset.every(lesson => Object.hasOwn(progress.records, lesson.id))
}

export function gameStats(progress: Progress, now = new Date()): GameStats {
  const xp = progress.activity.reduce((sum, item) => sum + activityXp(item), 0) + solveXp(progress) + designXp(progress) + cardXp(progress) + mockXp(progress) + guideXp(progress) + sqlSolveXp(progress) + patternXp(progress)
  const solves = Object.values(progress.solved ?? {})
  const solveDays = solves.flatMap(langs => Object.values(langs).map(at => localDay(new Date(at!))))
  const sqlSolves = Object.values(progress.sqlSolved ?? {})
  const designs = Object.entries(progress.designs ?? {})
  const designDays = designs.map(([, score]) => localDay(new Date(score.at)))
  const cards = Object.values(progress.cards ?? {})
  const mocks = progress.mocks ?? []
  const guides = Object.entries(progress.guides ?? {})
  const guideDays = guides.map(([, score]) => localDay(new Date(score.at)))
  const patternDays = Object.values(progress.patterns ?? {}).flatMap(page => [...Object.values(page.exercise ?? {}), ...page.quiz ? [page.quiz.at] : []]).map(at => localDay(new Date(at!)))
  if (progress.patternPicker) patternDays.push(localDay(new Date(progress.patternPicker.at)))
  const practiceDays = [...patternDays, ...sqlSolves.map(at => localDay(new Date(at))), ...guideDays, ...cards.map(card => localDay(new Date(card.at))), ...mocks.map(mock => localDay(new Date(mock.at)))]
  const streak = streakFrom([...progress.activity.map(item => localDay(new Date(item.at))), ...solveDays, ...designDays, ...practiceDays], localDay(now))
  const completed = Object.keys(progress.records).length
  const reviews = progress.activity.filter(item => item.mode === 'review').length
  const confident = progress.activity.filter(item => item.rating === 'confident').length
  const path = getLearningPath(progress.selectedPath)
  const patterns = patternProgress(progress)
  const coreLessons = lessons.filter(lesson => CORE_TRACKS.includes(lesson.track))
  const badges: Badge[] = [
    { id: 'first-lesson', title: 'First step', description: 'Finish your first lesson.', earned: completed >= 1 },
    { id: 'ten-lessons', title: 'Ten down', description: 'Finish 10 lessons.', earned: completed >= 10 },
    { id: 'first-review', title: 'Recall', description: 'Complete a spaced review.', earned: reviews >= 1 },
    { id: 'reviews-25', title: 'Memory keeper', description: 'Complete 25 reviews.', earned: reviews >= 25 },
    { id: 'confident-10', title: 'Sure-footed', description: 'Rate 10 sessions Confident.', earned: confident >= 10 },
    { id: 'first-solve', title: 'Green tests', description: 'Pass every test on a coding problem.', earned: solves.length >= 1 },
    { id: 'bilingual', title: 'Bilingual', description: 'Solve a problem in both JavaScript and Python.', earned: solves.some(langs => langs.js && langs.py) },
    { id: 'solves-15', title: 'Pattern spotter', description: 'Solve 15 coding problems.', earned: solves.length >= 15 },
    { id: 'solves-50', title: 'Half-century', description: 'Solve 50 coding problems.', earned: solves.length >= 50 },
    { id: 'all-patterns', title: 'Full toolkit', description: 'Solve at least one problem in every pattern.', earned: patterns.every(row => row.solved > 0) },
    { id: 'all-problems', title: 'Every problem', description: `Solve all ${problemIndex.length} coding problems.`, earned: patterns.every(row => row.solved === row.total) },
    ...patterns.map(row => ({ id: `pattern-${patternSlug(row.pattern)}`, title: `${row.pattern} cleared`, description: `Solve all ${row.total} ${row.pattern} problems.`, earned: row.solved === row.total })),
    { id: 'first-sql-solve', title: 'First query', description: 'Pass every test on a SQL interview problem.', earned: sqlSolves.length >= 1 },
    { id: 'sql-solves-20', title: 'Query crafter', description: 'Solve 20 SQL interview problems.', earned: sqlSolves.length >= 20 },
    { id: 'all-sql-problems', title: 'SQL marathon', description: `Solve all ${sqlProblemIndex.length} SQL interview problems.`, earned: sqlProblemIndex.length > 0 && sqlSolves.length >= sqlProblemIndex.length },
    ...sqlTopicProgress(progress).map(row => ({ id: `sql-topic-${patternSlug(row.topic)}`, title: `SQL ${row.topic.toLowerCase()} cleared`, description: `Solve all ${row.total} SQL ${row.topic.toLowerCase()} problems.`, earned: row.solved === row.total })),
    { id: 'first-design', title: 'Architect', description: 'Score your first system design case.', earned: designs.length >= 1 },
    { id: 'designs-10', title: 'Blueprint pro', description: 'Score 10 system design cases.', earned: designs.length >= 10 },
    { id: 'senior-design', title: 'Staff-ready', description: `Score ${STRONG_DESIGN}% or more on an SSE case.`, earned: designs.some(([id, score]) => score.best >= STRONG_DESIGN && caseIndex.find(item => item.id === id)?.level === 'sse') },
    { id: 'first-guide', title: 'Field notes', description: 'Finish a Field Guide entry and its quiz.', earned: guides.length >= 1 },
    { id: 'guides-10', title: 'Well read', description: 'Finish 10 Field Guide entries.', earned: guides.length >= 10 },
    { id: 'case-reader', title: 'Postmortem reader', description: 'Finish 3 real-world case studies.', earned: guides.filter(([id]) => guideIndex.find(item => item.id === id)?.kind === 'case').length >= 3 },
    { id: 'quiz-perfect-5', title: 'Sharp eye', description: 'Score 100% on 5 Field Guide quizzes.', earned: guides.filter(([, score]) => score.best === 100).length >= 5 },
    ...guideTopicProgress(progress).map(row => ({ id: `guide-topic-${row.topic}`, title: `${row.label} guide`, description: `Finish all ${row.total} ${row.label} entries in the Field Guide.`, earned: row.read === row.total })),
    { id: 'first-cards', title: 'Card shark', description: 'Review your first flashcard.', earned: cards.length >= 1 },
    { id: 'cards-mastered-50', title: 'Long-term memory', description: 'Move 50 flashcards to a two-week interval or longer.', earned: cards.filter(card => card.box >= 4).length >= 50 },
    { id: 'first-mock', title: 'Under the clock', description: 'Finish a mock interview.', earned: mocks.length >= 1 },
    { id: 'mocks-5', title: 'Interview-ready', description: 'Finish 5 mock interviews.', earned: mocks.length >= 5 },
    { id: 'mock-every-track', title: 'All-rounder', description: 'Finish a mock interview in every track.', earned: CORE_TRACKS.every(track => mocks.some(mock => mock.track === track)) },
    { id: 'story-bank', title: 'Storyteller', description: 'Write 5 behavioral stories.', earned: (progress.stories ?? []).length >= 5 },
    { id: 'streak-3', title: 'Warming up', description: 'Reach a 3-day streak.', earned: streak.best >= 3 },
    { id: 'streak-7', title: 'Full week', description: 'Reach a 7-day streak.', earned: streak.best >= 7 },
    { id: 'streak-30', title: 'Habit formed', description: 'Reach a 30-day streak.', earned: streak.best >= 30 },
    ...tracks.map(track => ({ id: `track-${track.id}`, title: `${track.title} done`, description: `Finish every ${track.title} lesson.`, earned: trackComplete(progress, track.id) })),
    { id: 'path-complete', title: 'Path finished', description: 'Finish every lesson in your role path.', earned: !!path && pathProgress(path, progress).completed === pathProgress(path, progress).total },
    { id: 'all-lessons', title: 'Completionist', description: `Finish all ${coreLessons.length} interview-track lessons.`, earned: coreLessons.every(lesson => Object.hasOwn(progress.records, lesson.id)) },
    ...languageTracks.flatMap(track => [
      ...track.placement ? [{ id: `placed-${track.id}`, title: `${track.title} placed`, description: `Take the ${track.title} placement check.`, earned: !!progress.placements?.[track.id] }] : [],
      { id: `trivia-${track.id}`, title: `${track.title} trivia`, description: `Finish a ${track.title} trivia mock interview.`, earned: mocks.some(mock => mock.track === track.id) },
    ]),
    ...patternIndex.map(page => ({ id: `pattern-course-${page.id}`, title: `${page.title} learned`, description: `Pass the ${page.title} exercise and take its quick check.`, earned: patternPageDone(progress, page.id) })),
    { id: 'first-pattern', title: 'Pattern learner', description: 'Finish your first pattern page: exercise and quick check.', earned: patternIndex.some(page => patternPageDone(progress, page.id)) },
    { id: 'patterns-course', title: 'Pattern course', description: `Finish all ${patternIndex.length} pattern pages.`, earned: patternIndex.length > 0 && patternIndex.every(page => patternPageDone(progress, page.id)) },
    { id: 'picker-sharp', title: 'Quick eye', description: `Score 9 or more out of ${PICKER_ROUND} in a pattern picker round.`, earned: (progress.patternPicker?.best ?? 0) >= 9 },
  ]
  return { xp, level: Math.floor(xp / LEVEL_XP) + 1, levelXp: xp % LEVEL_XP, streak, badges }
}

export interface WeakArea {
  track: Track
  title: string
  needsPractice: number
  completed: number
  total: number
}

/** Interview tracks always count; a language track counts once it is a focus track, started or placed. */
export function trackOptedIn(progress: Progress, track: Track): boolean {
  if (CORE_TRACKS.includes(track)) return true
  return !!progress.profile?.focusTracks?.includes(track) || !!progress.placements?.[track] ||
    lessons.some(lesson => lesson.track === track && (Object.hasOwn(progress.records, lesson.id) || progress.session?.lessonId === lesson.id))
}

/** Tracks ordered by lessons last rated "Needs practice", then by lowest completion. Focus tracks come first. */
export function weakAreas(progress: Progress): WeakArea[] {
  const focus = progress.profile?.focusTracks ?? []
  return tracks.filter(track => trackOptedIn(progress, track.id)).map(track => {
    const subset = lessons.filter(lesson => lesson.track === track.id)
    return {
      track: track.id, title: track.title, total: subset.length,
      completed: subset.filter(lesson => progress.records[lesson.id]).length,
      needsPractice: subset.filter(lesson => progress.records[lesson.id]?.rating === 'again').length,
    }
  }).sort((a, b) => Number(focus.includes(b.track)) - Number(focus.includes(a.track)) ||
    b.needsPractice - a.needsPractice || a.completed / a.total - b.completed / b.total)
}

/** Whole days from today until the interview; negative once it has passed. */
export function daysUntil(interviewDate: string | undefined, now = new Date()): number | undefined {
  if (!interviewDate) return undefined
  return dayNumber(interviewDate) - dayNumber(localDay(now))
}
