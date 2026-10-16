import { describe, expect, it } from 'vitest'
import knownCards from '../tests/fixtures/card-ids.json' with { type: 'json' }
import legacyBackup from '../tests/fixtures/v1-progress.json' with { type: 'json' }
import { BOX_DAYS, cardIds, deckIndex, dueCount, gradeCard, loadDecks, masteredCount, sessionQueue } from './flashcards'
import { buildMock, mockScore, MOCK_MINUTES, seeded } from './mocks'
import { lessonQueue, planStudy, problemQueue, MAX_LESSONS_PER_DAY } from './planner'
import { deleteStory, emptyProgress, parseBackup, recordCard, recordMock, saveStory, serializeBackup, MAX_STORIES } from './progress'
import { gameStats, cardXp, mockXp } from './gamification'
import { isPathCore, loadProblems, patternProgress, problemIndex, problemPatterns } from './problems'
import { PROBLEM_PATTERNS } from './problem-types'
import { recordSolve } from './progress'
import { loadCases } from './cases'
import { interviewLessons as lessons, loadLabs, tracks } from './curriculum'
import { selectPath } from './learning-paths'
import { COMPETENCY_IDS, newStoryId } from './stories'

const now = new Date('2025-03-10T09:00:00.000Z')
const today = '2025-03-10'

describe('flashcard id registry', () => {
  it('keeps every card id that has ever shipped', () => expect(knownCards.filter(id => !cardIds.has(id))).toEqual([]))
  it('records every current card id', () => expect([...cardIds].filter(id => !knownCards.includes(id))).toEqual([]))
  it('has a deck for every track and loads card text lazily', async () => {
    expect(deckIndex.map(deck => deck.track)).toEqual(tracks.map(track => track.id))
    const decks = await loadDecks()
    expect(decks.flatMap(deck => deck.cards.map(card => card.id))).toEqual(deckIndex.flatMap(deck => deck.cards))
  })
})

describe('Leitner scheduling', () => {
  it('moves cards between boxes by grade', () => {
    const first = gradeCard(undefined, 'good', today, now)
    expect(first).toEqual({ box: 1, due: '2025-03-11', at: now.toISOString(), reviews: 1 })
    expect(gradeCard(first, 'easy', today, now)).toMatchObject({ box: 3, due: '2025-03-17', reviews: 2 })
    expect(gradeCard(first, 'hard', today, now)).toMatchObject({ box: 1, due: '2025-03-11' })
    expect(gradeCard(undefined, 'hard', today, now).box).toBe(1)
    expect(gradeCard({ ...first, box: 5 }, 'again', today, now)).toMatchObject({ box: 0, due: today })
    expect(gradeCard({ ...first, box: 6 }, 'easy', today, now)).toMatchObject({ box: 6, due: '2025-05-09' })
    expect(BOX_DAYS).toHaveLength(7)
  })

  it('crosses month and leap-year boundaries', () => {
    expect(gradeCard({ box: 5, due: '', at: '', reviews: 1 }, 'good', '2024-02-20', now).due).toBe('2024-04-20')
  })

  it('queues due cards first, oldest first, then a capped number of new cards', () => {
    const ids = deckIndex[0].cards
    const cards = { [ids[3]]: { box: 2, due: '2025-03-09', at: now.toISOString(), reviews: 2 }, [ids[1]]: { box: 1, due: '2025-03-01', at: now.toISOString(), reviews: 1 }, [ids[0]]: { box: 3, due: '2025-04-01', at: now.toISOString(), reviews: 3 } }
    const queue = sessionQueue({ cards }, ids, today, 3)
    expect(queue).toEqual([ids[1], ids[3], ids[2], ids[4], ids[5]])
    expect(dueCount({ cards }, today)).toBe(2)
    expect(dueCount({ cards }, today, 'ml')).toBe(0)
    expect(masteredCount({ cards: { [ids[0]]: { ...cards[ids[0]], box: 4 } } })).toBe(1)
  })
})

describe('backup fields for practice', () => {
  const legacy = () => parseBackup(JSON.stringify(legacyBackup))

  it('old backups load without the new fields and upgrade cleanly', () => {
    const old = legacy()
    expect(old.cards).toBeUndefined()
    expect(old.mocks).toBeUndefined()
    expect(old.stories).toBeUndefined()
    const id = [...cardIds][0]
    let next = recordCard(old, id, gradeCard(undefined, 'good', today, now), now)
    next = recordMock(next, { track: 'system-design', percent: 75, minutes: 41.6 }, now)
    next = saveStory(next, { id: 'sabcde', title: 'Migrated billing', competencies: ['ownership', 'delivery'], situation: 's', task: 't', action: 'a', result: 'r' }, now)
    const again = parseBackup(serializeBackup(next))
    expect(again.cards?.[id]).toEqual({ box: 1, due: '2025-03-11', at: now.toISOString(), reviews: 1 })
    expect(again.mocks).toEqual([{ track: 'system-design', at: now.toISOString(), percent: 75, minutes: 42 }])
    expect(again.stories?.[0]).toMatchObject({ id: 'sabcde', competencies: ['ownership', 'delivery'] })
  })

  it.each([
    ['unknown card', { cards: { 'nope-card': { box: 1, due: today, at: now.toISOString(), reviews: 1 } } }],
    ['card box out of range', { cards: { [[...cardIds][0]]: { box: 7, due: today, at: now.toISOString(), reviews: 1 } } }],
    ['mock with unknown track', { mocks: [{ track: 'cooking', at: now.toISOString(), percent: 10, minutes: 5 }] }],
    ['mock score above 100', { mocks: [{ track: 'dsa', at: now.toISOString(), percent: 101, minutes: 5 }] }],
    ['story with unknown competency', { stories: [{ id: 'sabcde', title: '', competencies: ['luck'], situation: '', task: '', action: '', result: '', updatedAt: now.toISOString() }] }],
    ['duplicate story ids', { stories: [0, 1].map(() => ({ id: 'sabcde', title: '', competencies: [], situation: '', task: '', action: '', result: '', updatedAt: now.toISOString() })) }],
    ['story with an extra key', { stories: [{ id: 'sabcde', title: '', competencies: [], situation: '', task: '', action: '', result: '', updatedAt: now.toISOString(), extra: 1 }] }],
  ])('rejects a backup with %s', (_, patch) => {
    expect(() => parseBackup(JSON.stringify({ ...legacyBackup, ...patch }))).toThrow()
  })

  it('validates inputs, clips story text and caps the story bank', () => {
    const base = emptyProgress(now)
    expect(() => recordCard(base, 'nope', gradeCard(undefined, 'good', today, now))).toThrow()
    expect(() => recordMock(base, { track: 'dsa', percent: 50.5, minutes: 1 })).toThrow()
    const long = saveStory(base, { id: 'sabcde', title: 'x'.repeat(500), competencies: ['conflict', 'conflict'], situation: 'y'.repeat(5000), task: '', action: '', result: '' }, now)
    expect(long.stories?.[0].title).toHaveLength(120)
    expect(long.stories?.[0].situation).toHaveLength(2000)
    expect(long.stories?.[0].competencies).toEqual(['conflict'])
    expect(parseBackup(serializeBackup(long)).stories).toHaveLength(1)
    const edited = saveStory(long, { ...long.stories![0], title: 'Edited' }, now)
    expect(edited.stories).toHaveLength(1)
    expect(edited.stories?.[0].title).toBe('Edited')
    expect(deleteStory(edited, 'sabcde', now).stories).toBeUndefined()
    let full = base
    for (let i = 0; i < MAX_STORIES; i++) full = saveStory(full, { id: `s${String(i).padStart(5, '0')}`, title: '', competencies: [], situation: '', task: '', action: '', result: '' }, now)
    expect(() => saveStory(full, { id: 'sextra1', title: '', competencies: [], situation: '', task: '', action: '', result: '' }, now)).toThrow()
  })

  it('makes valid random story ids', () => {
    expect(newStoryId()).toMatch(/^s[a-z0-9]{10}$/)
    expect(COMPETENCY_IDS).toHaveLength(10)
  })
})

describe('mock interviews', () => {
  it('is deterministic per seed and well formed for every track and level', async () => {
    const data = { problems: await loadProblems(), cases: await loadCases(), labs: await loadLabs() }
    for (const track of tracks.map(item => item.id)) {
      for (const level of ['se', 'sse'] as const) {
        for (const seed of [1, 42, 9_999]) {
          const mock = buildMock(track, level, seed, data)
          expect(buildMock(track, level, seed, data)).toEqual(mock)
          expect(mock.minutes).toBe(MOCK_MINUTES[track])
          expect(mock.questions.length).toBeGreaterThanOrEqual(2)
          for (const question of mock.questions) {
            expect(question.prompt.length).toBeGreaterThan(10)
            expect(question.answer.length).toBeGreaterThan(20)
            expect(question.rubric.length).toBeGreaterThanOrEqual(2)
          }
          expect(new Set(mock.questions.map(q => `${q.kind}:${q.ref}:${q.code ?? ''}`)).size).toBe(mock.questions.length)
        }
      }
    }
  })

  it('matches level: SE gets SE problems and cases, SSE gets the senior rubric', async () => {
    const data = { problems: await loadProblems(), cases: await loadCases() }
    for (let seed = 0; seed < 30; seed++) {
      expect(data.problems.get(buildMock('dsa', 'se', seed, data).questions[0].ref)?.level).toBe('se')
      expect(data.cases.get(buildMock('system-design', 'se', seed, data).questions[0].ref)?.level).toBe('se')
      expect(data.cases.get(buildMock('system-design', 'sse', seed, data).questions[0].ref)?.level).toBe('sse')
      expect(buildMock('behavioral', 'sse', seed, data).questions[0].rubric).toHaveLength(6)
    }
  })

  it('scores the share of rubric items checked', () => {
    const mock = { questions: [{ rubric: ['a', 'b', 'c'] }, { rubric: ['d'] }] } as Parameters<typeof mockScore>[0]
    expect(mockScore(mock, [[true, false, true], [true]])).toBe(75)
    expect(mockScore(mock, [])).toBe(0)
  })

  it('has a uniform-ish PRNG in [0, 1)', () => {
    const random = seeded(7)
    const values = Array.from({ length: 2000 }, random)
    expect(values.every(value => value >= 0 && value < 1)).toBe(true)
    expect(values.reduce((a, b) => a + b) / values.length).toBeCloseTo(0.5, 1)
  })
})

describe('gamification for practice', () => {
  it('awards XP, streak days and badges for cards and mocks', () => {
    const id = [...cardIds][0]
    let progress = recordCard(emptyProgress(now), id, { box: 4, due: '2025-03-24', at: now.toISOString(), reviews: 3 }, now)
    progress = recordMock(progress, { track: 'dsa', percent: 85, minutes: 45 }, now)
    expect(cardXp(progress)).toBe(6)
    expect(mockXp(progress)).toBe(40)
    const stats = gameStats(progress, now)
    expect(stats.xp).toBe(46)
    expect(stats.streak.current).toBe(1)
    const earned = stats.badges.filter(badge => badge.earned).map(badge => badge.id)
    expect(earned).toEqual(expect.arrayContaining(['first-cards', 'first-mock']))
    expect(earned).not.toContain('mock-every-track')
  })
})

describe('study planner', () => {
  it('defaults to a 7-day plan with daily flashcards and a weekly mock', () => {
    const plan = planStudy(emptyProgress(now), today)
    expect(plan.dated).toBe(false)
    expect(plan.days.map(day => day.day)).toEqual(['2025-03-10', '2025-03-11', '2025-03-12', '2025-03-13', '2025-03-14', '2025-03-15', '2025-03-16'])
    expect(plan.days.every(day => day.items[0].kind === 'cards')).toBe(true)
    expect(plan.days.flatMap(day => day.items).filter(item => item.kind === 'mock')).toHaveLength(1)
    expect(plan.days.every(day => day.items.filter(item => item.kind === 'lesson').length <= MAX_LESSONS_PER_DAY)).toBe(true)
    expect(plan.unscheduled).toBe(lessons.length - 21)
  })

  it('spreads every lesson before a distant interview and keeps the interview day light', () => {
    const progress = { ...emptyProgress(now), profile: { interviewDate: '2025-05-10' } }
    const plan = planStudy(progress, today)
    expect(plan.dated).toBe(true)
    expect(plan.days.at(-1)).toEqual({ day: '2025-05-10', items: [{ kind: 'cards', title: 'Flashcard review', minutes: 10 }, { kind: 'rest', title: 'Interview day: light review only', minutes: 0 }] })
    expect(plan.unscheduled).toBe(0)
    const scheduled = plan.days.flatMap(day => day.items).filter(item => item.kind === 'lesson').map(item => item.ref)
    expect(new Set(scheduled).size).toBe(lessons.length)
    const mocksBefore = plan.days.slice(-3, -1).map(day => day.items.some(item => item.kind === 'mock'))
    expect(mocksBefore).toEqual([true, true])
  })

  it('ignores a past interview date and puts the role path first', () => {
    const progress = selectPath({ ...emptyProgress(now), profile: { interviewDate: '2025-01-01', focusTracks: ['ai'] } }, 'senior')
    const plan = planStudy(progress, today)
    expect(plan.dated).toBe(false)
    const queue = lessonQueue(progress)
    expect(queue).toHaveLength(lessons.length)
    expect(plan.days[0].items.find(item => item.kind === 'lesson')?.ref).toBe(queue[0])
    expect(plan.days[0].items.some(item => item.kind === 'problem')).toBe(true)
    expect(plan.days[1].items.some(item => item.kind === 'case')).toBe(true)
  })

  it('caps very distant interviews at 90 days', () => {
    expect(planStudy({ ...emptyProgress(now), profile: { interviewDate: '2026-12-01' } }, today).days).toHaveLength(90)
  })
})

describe('problem patterns', () => {
  const now = new Date(2025, 2, 10, 12)
  it('lists patterns in canonical order with per-pattern totals', () => {
    expect(problemPatterns()).toEqual(PROBLEM_PATTERNS.filter(pattern => problemIndex.some(problem => problem.pattern === pattern)))
    const rows = patternProgress(emptyProgress(now))
    expect(rows.reduce((sum, row) => sum + row.total, 0)).toBe(problemIndex.length)
    const first = problemIndex[0]
    const solved = patternProgress(recordSolve(emptyProgress(now), first.id, 'py', now)).find(row => row.pattern === first.pattern)
    expect(solved?.solved).toBe(1)
  })

  it('queues unsolved problems with path-core problems first and hides SSE-only problems from the SE path', () => {
    for (const path of ['swe', 'senior'] as const) {
      const progress = selectPath(emptyProgress(now), path)
      const queue = problemQueue(progress)
      if (path === 'swe') expect(queue.every(problem => problem.level === 'se')).toBe(true)
      const core = queue.filter(problem => isPathCore(problem, path))
      expect(queue.slice(0, core.length)).toEqual(core)
    }
    const first = problemQueue(emptyProgress(now))[0]
    expect(problemQueue(recordSolve(emptyProgress(now), first.id, 'js', now))).not.toContainEqual(first)
  })

  it('prefers the least-practised pattern once core problems are equal', () => {
    const progress = recordSolve(emptyProgress(now), problemIndex[0].id, 'js', now)
    const queue = problemQueue(progress).filter(problem => !isPathCore(problem, undefined))
    expect(queue[0].pattern).not.toBe(problemIndex[0].pattern)
  })

  it('awards a badge for clearing a pattern', () => {
    let progress = emptyProgress(now)
    const pattern = problemIndex[0].pattern
    const badgeId = (p: typeof progress) => gameStats(p, now).badges.find(badge => badge.id === 'pattern-arrays-and-hashing')?.earned
    expect(badgeId(progress)).toBe(false)
    for (const problem of problemIndex.filter(item => item.pattern === pattern)) progress = recordSolve(progress, problem.id, 'js', now)
    expect(badgeId(progress)).toBe(true)
    expect(gameStats(progress, now).badges.find(badge => badge.id === 'all-patterns')?.earned).toBe(false)
  })
})
