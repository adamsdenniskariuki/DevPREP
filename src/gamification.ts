import { lessons, tracks } from './curriculum'
import type { Track } from './curriculum'
import { getLearningPath, pathProgress } from './learning-paths'
import { localDay } from './progress'
import type { Activity, Progress } from './progress'
import { caseIndex } from './cases'

/** Light gamification derived entirely from saved activity, so old backups need no migration. */
export const XP_RULES = { learn: 20, review: 10, confidentBonus: 5, solve: 15, secondLanguage: 5, design: 25, designStrong: 10 } as const
/** A design score at or above this percentage earns the strong-answer bonus. */
export const STRONG_DESIGN = 80
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

/** XP from scored case studies: each scored case earns XP once, plus a bonus once its best reaches 80%. */
export function designXp(progress: Pick<Progress, 'designs'>): number {
  return Object.values(progress.designs ?? {}).reduce((sum, score) => sum + XP_RULES.design + (score.best >= STRONG_DESIGN ? XP_RULES.designStrong : 0), 0)
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

function trackComplete(progress: Progress, track: Track) {
  const subset = lessons.filter(lesson => lesson.track === track)
  return subset.length > 0 && subset.every(lesson => Object.hasOwn(progress.records, lesson.id))
}

export function gameStats(progress: Progress, now = new Date()): GameStats {
  const xp = progress.activity.reduce((sum, item) => sum + activityXp(item), 0) + solveXp(progress) + designXp(progress)
  const solves = Object.values(progress.solved ?? {})
  const solveDays = solves.flatMap(langs => Object.values(langs).map(at => localDay(new Date(at!))))
  const designs = Object.entries(progress.designs ?? {})
  const designDays = designs.map(([, score]) => localDay(new Date(score.at)))
  const streak = streakFrom([...progress.activity.map(item => localDay(new Date(item.at))), ...solveDays, ...designDays], localDay(now))
  const completed = Object.keys(progress.records).length
  const reviews = progress.activity.filter(item => item.mode === 'review').length
  const confident = progress.activity.filter(item => item.rating === 'confident').length
  const path = getLearningPath(progress.selectedPath)
  const badges: Badge[] = [
    { id: 'first-lesson', title: 'First step', description: 'Finish your first lesson.', earned: completed >= 1 },
    { id: 'ten-lessons', title: 'Ten down', description: 'Finish 10 lessons.', earned: completed >= 10 },
    { id: 'first-review', title: 'Recall', description: 'Complete a spaced review.', earned: reviews >= 1 },
    { id: 'reviews-25', title: 'Memory keeper', description: 'Complete 25 reviews.', earned: reviews >= 25 },
    { id: 'confident-10', title: 'Sure-footed', description: 'Rate 10 sessions Confident.', earned: confident >= 10 },
    { id: 'first-solve', title: 'Green tests', description: 'Pass every test on a coding problem.', earned: solves.length >= 1 },
    { id: 'bilingual', title: 'Bilingual', description: 'Solve a problem in both JavaScript and Python.', earned: solves.some(langs => langs.js && langs.py) },
    { id: 'solves-15', title: 'Pattern spotter', description: 'Solve 15 coding problems.', earned: solves.length >= 15 },
    { id: 'first-design', title: 'Architect', description: 'Score your first system design case.', earned: designs.length >= 1 },
    { id: 'designs-10', title: 'Blueprint pro', description: 'Score 10 system design cases.', earned: designs.length >= 10 },
    { id: 'senior-design', title: 'Staff-ready', description: `Score ${STRONG_DESIGN}% or more on an SSE case.`, earned: designs.some(([id, score]) => score.best >= STRONG_DESIGN && caseIndex.find(item => item.id === id)?.level === 'sse') },
    { id: 'streak-3', title: 'Warming up', description: 'Reach a 3-day streak.', earned: streak.best >= 3 },
    { id: 'streak-7', title: 'Full week', description: 'Reach a 7-day streak.', earned: streak.best >= 7 },
    { id: 'streak-30', title: 'Habit formed', description: 'Reach a 30-day streak.', earned: streak.best >= 30 },
    ...tracks.map(track => ({ id: `track-${track.id}`, title: `${track.title} done`, description: `Finish every ${track.title} lesson.`, earned: trackComplete(progress, track.id) })),
    { id: 'path-complete', title: 'Path finished', description: 'Finish every lesson in your role path.', earned: !!path && pathProgress(path, progress).completed === pathProgress(path, progress).total },
    { id: 'all-lessons', title: 'Completionist', description: `Finish all ${lessons.length} lessons.`, earned: completed === lessons.length },
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

/** Tracks ordered by lessons last rated "Needs practice", then by lowest completion. Focus tracks come first. */
export function weakAreas(progress: Progress): WeakArea[] {
  const focus = progress.profile?.focusTracks ?? []
  return tracks.map(track => {
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
