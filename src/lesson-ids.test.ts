import { describe, expect, it } from 'vitest'
import { lessons } from './curriculum'
import knownIds from '../tests/fixtures/lesson-ids.json'
import v1 from '../tests/fixtures/v1-progress.json'
import { parseBackup } from './progress'

// Lesson IDs are part of the backup format. This registry is append-only:
// removing or renaming an ID requires an explicit migration in progress.ts.
describe('lesson id registry', () => {
  const current = new Set(lessons.map(lesson => lesson.id))

  it('keeps every lesson id that has ever shipped', () => {
    expect(knownIds.filter(id => !current.has(id))).toEqual([])
  })

  it('records every current lesson id in the registry', () => {
    expect([...current].filter(id => !knownIds.includes(id))).toEqual([])
  })

  it('still loads the v1 progress fixture against the data-driven curriculum', () => {
    const parsed = parseBackup(JSON.stringify(v1))
    expect(Object.keys(parsed.records).every(id => current.has(id))).toBe(true)
  })
})
