import { describe, expect, it } from 'vitest'
import { lessons } from './curriculum'
import { activityXp, daysUntil, designXp, gameStats, solveXp, streakFrom, weakAreas } from './gamification'
import { emptyProgress, parseBackup, recordDesign, recordSolve, serializeBackup, updateProfile } from './progress'
import { problemIndex } from './problems'
import { caseIndex } from './cases'
import type { Progress } from './progress'

describe('streakFrom', () => {
  it('is empty with no activity', () => {
    expect(streakFrom([], '2025-01-10')).toMatchObject({ current: 0, best: 0, freezes: 0, activeToday: false })
  })
  it('counts consecutive days and today', () => {
    expect(streakFrom(['2025-01-08', '2025-01-09', '2025-01-10', '2025-01-10'], '2025-01-10'))
      .toMatchObject({ current: 3, best: 3, activeToday: true })
  })
  it('keeps the streak through yesterday', () => {
    expect(streakFrom(['2025-01-08', '2025-01-09'], '2025-01-10')).toMatchObject({ current: 2, activeToday: false, frozenDays: 0 })
  })
  it('breaks after a missed day without freezes', () => {
    expect(streakFrom(['2025-01-01', '2025-01-02', '2025-01-04'], '2025-01-04')).toMatchObject({ current: 1, best: 2 })
    expect(streakFrom(['2025-01-01', '2025-01-02'], '2025-01-04')).toMatchObject({ current: 0, best: 2 })
  })
  it('earns a freeze every 7 days and spends it on a missed day', () => {
    const week = Array.from({ length: 7 }, (_, i) => `2025-01-0${i + 1}`)
    expect(streakFrom(week, '2025-01-07')).toMatchObject({ current: 7, freezes: 1 })
    expect(streakFrom([...week, '2025-01-09'], '2025-01-09')).toMatchObject({ current: 8, freezes: 0 })
    expect(streakFrom(week, '2025-01-09')).toMatchObject({ current: 7, freezes: 0, frozenDays: 1 })
    expect(streakFrom(week, '2025-01-10')).toMatchObject({ current: 0, best: 7 })
  })
  it('caps freezes at two', () => {
    const days = Array.from({ length: 28 }, (_, i) => new Date(Date.UTC(2025, 0, i + 1)).toISOString().slice(0, 10))
    expect(streakFrom(days, '2025-01-28').freezes).toBe(2)
  })
  it('ignores future days', () => {
    expect(streakFrom(['2025-01-10', '2025-02-01'], '2025-01-10')).toMatchObject({ current: 1, activeToday: true })
  })
})

describe('gameStats', () => {
  it('derives XP, levels and badges from activity', () => {
    const now = new Date(2025, 0, 10, 12)
    const lesson = lessons[0]
    const progress: Progress = {
      ...emptyProgress(),
      records: { [lesson.id]: { attempts: 2, lastCompleted: now.toISOString(), due: '2025-01-17', rating: 'okay', intervalDays: 7 } },
      activity: [
        { lessonId: lesson.id, at: now.toISOString(), mode: 'learn', rating: 'confident' },
        { lessonId: lesson.id, at: now.toISOString(), mode: 'review', rating: 'okay' },
      ],
    }
    expect(activityXp({ mode: 'learn', rating: 'again' })).toBe(20)
    const stats = gameStats(progress, now)
    expect(stats.xp).toBe(35)
    expect(stats.level).toBe(1)
    expect(stats.streak.activeToday).toBe(true)
    const earned = stats.badges.filter(badge => badge.earned).map(badge => badge.id)
    expect(earned).toEqual(expect.arrayContaining(['first-lesson', 'first-review']))
    expect(earned).not.toContain('all-lessons')
  })

  it('awards solve XP, solve days and solve badges', () => {
    const now = new Date(2025, 0, 10, 12)
    const [a, b] = problemIndex
    let progress = recordSolve(emptyProgress(), a.id, 'js', now)
    expect(solveXp(progress)).toBe(15)
    expect(gameStats(progress, now).badges.filter(badge => badge.earned).map(badge => badge.id)).toEqual(['first-solve'])
    expect(gameStats(progress, now).streak).toMatchObject({ current: 1, activeToday: true })
    progress = recordSolve(progress, a.id, 'py', now)
    progress = recordSolve(progress, b.id, 'js', now)
    expect(solveXp(progress)).toBe(15 + 5 + 15)
    expect(gameStats(progress, now).xp).toBe(35)
    const earned = gameStats(progress, now).badges.filter(badge => badge.earned).map(badge => badge.id)
    expect(earned).toEqual(expect.arrayContaining(['first-solve', 'bilingual']))
    expect(earned).not.toContain('solves-15')
    for (const problem of problemIndex.slice(0, 15)) progress = recordSolve(progress, problem.id, 'js', now)
    expect(gameStats(progress, now).badges.find(badge => badge.id === 'solves-15')?.earned).toBe(true)
  })

  it('awards design XP, design days and design badges', () => {
    const now = new Date(2025, 0, 10, 12)
    const se = caseIndex.find(item => item.level === 'se')!
    const sse = caseIndex.find(item => item.level === 'sse')!
    const earned = (progress: Progress) => gameStats(progress, now).badges.filter(badge => badge.earned).map(badge => badge.id)
    let progress = recordDesign(emptyProgress(), se.id, 60, now)
    expect(designXp(progress)).toBe(25)
    expect(earned(progress)).toEqual(['first-design'])
    expect(gameStats(progress, now).streak).toMatchObject({ current: 1, activeToday: true })
    progress = recordDesign(progress, se.id, 95, now)
    expect(designXp(progress)).toBe(35)
    expect(earned(progress)).not.toContain('senior-design')
    progress = recordDesign(progress, sse.id, 80, now)
    expect(designXp(progress)).toBe(70)
    expect(earned(progress)).toContain('senior-design')
    for (const item of caseIndex.slice(0, 10)) progress = recordDesign(progress, item.id, 50, now)
    expect(earned(progress)).toContain('designs-10')
  })
})

describe('weakAreas and profile', () => {
  it('puts focus tracks first, then tracks needing practice', () => {
    const lesson = lessons.find(item => item.track === 'ml')!
    const progress: Progress = {
      ...emptyProgress(),
      records: { [lesson.id]: { attempts: 1, lastCompleted: '2025-01-01T00:00:00.000Z', due: '2025-01-02', rating: 'again', intervalDays: 1 } },
    }
    expect(weakAreas(progress)[0].track).toBe('ml')
    expect(weakAreas(updateProfile(progress, { focusTracks: ['behavioral'] }))[0].track).toBe('behavioral')
  })
  it('round-trips the optional profile and omits it when empty', () => {
    const withProfile = updateProfile(emptyProgress(), { interviewDate: '2030-05-01', focusTracks: ['dsa'] })
    expect(parseBackup(serializeBackup(withProfile)).profile).toEqual({ interviewDate: '2030-05-01', focusTracks: ['dsa'] })
    const cleared = updateProfile(withProfile, { interviewDate: undefined, focusTracks: [] })
    expect(cleared.profile).toBeUndefined()
    expect(JSON.parse(serializeBackup(cleared))).not.toHaveProperty('profile')
  })
  it('rejects invalid profiles', () => {
    const base = JSON.parse(serializeBackup(emptyProgress()))
    expect(() => parseBackup(JSON.stringify({ ...base, profile: { interviewDate: 'soon' } }))).toThrow()
    expect(() => parseBackup(JSON.stringify({ ...base, profile: { focusTracks: ['cooking'] } }))).toThrow()
    expect(() => parseBackup(JSON.stringify({ ...base, profile: { focusTracks: ['dsa', 'dsa'] } }))).toThrow()
    expect(() => parseBackup(JSON.stringify({ ...base, profile: { extra: 1 } }))).toThrow()
  })
  it('counts days until the interview', () => {
    expect(daysUntil('2025-01-15', new Date(2025, 0, 10, 23))).toBe(5)
    expect(daysUntil(undefined)).toBeUndefined()
  })
})
