import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { lessons, tracks } from './curriculum'
import { lessonSections } from './lesson-sections'
import { beginSession, completeSession, dueLessons, emptyProgress, parseBackup, readProgress, serializeBackup, STORAGE_KEY } from './progress'
import legacyBackup from '../tests/fixtures/v1-progress.json' with { type: 'json' }

// SHA-256 of [task, hints, checklist, starter ?? null, example, solution] from published MVP commit 05ed8dd.
const publishedContracts: Record<string, string> = {
  'hash-map-complements': '1a90fa35f4c74b8556f96c85661d15f7161cd40ae02003b0b9eb0cf4bf10ff4b',
  'two-pointers-sorted-pairs': 'dfd00e206a930d443d73c307327e31608b6363bf9b34001e22f77d6fc5f360c2',
  'sliding-window-distinct': 'd636f16749f8b8c08c0a773e124463cd439291f918ad014ee6e2e9e17e72e32c',
  'binary-search-lower-bound': '49007099af8c86b63241ad6f77c250d3018790824bdfd850e37e37e42a2e5f5d',
  'stack-balanced-delimiters': '1017b87eec4449d7f4bb84eeb1fede0289a71756ceabc151336e75d5ea688556',
  'graph-bfs-shortest-hops': 'c8e2a28e5c6c328f50410e841b2c470a8e4261396054c592f4bff04e597c2a7a',
  'design-requirements-capacity': 'c880edda5d74a31991987868f32c127a75d96831a36e7df69d7c548e7ed59246',
  'design-cache-data-flow': '70ab2680050f969d285338529ae0b223103b431786e5babf5d79fa9fbff7b76e',
  'ml-evaluation-leakage': 'a5d4643d8ff946692f0204d5f9a2630ba6e26f1d78b1006cdbdae89e199b2479',
  'ml-bias-variance': '04e253ae058b322f7f6c81ec45ce7489ef03bfd13a28f96e2862d6e161e67a63',
  'behavioral-star-evidence': '130f7faf905f3232bd4e5f3fc84b06242c00caa0d48fc751dc1321d2ae9ea1d4',
  'behavioral-tradeoffs-conflict': '99df433b844fb91c0a7e14b995db1834880bf1204f0a6c90820dd106aa7777e2',
}

describe('content graph and learning surfaces', () => {
  it.each(tracks)('$title expands both depth and topic coverage', track => {
    const trackLessons = lessons.filter(lesson => lesson.track === track.id)
    expect(trackLessons.length).toBeGreaterThanOrEqual(track.id === 'dsa' ? 18 : 8)
    expect(trackLessons[0].prerequisites).toEqual([])
    for (const lesson of trackLessons) {
      const previous = trackLessons.slice(0, trackLessons.indexOf(lesson)).map(item => item.id)
      expect(new Set(lesson.prerequisites).size).toBe(lesson.prerequisites.length)
      expect(lesson.prerequisites.every(id => previous.includes(id)), `${lesson.id}: prerequisites must precede the lesson`).toBe(true)
      expect(lesson.prerequisiteNotes.length).toBeGreaterThan(30)
      expect(lesson.walkthrough.length).toBeGreaterThanOrEqual(2)
      for (const section of lesson.walkthrough) {
        expect(section.title.trim().length).toBeGreaterThan(5)
        expect(section.body.trim().length).toBeGreaterThan(80)
      }
      expect(lesson.extraPractice.map(exercise => exercise.id)).toEqual(['warmup', 'stretch'])
      for (const exercise of lesson.extraPractice) {
        expect(exercise.prompt.trim()).not.toBe('')
        expect(exercise.solution.trim()).not.toBe('')
        expect(exercise.hints).toHaveLength(2)
        expect(exercise.hints.every(hint => hint.trim().length > 0)).toBe(true)
        expect(exercise.checklist.length).toBeGreaterThanOrEqual(2)
        expect(exercise.prompt).not.toBe(lesson.task)
      }
      expect(lesson.followUps.length).toBeGreaterThanOrEqual(2)
      expect(lesson.followUps.every(item => item.question.length > 15 && item.answer.length > 70)).toBe(true)
      expect(lesson.takeaways.length).toBeGreaterThanOrEqual(3)
      const sections = lessonSections(lesson)
      expect(new Set(sections.map(section => section.id)).size).toBe(sections.length)
      expect(sections.filter(section => section.kind === 'concept')).toHaveLength(lesson.concepts.length)
      expect(sections.filter(section => section.kind === 'walkthrough')).toHaveLength(lesson.walkthrough.length)
      expect(sections.at(-1)?.kind).toBe('takeaways')
    }
  })

  it.each(Object.entries(publishedContracts))('keeps the published %s core session contract unchanged', (id, fingerprint) => {
    const lesson = lessons.find(item => item.id === id)!
    expect(lesson).toBeDefined()
    const contract = JSON.stringify([lesson.task, lesson.hints, lesson.checklist, lesson.starter ?? null, lesson.example, lesson.solution])
    expect(createHash('sha256').update(contract).digest('hex')).toBe(fingerprint)
    expect(lesson.concepts.length).toBeGreaterThanOrEqual(5)
  })

  it('all lessons can start, complete, serialize, and schedule reviews', () => {
    let progress = emptyProgress(new Date('2026-09-17T12:00:00.000Z'))
    for (const lesson of lessons) {
      progress = beginSession(progress, lesson.id, 'learn')
      progress.session = { ...progress.session!, draft: `An explanation for ${lesson.id}`, phase: 'assess' }
      progress = completeSession(progress, 'again', new Date('2026-09-17T12:00:00.000Z'))
      expect(parseBackup(serializeBackup(progress))).toEqual(progress)
    }
    expect(Object.keys(progress.records)).toHaveLength(lessons.length)
    expect(dueLessons(progress, new Date('2026-09-18T12:00:00.000Z'))).toHaveLength(lessons.length)
  })
})

describe('published version 1 compatibility', () => {
  it('loads and re-exports an actual MVP browser export with no dropped or added fields', () => {
    const text = JSON.stringify(legacyBackup)
    const parsed = parseBackup(text)
    expect(parsed).toEqual(legacyBackup)
    expect(JSON.parse(serializeBackup(parsed))).toEqual(legacyBackup)
    expect(readProgress({
      getItem: key => key === STORAGE_KEY ? text : null,
      setItem: () => { throw new Error('Loading must not overwrite the original') },
    })).toEqual(legacyBackup)
  })

  it('finishes an old reflection without changing earlier completion and review dates', () => {
    const parsed = parseBackup(JSON.stringify(legacyBackup))
    const next = completeSession(parsed, 'okay', new Date('2026-09-21T12:00:00.000Z'))
    expect(next.records['hash-map-complements']).toEqual(legacyBackup.records['hash-map-complements'])
    expect(next.records['two-pointers-sorted-pairs'].attempts).toBe(1)
    expect(next.session).toBeNull()
    expect(next.activity[0]).toEqual(legacyBackup.activity[0])
  })

  it('does not mark added lessons complete when all original lessons were completed', () => {
    let progress = emptyProgress()
    for (const id of Object.keys(publishedContracts)) {
      progress = beginSession(progress, id, 'learn')
      progress.session = { ...progress.session!, phase: 'assess', draft: 'Completed before expansion' }
      progress = completeSession(progress, 'confident')
    }
    expect(Object.keys(progress.records)).toHaveLength(12)
    const next = lessons.find(lesson => !progress.records[lesson.id])!
    expect(Object.hasOwn(publishedContracts, next.id)).toBe(false)
    expect(progress.records[next.id]).toBeUndefined()
  })

  it('supports optional validated reading bookmarks without requiring migration', () => {
    const original = parseBackup(JSON.stringify(legacyBackup))
    expect(original.session?.readingSection).toBeUndefined()
    original.session = { ...original.session!, readingSection: 'concept-0' }
    expect(parseBackup(serializeBackup(original)).session?.readingSection).toBe('concept-0')
    for (const invalid of ['concept-1000', '', 42, null]) {
      const raw = { ...legacyBackup, session: { ...legacyBackup.session, readingSection: invalid } }
      expect(() => parseBackup(JSON.stringify(raw))).toThrow('unknown reading section')
    }
  })
})
