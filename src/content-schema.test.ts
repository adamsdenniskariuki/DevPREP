import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { validateDeck, validateLesson, validateTrack, TRACK_IDS } from './content-schema'
import { lessons } from './curriculum'

const root = 'content'
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as unknown

describe('content schema', () => {
  it('has a directory for every track and no stray directories', () => {
    const dirs = readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name).sort()
    expect(dirs).toEqual([...TRACK_IDS, 'problems', 'cases', 'flashcards', 'field-guide', 'sql-problems', 'patterns'].sort())
  })

  for (const track of TRACK_IDS) {
    describe(track, () => {
      const dir = join(root, track)
      const info = read(join(dir, 'track.json')) as { lessons: string[] }
      const files = readdirSync(dir).filter(name => name.endsWith('.json') && name !== 'track.json')

      it('track.json is valid and lists exactly the lesson files', () => {
        expect(validateTrack(info, `${track}/track.json`)).toEqual([])
        expect([...info.lessons].sort()).toEqual(files.map(name => name.replace(/\.json$/, '')).sort())
      })

      it.each(files)('%s is a valid lesson whose id matches its file and track', name => {
        const lesson = read(join(dir, name)) as { id: string; track: string }
        expect(validateLesson(lesson, `${track}/${name}`)).toEqual([])
        expect(lesson.id).toBe(name.replace(/\.json$/, ''))
        expect(lesson.track).toBe(track)
      })
    })
  }

  describe('flashcards', () => {
    it('has exactly one valid deck per track, with globally unique card ids', () => {
      const files = readdirSync(join(root, 'flashcards')).sort()
      expect(files).toEqual(TRACK_IDS.map(track => `${track}.json`).sort())
      const ids = new Set<string>()
      for (const track of TRACK_IDS) {
        const deck = read(join(root, 'flashcards', `${track}.json`)) as { track: string; cards: { id: string }[] }
        expect(validateDeck(deck, `flashcards/${track}.json`)).toEqual([])
        expect(deck.track).toBe(track)
        for (const card of deck.cards) { expect(ids.has(card.id)).toBe(false); ids.add(card.id) }
      }
    })

    it('rejects malformed decks', () => {
      expect(validateDeck({ track: 'dsa', title: 'x', cards: [{ id: 'ml-x', front: '', back: 'b', level: 'mid' }] })).toEqual(expect.arrayContaining([
        'deck.cards: expected at least 10 cards',
      ]))
      const cards = Array.from({ length: 10 }, (_, i) => ({ id: `dsa-c${i}`, front: 'f', back: 'b', level: 'se' }))
      cards[1] = { id: 'ml-x', front: '', back: 'b', level: 'mid' }
      expect(validateDeck({ track: 'dsa', title: 'x', cards })).toEqual(expect.arrayContaining([
        'deck.cards[1].id: expected kebab-case id starting with the track id',
        'deck.cards[1].front: expected non-empty string',
        'deck.cards[1].level: expected "se" or "sse"',
      ]))
    })

    it('generated decks match the content directory', async () => {
      // @ts-expect-error plain JS build script
      const { buildFlashcards } = await import('../scripts/build-content.mjs')
      const built = buildFlashcards()
      expect(JSON.parse(readFileSync('src/generated/flashcards.json', 'utf8'))).toEqual(built.decks)
      expect(JSON.parse(readFileSync('src/generated/flashcard-index.json', 'utf8'))).toEqual(built.index)
    for (const deck of built.decks) expect(validateDeck(deck, `generated ${deck.track} deck`)).toEqual([])
    })
  })

  it('rejects malformed lessons with readable errors', () => {
    expect(validateLesson({ id: 'Bad Id', track: 'nope', extra: 1 })).toEqual(expect.arrayContaining([
      'lesson.id: expected kebab-case id',
      'lesson.track: unknown track',
      'lesson: unknown key "extra"',
      'lesson: missing "title"',
    ]))
  })

  it('generated curriculum matches the content directory', async () => {
    // @ts-expect-error plain JS build script
    const { buildCurriculum } = await import('../scripts/build-content.mjs')
    const { labs, ...curriculum } = buildCurriculum()
    expect(JSON.parse(readFileSync('src/generated/curriculum.json', 'utf8'))).toEqual(curriculum)
    expect(JSON.parse(readFileSync('src/generated/labs.json', 'utf8'))).toEqual(labs)
  })

  it('loads every lesson file into the bundled curriculum in track order', () => {
    expect(lessons.map(lesson => lesson.track)).toEqual([...lessons.map(lesson => lesson.track)].sort((a, b) => TRACK_IDS.indexOf(a) - TRACK_IDS.indexOf(b)))
    expect(new Set(lessons.map(lesson => lesson.id)).size).toBe(lessons.length)
  })
  it('adds one generated recall card per runnable problem to the DSA deck', async () => {
    // @ts-expect-error plain JS build script
    const { buildFlashcards, buildProblems } = await import('../scripts/build-content.mjs')
    const dsa = buildFlashcards().decks.find((deck: { track: string }) => deck.track === 'dsa')
    const ids = dsa.cards.map((card: { id: string }) => card.id)
    for (const problem of buildProblems().problems as { id: string }[]) expect(ids).toContain(`dsa-p-${problem.id}`)
  })
})
