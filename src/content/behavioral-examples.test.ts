import { describe, expect, it } from 'vitest'
import { behavioralLessons } from './behavioral'
import { starterLessons } from './starter'

describe('behavioral worked examples', () => {
  it('retains the complete saved-draft exercise contracts without mutating the originals', () => {
    for (const original of starterLessons.filter((lesson) => lesson.track === 'behavioral')) {
      const expanded = behavioralLessons.find((lesson) => lesson.id === original.id)!
      expect(expanded).not.toBe(original)
      for (const field of ['task', 'hints', 'checklist', 'starter', 'solution', 'example'] as const) {
        expect(expanded[field]).toEqual(original[field])
      }
      expect(expanded.concepts).not.toBe(original.concepts)
      expect(expanded.concepts.slice(0, original.concepts.length)).toEqual(original.concepts)
    }
    expect(starterLessons.find((lesson) => lesson.id === 'behavioral-star-evidence')?.minutes).toBe(20)
    expect(starterLessons.find((lesson) => lesson.id === 'behavioral-tradeoffs-conflict')?.minutes).toBe(25)
  })

  it('provides a contiguous thirty-minute budget with protected validation and wrap-up', () => {
    const communication = behavioralLessons.find((lesson) => lesson.id === 'behavioral-technical-communication')!
    const budget = communication.walkthrough.find((section) => section.code)?.code ?? ''
    const intervals = budget.split('\n').map((line) => {
      const match = /^(\d+)–(\d+): .+ \((\d+) minutes\)$/.exec(line)
      expect(match, `Unparseable budget interval: ${line}`).not.toBeNull()
      return { start: Number(match![1]), end: Number(match![2]), duration: Number(match![3]) }
    })
    expect(intervals).toHaveLength(5)
    expect(intervals[0].start).toBe(0)
    for (let index = 0; index < intervals.length; index += 1) {
      const interval = intervals[index]
      expect(interval.end - interval.start).toBe(interval.duration)
      if (index > 0) expect(interval.start).toBe(intervals[index - 1].end)
    }
    expect(intervals.reduce((sum, interval) => sum + interval.duration, 0)).toBe(30)
    expect(intervals[3]).toEqual({ start: 22, end: 28, duration: 6 })
    expect(intervals[4]).toEqual({ start: 28, end: 30, duration: 2 })
    const stretch = communication.extraPractice.find((practice) => practice.id === 'stretch')!
    expect(stretch.solution).toContain('next six minutes')
    expect(stretch.solution).toContain('two minutes to summarize')
    expect(stretch.solution).toContain('what has not executed')
  })

  it('bounds the deep-dive reliability claim to the evidence actually described', () => {
    const project = behavioralLessons.find((lesson) => lesson.id === 'behavioral-project-deep-dive')!
    expect(project.solution).toContain('previous list remained available')
    expect(project.solution).toContain('not crash-safe storage or concurrent updates')
    expect(project.solution).toContain('did not test large files')
    expect(project.extraPractice.find((practice) => practice.id === 'warmup')?.solution)
      .toContain('does not imply durable transactional storage')
  })
})
