import { describe, expect, it } from 'vitest'
import type { Lesson, LessonCore } from '../curriculum-types'
import { starterLessons } from './starter'
import { systemDesignLessons } from './system-design'

function lesson(id: string): Lesson {
  const found = systemDesignLessons.find(candidate => candidate.id === id)
  if (!found) throw new Error(`Missing lesson: ${id}`)
  return found
}

function numbers(text: string, pattern: RegExp): number[] {
  const match = text.match(pattern)
  if (!match) throw new Error(`Numeric curriculum statement no longer matches ${pattern}`)
  return match.slice(1).map(Number)
}

function coreWords(value: LessonCore): string[] {
  return [
    value.summary, ...value.objectives,
    ...value.concepts.flatMap(section => [section.title, section.body]),
    value.example, value.task, ...value.hints, value.solution, ...value.checklist, ...value.pitfalls,
  ]
}

function expandedWords(value: Lesson): string[] {
  return [
    ...coreWords(value), value.prerequisiteNotes,
    ...value.walkthrough.flatMap(section => [section.title, section.body]),
    ...value.extraPractice.flatMap(practice => [
      practice.title, practice.prompt, ...practice.hints, practice.solution, ...practice.checklist,
    ]),
    ...value.followUps.flatMap(followUp => [followUp.question, followUp.answer]),
    ...value.takeaways,
  ]
}

function wordCount(text: string[]): number {
  return text.join(' ').trim().split(/\s+/).length
}

describe('system-design curriculum contracts', () => {
  it('orders ten lessons with earlier same-track prerequisites', () => {
    expect(systemDesignLessons.map(value => value.id)).toEqual([
      'design-requirements-capacity',
      'design-api-data-model',
      'design-databases-indexes',
      'design-cache-data-flow',
      'design-replication-partitioning',
      'design-consistency',
      'design-queues-events',
      'design-rate-limiting',
      'design-reliability-observability',
      'design-end-to-end-bookmarks',
    ])
    const earlier = new Set<string>()
    for (const value of systemDesignLessons) {
      expect(value.track).toBe('system-design')
      expect(earlier.has(value.id)).toBe(false)
      expect(new Set(value.prerequisites).size).toBe(value.prerequisites.length)
      for (const prerequisite of value.prerequisites) expect(earlier.has(prerequisite)).toBe(true)
      earlier.add(value.id)
    }
  })

  it('preserves both published exercises exactly, while enriching without modifying starters', () => {
    const originals = starterLessons.filter(value => value.track === 'system-design')
    expect(originals).toHaveLength(2)
    for (const original of originals) {
      const enriched = lesson(original.id)
      expect(enriched).not.toBe(original)
      for (const key of ['id', 'task', 'hints', 'checklist', 'starter', 'solution', 'example'] as const) {
        expect(enriched[key]).toEqual(original[key])
      }
      expect(original.minutes).toBe(25)
      expect(original.concepts).toHaveLength(3)
      expect(enriched.concepts).not.toBe(original.concepts)
      expect(enriched.concepts.slice(0, original.concepts.length)).toEqual(original.concepts)
      expect(enriched.concepts.length).toBeGreaterThanOrEqual(original.concepts.length + 2)
      expect(wordCount(expandedWords(enriched)) - wordCount(coreWords(original))).toBeGreaterThanOrEqual(400)
    }
  })

  it('provides substantial teaching and rubric-based warmup, core, and stretch practice', () => {
    const originalIds = new Set(starterLessons.filter(value => value.track === 'system-design').map(value => value.id))
    for (const value of systemDesignLessons) {
      expect(value.minutes).toBeGreaterThanOrEqual(30)
      expect(value.minutes).toBeLessThanOrEqual(55)
      expect(value.prerequisiteNotes.length).toBeGreaterThan(40)
      expect(value.objectives.length).toBeGreaterThanOrEqual(3)
      expect(value.concepts.length).toBeGreaterThanOrEqual(3)
      expect(value.hints).toHaveLength(2)
      expect(value.checklist.length).toBeGreaterThanOrEqual(3)
      expect(value.pitfalls.length).toBeGreaterThanOrEqual(3)
      expect(value.walkthrough.length).toBeGreaterThanOrEqual(2)
      for (const section of [...value.concepts, ...value.walkthrough]) {
        expect(section.title.length).toBeGreaterThan(0)
        expect(section.body.length).toBeGreaterThan(100)
      }
      expect(value.extraPractice.map(practice => practice.id)).toEqual(['warmup', 'stretch'])
      for (const practice of value.extraPractice) {
        expect(practice.title.length).toBeGreaterThan(0)
        expect(practice.prompt.length).toBeGreaterThan(50)
        expect(practice.hints).toHaveLength(2)
        expect(practice.hints.every(hint => hint.length > 15)).toBe(true)
        expect(practice.solution.length).toBeGreaterThan(100)
        expect(practice.checklist.length).toBeGreaterThanOrEqual(3)
      }
      expect(value.followUps.length).toBeGreaterThanOrEqual(2)
      expect(value.followUps.every(item => item.question.length > 15 && item.answer.length > 50)).toBe(true)
      expect(value.takeaways.length).toBeGreaterThanOrEqual(3)
      if (!originalIds.has(value.id)) {
        const count = wordCount(expandedWords(value))
        expect.soft(count, `${value.id} instructional word count`).toBeGreaterThanOrEqual(700)
        expect.soft(count, `${value.id} instructional word count`).toBeLessThanOrEqual(1100)
      }
    }
  })
})

describe('numeric statements in the worked system-design examples', () => {
  it('derives the preserved bookmark capacity and storage answer from the actual task assumptions', () => {
    const value = lesson('design-requirements-capacity')
    const [users, lists, creates, peak, bytes, days] = numbers(
      value.task,
      /Assume (\d+) daily active users, (\d+) list requests and (\d+) new bookmarks per user per day, a (\d+)-times peak multiplier for both operations, (\d+) bytes per stored bookmark, (\d+)-day retention/,
    )
    const [readDaily, readAverage, readPeak] = numbers(value.solution, /Reads: .* = (\d+) per day, about ([\d.]+) per second average and ([\d.]+) per second peak/)
    const [writeDaily, writeAverage, writePeak] = numbers(value.solution, /Writes: .* = (\d+) per day, about ([\d.]+) per second average and ([\d.]+) per second peak/)
    const [rawBytes, rawGB, replicatedGB] = numbers(value.solution, /Raw storage: .* = (\d+) bytes, or (\d+) GB\. Three full copies require (\d+) GB/)
    expect(readDaily).toBe(users * lists)
    expect(writeDaily).toBe(users * creates)
    expect(Math.abs(readAverage - readDaily / 86400)).toBeLessThan(0.05)
    expect(Math.abs(readPeak - readDaily / 86400 * peak)).toBeLessThan(0.5)
    expect(Math.abs(writeAverage - writeDaily / 86400)).toBeLessThan(0.005)
    expect(Math.abs(writePeak - writeDaily / 86400 * peak)).toBeLessThan(0.05)
    expect(rawBytes).toBe(writeDaily * bytes * days)
    expect(rawGB).toBe(rawBytes / 1e9)
    expect(replicatedGB).toBe(rawGB * 3)
  })

  it('keeps the worked index size and synthesis storage consistent', () => {
    const text = lesson('design-databases-indexes').example
    const [daily, days, rows] = numbers(text, /(\d+) bookmarks\/day × (\d+) days = (\d+) retained rows/)
    const [entryBytes, multipliedRows, repeatedEntryBytes, indexBytes, indexGB] = numbers(text, /costs (\d+) bytes\/row: (\d+) × (\d+) = (\d+) bytes = ([\d.]+) decimal GB/)
    const [rawGB, addedIndexGB, copyGB] = numbers(text, /Raw records plus this index: ([\d.]+) \+ ([\d.]+) = ([\d.]+) GB/)
    const [repeatedCopyGB, copies, fleetGB] = numbers(text, /Three full copies: ([\d.]+) × (\d+) = ([\d.]+) GB/)
    expect(rows).toBe(daily * days)
    expect(multipliedRows).toBe(rows)
    expect(repeatedEntryBytes).toBe(entryBytes)
    expect(indexBytes).toBe(rows * entryBytes)
    expect(indexGB).toBe(indexBytes / 1e9)
    expect(addedIndexGB).toBe(indexGB)
    expect(copyGB).toBeCloseTo(rawGB + indexGB, 6)
    expect(repeatedCopyGB).toBe(copyGB)
    expect(fleetGB).toBeCloseTo(copyGB * copies, 6)
    const [synthesisBytes, synthesisIndexBytes, synthesisGB] = numbers(
      lesson('design-end-to-end-bookmarks').example,
      /At (\d+) bytes\/record plus one assumed (\d+)-byte index entry, three full copies require ([\d.]+) decimal GB/,
    )
    expect(synthesisIndexBytes).toBe(entryBytes)
    expect(rawGB).toBe(rows * synthesisBytes / 1e9)
    expect(synthesisGB).toBeCloseTo(rows * (synthesisBytes + synthesisIndexBytes) * copies / 1e9, 6)
  })

  it('connects retry-record retention to its storage statement', () => {
    const [daily, hours, bytes, rawBytes, gb] = numbers(
      lesson('design-api-data-model').example,
      /At (\d+) creates per day, (\d+)-hour retry retention, and (\d+) bytes per retry record, raw retry storage is (\d+) bytes = ([\d.]+) decimal GB/,
    )
    expect(rawBytes).toBe(daily * hours / 24 * bytes)
    expect(gb).toBe(rawBytes / 1e9)
  })

  it('distinguishes normal cache misses from outage overload', () => {
    const value = lesson('design-cache-data-flow')
    const [reads, hitPercent, sourceCapacity] = numbers(value.task, /traffic is (\d+) reads per second, expected hit rate is (\d+)%, and the database has been load-tested for at most (\d+) reads per second/)
    const [normalReads] = numbers(value.solution, /Normal database reads are .* = (\d+) per second/)
    const [outageReads, overloadFactor, repeatedCapacity, normalMultiplier] = numbers(value.solution, /outage sends (\d+) per second, about ([\d.]+) times the tested (\d+)-per-second capacity, and (\d+) times normal/)
    expect(normalReads).toBeCloseTo(reads * (1 - hitPercent / 100), 6)
    expect(outageReads).toBe(reads)
    expect(repeatedCapacity).toBe(sourceCapacity)
    expect(Math.abs(overloadFactor - reads / sourceCapacity)).toBeLessThan(0.005)
    expect(normalMultiplier).toBe(reads / normalReads)
  })

  it('calculates queue growth and drain using spare capacity', () => {
    const text = lesson('design-queues-events').example
    const [burstSeconds, arrivals, capacity] = numbers(text, /a (\d+)-second burst, arrivals are (\d+) jobs\/s and successful worker capacity is (\d+) jobs\/s/)
    const [growthArrivals, growthCapacity, growthSeconds, backlog] = numbers(text, /backlog growth is \((\d+) - (\d+)\) × (\d+) = (\d+) jobs/)
    const [afterArrivals, afterCapacity] = numbers(text, /arrivals drop to (\d+) jobs\/s while capacity remains (\d+) jobs\/s/)
    const [drainRate, repeatedBacklog, drainSeconds] = numbers(text, /Net drain is (\d+) jobs\/s, so the (\d+)-job backlog drains in (\d+) seconds/)
    expect([growthArrivals, growthCapacity, growthSeconds]).toEqual([arrivals, capacity, burstSeconds])
    expect(backlog).toBe((arrivals - capacity) * burstSeconds)
    expect(afterCapacity).toBe(capacity)
    expect(drainRate).toBe(afterCapacity - afterArrivals)
    expect(repeatedBacklog).toBe(backlog)
    expect(drainSeconds).toBe(backlog / drainRate)
  })

  it('simulates both token-bucket bursts from the curriculum numbers', () => {
    const text = lesson('design-rate-limiting').example
    const [capacity, refillRate] = numbers(text, /capacity (\d+) tokens and refill rate (\d+) tokens\/s/)
    const [firstTime, firstRequested, firstAdmitted, firstRejected] = numbers(text, /At t = (\d+), (\d+) simultaneous one-token requests admit (\d+) and reject (\d+)/)
    const [secondTime, statedRefill] = numbers(text, /At t = (\d+) seconds, with no intervening requests, (\d+) tokens have refilled/)
    const [secondRequested, secondAdmitted, secondRejected] = numbers(text, /A batch of (\d+) then admits (\d+) and rejects (\d+)/)
    let tokens = capacity
    const admitted = Math.min(tokens, firstRequested)
    expect(firstAdmitted).toBe(admitted)
    expect(firstRejected).toBe(firstRequested - admitted)
    tokens = Math.min(capacity, tokens - admitted + (secondTime - firstTime) * refillRate)
    expect(statedRefill).toBe(tokens)
    const second = Math.min(tokens, secondRequested)
    expect(secondAdmitted).toBe(second)
    expect(secondRejected).toBe(secondRequested - second)
    const [nextTokenSeconds, retryAfterSeconds] = numbers(text, /one token requires ([\d.]+) seconds to refill.*round up to (\d+) second/)
    expect(nextTokenSeconds).toBe(1 / refillRate)
    expect(retryAfterSeconds).toBe(Math.ceil(nextTokenSeconds))
  })

  it('keeps request availability, time availability, and deadline budgets distinct', () => {
    const text = lesson('design-reliability-observability').example
    const [eligible, successPercent, allowedFailures] = numbers(text, /For (\d+) eligible requests.*and a ([\d.]+)% success objective, the budget is (\d+) unsuccessful requests/)
    const [failures, remaining] = numbers(text, /If (\d+) eligible requests have failed, (\d+) failures remain/)
    expect(allowedFailures).toBeCloseTo(eligible * (1 - successPercent / 100), 6)
    expect(remaining).toBe(allowedFailures - failures)
    const [timeSuccessPercent, days, minutes] = numbers(text, /time-based ([\d.]+)% objective over (\d+) days permits ([\d.]+) minutes/)
    expect(minutes).toBeCloseTo(days * 24 * 60 * (1 - timeSuccessPercent / 100), 6)
    const [budget, auth, cache, source, response, margin] = numbers(
      text,
      /Illustrative (\d+) ms service budget: authentication (\d+) ms \+ cache (\d+) ms \+ source (\d+) ms \+ response (\d+) ms \+ margin (\d+) ms/,
    )
    expect(auth + cache + source + response + margin).toBe(budget)
    expect(auth + cache + source * 2 + response).toBeGreaterThan(budget)
  })
})
