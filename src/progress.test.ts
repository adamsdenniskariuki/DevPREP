import { describe, expect, it } from 'vitest'
import { lessons, tracks } from './curriculum'
import {
  beginSession, completeSession, dueLessons, emptyProgress, localDay, MAX_BACKUP_BYTES,
  MAX_DRAFT_LENGTH, parseBackup, readProgress, serializeBackup, STORAGE_KEY, writeProgress,
} from './progress'
import type { Progress, Rating, StoragePort } from './progress'

const now = new Date('2026-09-17T12:00:00.000Z')
const first = lessons[0]

function attempt(): Progress {
  const progress = beginSession(emptyProgress(now), first.id, 'learn', now)
  return { ...progress, session: { ...progress.session!, phase: 'assess', draft: 'An original explanation.' } }
}

class MemoryStorage implements StoragePort {
  data: string | null = null
  getItem(key: string) { expect(key).toBe(STORAGE_KEY); return this.data }
  setItem(key: string, value: string) { expect(key).toBe(STORAGE_KEY); this.data = value }
}

describe('expanded curriculum contract', () => {
  it('has original, substantive content in all four tracks', () => {
    expect(lessons.length).toBeGreaterThanOrEqual(40)
    expect(new Set(lessons.map(lesson => lesson.id)).size).toBe(lessons.length)
    expect(lessons.filter(lesson => lesson.track === 'dsa').length).toBeGreaterThanOrEqual(18)
    expect(tracks).toHaveLength(4)
    for (const lesson of lessons) {
      expect(lesson.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      expect(tracks.some(track => track.id === lesson.track)).toBe(true)
      expect(lesson.minutes).toBeGreaterThanOrEqual(30)
      expect(lesson.minutes).toBeLessThanOrEqual(60)
      expect(lesson.objectives.length).toBeGreaterThanOrEqual(2)
      expect(lesson.concepts.length).toBeGreaterThanOrEqual(2)
      expect(lesson.concepts.every(concept => concept.body.length > 80)).toBe(true)
      expect(lesson.example.trim()).not.toBe('')
      expect(lesson.task.length).toBeGreaterThan(100)
      expect(lesson.solution.length).toBeGreaterThan(200)
      expect(lesson.hints).toHaveLength(2)
      expect(lesson.checklist.length).toBeGreaterThanOrEqual(3)
      expect(lesson.pitfalls.length).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('study lifecycle', () => {
  it('starts empty without fabricating progress', () => {
    expect(readProgress(new MemoryStorage()).records).toEqual({})
    expect(dueLessons(emptyProgress(now), now)).toEqual([])
  })

  it('round-trips an unfinished draft, hints, phase, and checklist', () => {
    const progress = attempt()
    progress.session!.draft = 'Line 1\n<script>alert("not executed")</script>\nLine 3'
    progress.session!.hintsRevealed = 1
    progress.session!.solutionRevealed = true
    progress.session!.checks[0] = true
    const storage = new MemoryStorage()
    writeProgress(storage, progress)
    expect(readProgress(storage)).toEqual(progress)
  })

  it.each<[Rating, number]>([['again', 1], ['okay', 3], ['confident', 7]])('schedules first %s review in %i calendar days', (rating, interval) => {
    const result = completeSession(attempt(), rating, now)
    const expected = new Date(now)
    expected.setDate(expected.getDate() + interval)
    expect(result.records[first.id]).toMatchObject({ attempts: 1, intervalDays: interval, rating, due: localDay(expected) })
    expect(result.session).toBeNull()
    expect(result.activity).toEqual([{ lessonId: first.id, at: now.toISOString(), mode: 'learn', rating }])
    expect(parseBackup(JSON.stringify(result))).toEqual(result)
    expect(dueLessons(result, now)).toEqual([])
    expect(dueLessons(result, expected).map(lesson => lesson.id)).toEqual([first.id])
  })

  it('grows review intervals, caps at 60, and resets difficult reviews', () => {
    let progress = completeSession(attempt(), 'confident', now)
    for (const interval of [14, 28, 56, 60, 60]) {
      progress = beginSession(progress, first.id, 'review', now)
      expect(progress.session!.phase).toBe('practice')
      expect(progress.session!.draft).toBe('')
      progress.session = { ...progress.session!, phase: 'assess', draft: 'Retrieved without the lesson' }
      progress = completeSession(progress, 'confident', now)
      expect(progress.records[first.id].intervalDays).toBe(interval)
    }
    progress = beginSession(progress, first.id, 'review', now)
    progress.session = { ...progress.session!, phase: 'assess', draft: 'Still learning' }
    progress = completeSession(progress, 'again', now)
    expect(progress.records[first.id]).toMatchObject({ attempts: 7, intervalDays: 1 })
    expect(progress.activity.at(-1)?.mode).toBe('review')
    expect(Object.keys(progress.records)).toHaveLength(1)
  })

  it('uses calendar dates across DST rather than fixed 24-hour windows', () => {
    const before = new Date(2026, 2, 7, 23, 30)
    const result = completeSession(attempt(), 'again', before)
    expect(result.records[first.id].due).toBe('2026-03-08')
  })

  it('requires an attempt at reflection, but not every checklist box', () => {
    const progress = attempt()
    progress.session!.draft = '  \n'
    expect(() => completeSession(progress, 'again', now)).toThrow('Write an answer')
    progress.session!.draft = 'I am stuck because I cannot maintain the invariant.'
    expect(() => completeSession(progress, 'again', now)).not.toThrow()
    progress.session!.phase = 'practice'
    expect(() => completeSession(progress, 'again', now)).toThrow()
  })

  it('rejects unknown lessons and reviews before completion', () => {
    expect(() => beginSession(emptyProgress(now), '__proto__', 'learn', now)).toThrow()
    expect(() => beginSession(emptyProgress(now), first.id, 'review', now)).toThrow()
  })

  it('keeps the last 5,000 activity items while retaining completion totals', () => {
    const progress = attempt()
    progress.activity = Array.from({ length: 5000 }, () => ({ lessonId: first.id, at: now.toISOString(), mode: 'learn', rating: 'again' }))
    expect(completeSession(progress, 'okay', now).activity).toHaveLength(5000)
  })

  it('exports a full history and maximum Unicode draft within the import byte limit', () => {
    const longestId = lessons.reduce((a, b) => a.id.length > b.id.length ? a : b).id
    let progress = beginSession(emptyProgress(now), longestId, 'learn', now)
    progress.session = { ...progress.session!, phase: 'assess', draft: 'An answer' }
    progress = completeSession(progress, 'confident', now)
    progress = beginSession(progress, longestId, 'review', now)
    progress.session!.draft = '🌱'.repeat(MAX_DRAFT_LENGTH / 2)
    progress.activity = Array.from({ length: 5_000 }, () => ({ lessonId: longestId, at: now.toISOString(), mode: 'review', rating: 'confident' }))
    const serialized = serializeBackup(progress)
    expect(new TextEncoder().encode(serialized).length).toBeLessThanOrEqual(MAX_BACKUP_BYTES)
    expect(parseBackup(serialized)).toEqual(progress)
  })
})

describe('untrusted JSON validation', () => {
  it.each(['', '{', 'null', '[]', 'true', '{"version":2}', '{"__proto__":{}}'])('rejects malformed input %s', text => {
    expect(() => parseBackup(text)).toThrow('Invalid backup')
  })

  it('checks byte size, including multibyte input', () => {
    expect(() => parseBackup(' '.repeat(MAX_BACKUP_BYTES + 1))).toThrow('larger than')
    expect(() => parseBackup('é'.repeat(MAX_BACKUP_BYTES / 2 + 1))).toThrow('larger than')
  })

  it.each([
    ['unknown root fields', (p: Record<string, unknown>) => { p.extra = true }],
    ['missing root fields', (p: Record<string, unknown>) => { delete p.activity }],
    ['unsupported schema', (p: Record<string, unknown>) => { p.version = 2 }],
    ['invalid timestamp', (p: Record<string, unknown>) => { p.updatedAt = '2026-02-30T12:00:00.000Z' }],
    ['unknown lesson', (p: Record<string, unknown>) => { p.records = { constructor: {} } }],
    ['array records', (p: Record<string, unknown>) => { p.records = [] }],
    ['unbounded history', (p: Record<string, unknown>) => { p.activity = new Array(5001).fill({}) }],
  ])('rejects %s', (_name, mutate) => {
    const raw: Record<string, unknown> = JSON.parse(JSON.stringify(emptyProgress(now)))
    mutate(raw)
    expect(() => parseBackup(JSON.stringify(raw))).toThrow('Invalid backup')
  })

  it.each([
    ['attempts', -1], ['attempts', 1.5], ['attempts', '2'], ['attempts', 0],
    ['due', '2026-02-30'], ['due', '2026-13-01'], ['rating', 'perfect'],
    ['intervalDays', 61], ['intervalDays', 0], ['lastCompleted', 'yesterday'],
  ])('rejects bad record %s=%s', (field, value) => {
    const raw = JSON.parse(JSON.stringify(completeSession(attempt(), 'okay', now)))
    raw.records[first.id][field] = value
    expect(() => parseBackup(JSON.stringify(raw))).toThrow('Invalid backup')
  })

  it.each([
    ['draft', 2], ['draft', 'x'.repeat(MAX_DRAFT_LENGTH + 1)], ['phase', 'done'],
    ['mode', 'test'], ['checks', [true]], ['solutionRevealed', 'yes'],
    ['hintsRevealed', 3], ['hintsRevealed', -1], ['startedAt', null], ['extra', true],
  ])('rejects bad session %s', (field, value) => {
    const raw = JSON.parse(JSON.stringify(attempt()))
    raw.session[field] = value
    expect(() => parseBackup(JSON.stringify(raw))).toThrow('Invalid backup')
  })

  it('rejects orphaned activity and review sessions', () => {
    const raw = attempt()
    raw.session!.mode = 'review'
    expect(() => parseBackup(JSON.stringify(raw))).toThrow('review has no completed')
    raw.session = null
    raw.activity = [{ lessonId: first.id, at: now.toISOString(), mode: 'learn', rating: 'again' }]
    expect(() => parseBackup(JSON.stringify(raw))).toThrow('activity has no completed')
  })

  it('rejects an imported reflection without an answer before it can reach completion', () => {
    const progress = attempt()
    progress.session!.draft = ' \n '
    expect(() => parseBackup(JSON.stringify(progress))).toThrow('reflection requires')
  })

  it('treats malicious-looking answers as plain data and never merges prototype keys', () => {
    const raw = attempt()
    raw.session!.draft = '<img src=x onerror=alert(1)>'
    expect(parseBackup(JSON.stringify(raw)).session!.draft).toBe(raw.session!.draft)
    expect(() => parseBackup(JSON.stringify(raw).replace('"records":{}', '"records":{"__proto__":{}}'))).toThrow()
    expect(Object.hasOwn(Object.prototype, 'polluted')).toBe(false)
  })
})

describe('storage failures', () => {
  it('surfaces unreadable storage', () => {
    expect(() => readProgress({ getItem: () => { throw new Error('Access denied') }, setItem: () => {} })).toThrow('Access denied')
  })

  it('does not replace invalid persisted data while loading', () => {
    const storage = new MemoryStorage()
    storage.data = '{broken'
    expect(() => readProgress(storage)).toThrow()
    expect(storage.data).toBe('{broken')
  })

  it('leaves the previous saved value intact on quota failure', () => {
    const storage = new MemoryStorage()
    writeProgress(storage, emptyProgress(now))
    const before = storage.data
    storage.setItem = () => { throw new Error('QuotaExceededError') }
    expect(() => writeProgress(storage, attempt())).toThrow('QuotaExceededError')
    expect(storage.data).toBe(before)
  })

  it('validates before any storage write', () => {
    const storage = new MemoryStorage()
    const raw = attempt()
    raw.session!.hintsRevealed = 100
    expect(() => writeProgress(storage, raw)).toThrow()
    expect(storage.data).toBeNull()
  })
})
