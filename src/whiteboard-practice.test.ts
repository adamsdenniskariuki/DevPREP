import { describe, expect, it } from 'vitest'
import { attemptText, CHECKLIST, clock, duration, finish, MAX_SPENT_MS, newPractice, parsePractice, pause, remaining, resume, spent, tick, ticked } from './practice'

const t0 = Date.UTC(2026, 9, 1, 10)
const min = 60_000

describe('whiteboard practice timer', () => {
  it('starts running with an empty checklist', () => {
    const state = newPractice(35, t0)
    expect(state).toEqual({ minutes: 35, spentMs: 0, runningSince: t0, checks: CHECKLIST.map(() => false) })
    expect(CHECKLIST).toEqual(['Requirements', 'Estimates', 'API', 'Data model', 'High-level design', 'Deep dive and bottlenecks', 'Trade-offs'])
    expect(remaining(state, t0)).toBe(35 * min)
    expect(remaining(state, t0 + 10 * min)).toBe(25 * min)
  })

  it('keeps time across pause and resume, and counts overtime', () => {
    let state = newPractice(45, t0)
    state = pause(state, t0 + 10 * min)
    expect(state.runningSince).toBeUndefined()
    expect(spent(state, t0 + 99 * min)).toBe(10 * min)
    expect(pause(state, t0 + 20 * min)).toBe(state)
    state = resume(state, t0 + 30 * min)
    expect(resume(state, t0 + 31 * min)).toBe(state)
    expect(spent(state, t0 + 70 * min)).toBe(50 * min)
    expect(remaining(state, t0 + 70 * min)).toBe(-5 * min)
  })

  it('stops the clock on finish and cannot resume', () => {
    const done = finish(newPractice(35, t0), t0 + 31 * min + 20_000)
    expect(done).toMatchObject({ spentMs: 31 * min + 20_000, finishedAt: new Date(t0 + 31 * min + 20_000).toISOString() })
    expect(done.runningSince).toBeUndefined()
    expect(finish(done, t0 + 99 * min)).toBe(done)
    expect(resume(done, t0 + 99 * min)).toBe(done)
    expect(spent(done, t0 + 99 * min)).toBe(31 * min + 20_000)
  })

  it('ignores clocks that jump backwards and caps runaway time', () => {
    expect(spent(newPractice(35, t0), t0 - min)).toBe(0)
    expect(spent(newPractice(35, t0), t0 + 30 * 60 * min)).toBe(MAX_SPENT_MS)
  })

  it('ticks checklist items', () => {
    let state = newPractice(35, t0)
    state = tick(tick(state, 0, true), 6, true)
    expect(ticked(state)).toBe(2)
    expect(tick(state, 0, false).checks[0]).toBe(false)
    expect(tick(state, 7, true)).toBe(state)
    expect(tick(state, -1, true)).toBe(state)
  })

  it('formats the clock and durations', () => {
    expect(clock(35 * min)).toBe('35:00')
    expect(clock(4 * min + 59_001)).toBe('5:00')
    expect(clock(0)).toBe('0:00')
    expect(clock(-61_000)).toBe('+1:01')
    expect(duration(31 * min + 20_000)).toBe('31 min 20 s')
    expect(duration(2 * min)).toBe('2 min')
    expect(duration(9_000)).toBe('9 s')
    expect(duration(-5)).toBe('0 s')
    expect(attemptText(newPractice(45, t0))).toBe('In progress · 45 min')
    expect(attemptText(tick(finish(newPractice(35, t0), t0 + 31 * min + 20_000), 2, true))).toBe('31 min 20 s of 35 min · 1 of 7 ticked')
  })
})

describe('whiteboard practice in backups', () => {
  const done = tick(finish(newPractice(35, t0), t0 + 20 * min), 1, true)

  it('accepts running and finished attempts', () => {
    expect(parsePractice(JSON.parse(JSON.stringify(done)))).toEqual(done)
    const running = newPractice(45, t0)
    expect(parsePractice(running)).toEqual(running)
    expect(parsePractice(running)).not.toBe(running)
  })

  it('rejects malformed attempts', () => {
    expect(() => parsePractice(null)).toThrow('unexpected or missing fields')
    expect(() => parsePractice([])).toThrow('unexpected or missing fields')
    expect(() => parsePractice({ ...done, extra: 1 })).toThrow('unexpected or missing fields')
    expect(() => parsePractice({ minutes: 35, spentMs: 0 })).toThrow('unexpected or missing fields')
    expect(() => parsePractice({ ...done, minutes: 30 })).toThrow('unknown time limit')
    expect(() => parsePractice({ ...done, spentMs: -1 })).toThrow('invalid time taken')
    expect(() => parsePractice({ ...done, spentMs: 1.5 })).toThrow('invalid time taken')
    expect(() => parsePractice({ ...done, spentMs: MAX_SPENT_MS + 1 })).toThrow('invalid time taken')
    expect(() => parsePractice({ ...done, checks: [true] })).toThrow('invalid checklist')
    expect(() => parsePractice({ ...done, checks: CHECKLIST.map(() => 1) })).toThrow('invalid checklist')
    expect(() => parsePractice({ ...done, finishedAt: 'yesterday' })).toThrow('invalid finish time')
    expect(() => parsePractice({ ...done, finishedAt: '2026-02-30T10:00:00.000Z' })).toThrow('invalid finish time')
    expect(() => parsePractice({ ...done, runningSince: t0 })).toThrow('cannot still be running')
    expect(() => parsePractice({ ...newPractice(35, t0), runningSince: 'now' })).toThrow('invalid start time')
    expect(() => parsePractice({ ...newPractice(35, t0), runningSince: 0 })).toThrow('invalid start time')
  })
})
