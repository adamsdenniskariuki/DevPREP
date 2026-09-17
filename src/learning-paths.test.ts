import { describe, expect, it } from 'vitest'
import { lessons } from './curriculum'
import { getLearningPath, isPathId, learningPaths, nextLessonFor, pathLessonIds, pathProgress, selectPath } from './learning-paths'
import { beginSession, completeSession, dueLessons, emptyProgress, parseBackup, serializeBackup } from './progress'
import legacyBackup from '../tests/fixtures/v1-progress.json' with { type: 'json' }

const now = new Date('2026-09-17T12:00:00.000Z')
const swe = getLearningPath('swe')!
const senior = getLearningPath('senior')!

function completeIds(ids: string[]) {
  let progress = emptyProgress(now)
  for (const id of ids) {
    progress = beginSession(progress, id, 'learn', now)
    progress.session = { ...progress.session!, phase: 'assess', draft: 'Reasoned through the core task.' }
    progress = completeSession(progress, 'again', now)
  }
  return progress
}

describe('curated learning paths', () => {
  it('has two distinct, bounded paths over the existing curriculum', () => {
    expect(learningPaths.map(path => path.id)).toEqual(['swe', 'senior'])
    expect(pathLessonIds(swe)).toHaveLength(29)
    expect(pathLessonIds(senior)).toHaveLength(30)
    expect(pathLessonIds(swe)).not.toEqual(pathLessonIds(senior))
    expect(lessons).toHaveLength(46)
    const counts = (path: typeof swe, track: string) => pathLessonIds(path).filter(id => lessons.find(lesson => lesson.id === id)?.track === track).length
    expect(counts(swe, 'dsa')).toBe(17)
    expect(counts(senior, 'dsa')).toBe(12)
    expect(counts(swe, 'system-design')).toBe(4)
    expect(counts(senior, 'system-design')).toBe(10)
    expect(counts(swe, 'behavioral')).toBe(8)
    expect(counts(senior, 'behavioral')).toBe(8)
    expect(counts(swe, 'ml')).toBe(0)
    expect(counts(senior, 'ml')).toBe(0)
  })

  it.each(learningPaths)('$title includes each prerequisite earlier, without duplicated or unknown lessons', path => {
    const ids = pathLessonIds(path)
    expect(new Set(ids).size).toBe(ids.length)
    expect(path.phases.every(phase => phase.lessonIds.length > 0 && phase.objective.trim())).toBe(true)
    expect(path.outcomes.length).toBeGreaterThanOrEqual(3)
    for (const [index, id] of ids.entries()) {
      const lesson = lessons.find(item => item.id === id)
      expect(lesson, `unknown path lesson ${id}`).toBeDefined()
      for (const prerequisite of lesson!.prerequisites) {
        expect(ids.slice(0, index), `${id} requires ${prerequisite} earlier`).toContain(prerequisite)
      }
    }
  })

  it('adds bounded senior extensions without altering core completion contracts', () => {
    expect(swe.prompts).toEqual([])
    expect(senior.prompts).toHaveLength(3)
    expect(new Set(senior.prompts.map(prompt => prompt.lessonId)).size).toBe(3)
    for (const prompt of senior.prompts) {
      expect(pathLessonIds(senior)).toContain(prompt.lessonId)
      expect(prompt.rubric.length).toBeGreaterThanOrEqual(4)
      expect(prompt.prompt.length).toBeGreaterThan(200)
      expect(prompt.discussion.length).toBeGreaterThan(200)
    }
    expect(senior.prompts[2].prompt).toContain('real example')
    expect(senior.prompts[2].prompt).toContain('hypothetical')
  })
})

describe('selection and recommendation semantics', () => {
  it('does not assign a path or change legacy ordering', () => {
    const original = parseBackup(JSON.stringify(legacyBackup))
    expect(original).toEqual(legacyBackup)
    expect(original.selectedPath).toBeUndefined()
    expect(getLearningPath(undefined)).toBeUndefined()
    expect(nextLessonFor(original)).toBe(lessons.find(lesson => !Object.hasOwn(original.records, lesson.id)))
    expect(emptyProgress(now)).not.toHaveProperty('selectedPath')
  })

  it('starts SWE at arrays and Senior at framing requirements', () => {
    expect(nextLessonFor(selectPath(emptyProgress(now), 'swe'))?.id).toBe('arrays-prefix-foundations')
    expect(nextLessonFor(selectPath(emptyProgress(now), 'senior'))?.id).toBe('design-requirements-capacity')
  })

  it('chooses the first unfinished path lesson and never falls through to supplemental content', () => {
    const firstThree = pathLessonIds(senior).slice(0, 3)
    const partial = selectPath(completeIds(firstThree), 'senior')
    expect(nextLessonFor(partial)?.id).toBe(pathLessonIds(senior)[3])
    const complete = selectPath(completeIds(pathLessonIds(senior)), 'senior')
    expect(nextLessonFor(complete)).toBeUndefined()
    expect(Object.keys(complete.records)).toHaveLength(30)
    expect(nextLessonFor(selectPath(complete, undefined))).toBeDefined()
  })

  it('preserves every unfinished-session field, record, and review while switching', () => {
    const original = parseBackup(JSON.stringify(legacyBackup))
    original.session!.readingSection = 'walkthrough-1'
    for (const id of ['swe', 'senior', undefined] as const) {
      const selected = selectPath(original, id)
      expect(selected.records).toBe(original.records)
      expect(selected.session).toBe(original.session)
      expect(selected.activity).toBe(original.activity)
      expect(selected.updatedAt).toBe(original.updatedAt)
      expect(selected.selectedPath).toBe(id)
      expect(dueLessons(selected, new Date('2026-09-25T12:00:00.000Z'))).toEqual(dueLessons(original, new Date('2026-09-25T12:00:00.000Z')))
    }
    expect(original.selectedPath).toBeUndefined()
  })

  it('keeps due supplemental ML reviews through path switches and reschedules them normally', () => {
    const original = completeIds(['ml-data-preparation', 'design-requirements-capacity'])
    const dueDate = new Date('2026-09-18T12:00:00.000Z')
    for (const id of ['swe', 'senior', undefined] as const) {
      const selected = selectPath(original, id)
      expect(dueLessons(selected, dueDate).map(lesson => lesson.id)).toEqual(['design-requirements-capacity', 'ml-data-preparation'])
      let reviewed = beginSession(selected, 'ml-data-preparation', 'review', dueDate)
      reviewed.session = { ...reviewed.session!, draft: 'Retrieved the data-availability distinction.', phase: 'assess' }
      reviewed = completeSession(reviewed, 'confident', dueDate)
      expect(reviewed.selectedPath).toBe(id)
      expect(reviewed.records['ml-data-preparation'].attempts).toBe(2)
      expect(dueLessons(reviewed, dueDate).map(lesson => lesson.id)).toEqual(['design-requirements-capacity'])
    }
  })

  it('counts shared completion once in each path and keeps denominators distinct from overall', () => {
    const shared = completeIds(['arrays-prefix-foundations', 'ml-data-preparation'])
    expect(pathProgress(swe, shared)).toMatchObject({ completed: 1, total: 29 })
    expect(pathProgress(senior, shared)).toMatchObject({ completed: 1, total: 30 })
    expect(Object.keys(shared.records)).toHaveLength(2)
    const finishedSwe = selectPath(completeIds(pathLessonIds(swe)), 'senior')
    expect(pathProgress(swe, finishedSwe)).toMatchObject({ completed: 29, total: 29, percent: 100 })
    expect(pathProgress(senior, finishedSwe)).toMatchObject({ completed: 24, total: 30, percent: 80 })
    expect(nextLessonFor(finishedSwe)?.id).toBe('design-replication-partitioning')
  })
})

describe('additive v1 path persistence', () => {
  it.each(['swe', 'senior'] as const)('round-trips %s alongside legacy drafts and bookmarks', id => {
    const original = parseBackup(JSON.stringify(legacyBackup))
    original.session!.readingSection = 'concept-0'
    const selected = selectPath(original, id)
    expect(parseBackup(serializeBackup(selected))).toEqual(selected)
    expect(parseBackup(serializeBackup(selected)).session).toEqual(original.session)
  })

  it.each(['principal', 'SWE', 'none', '', null, 0, false, {}, [], ['swe']])('rejects unknown path %j before replacing progress', selectedPath => {
    expect(isPathId(selectedPath)).toBe(false)
    expect(() => parseBackup(JSON.stringify({ ...legacyBackup, selectedPath }))).toThrow('unknown learning path')
  })

  it('clearing a selected path removes the optional field rather than adding a new sentinel', () => {
    const original = parseBackup(JSON.stringify(legacyBackup))
    const restored = selectPath(selectPath(original, 'senior'), undefined)
    expect(restored).not.toHaveProperty('selectedPath')
    expect(parseBackup(serializeBackup(restored))).toEqual(legacyBackup)
  })
})
