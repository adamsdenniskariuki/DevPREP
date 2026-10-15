import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import knownIds from '../tests/fixtures/guide-ids.json' with { type: 'json' }
import { validateGuide } from './content-schema'
import { lessons } from './curriculum'
import { problemIds } from './problems'
import { caseIds } from './cases'
import { guideIndex, guideIds, loadGuides, quizScore } from './guides'
import { TOPIC_TRACK } from './guide-types'
import { emptyProgress, parseBackup, recordGuide, serializeBackup } from './progress'
import { gameStats, guideXp, XP_RULES } from './gamification'
import { guideQueue, planStudy } from './planner'
import { buildMock } from './mocks'
import { loadProblems } from './problems'
import { loadCases } from './cases'
import type { Diagram, FieldGuideEntry, FlowBody } from './guide-types'
import { chartOverlaps, describeDiagram, diagramSteps, edgeCrossings, layoutFlow } from './diagram-layout'

const dir = 'content/field-guide'
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as unknown
const files = readdirSync(dir).filter(name => name.endsWith('.json') && name !== 'index.json')
const entries = files.map(name => read(join(dir, name)) as FieldGuideEntry)
const lessonIds = new Set(lessons.map(lesson => lesson.id))
const flowBodies = (diagram: Diagram): [string, FlowBody][] =>
  diagram.type === 'flow' ? [[diagram.id, diagram]] : diagram.type === 'compare' ? [[`${diagram.id}.before`, diagram.before], [`${diagram.id}.after`, diagram.after]] : []

describe('Field Guide content', () => {
  it('index.json lists exactly the entry files, in a stable order', () => {
    const { guides: order } = read(join(dir, 'index.json')) as { guides: string[] }
    expect([...order].sort()).toEqual(files.map(name => name.replace(/\.json$/, '')).sort())
    expect(guideIndex.map(item => item.id)).toEqual(order)
  })

  it.each(files)('%s is valid and its id matches the file', name => {
    const item = read(join(dir, name))
    expect(validateGuide(item, name)).toEqual([])
    expect((item as FieldGuideEntry).id).toBe(name.replace(/\.json$/, ''))
  })

  it.each(files)('%s links only to content that exists', name => {
    const { links } = read(join(dir, name)) as FieldGuideEntry
    expect((links.lessons ?? []).filter(id => !lessonIds.has(id))).toEqual([])
    expect((links.problems ?? []).filter(id => !problemIds.has(id))).toEqual([])
    expect((links.cases ?? []).filter(id => !caseIds.has(id))).toEqual([])
    expect((links.guides ?? []).filter(id => !guideIds.has(id) || id === name.replace(/\.json$/, ''))).toEqual([])
  })

  it.each(files)('%s has legible diagrams: no edge crosses a node and no chart labels collide', name => {
    const { diagrams } = read(join(dir, name)) as FieldGuideEntry
    for (const diagram of diagrams) {
      for (const [id, body] of flowBodies(diagram)) expect(edgeCrossings(body), id).toEqual([])
      if (diagram.type === 'chart') expect(chartOverlaps(diagram), diagram.id).toEqual([])
      expect(describeDiagram(diagram).length, diagram.id).toBeGreaterThan(0)
    }
  })

  it.each(files)('%s uses each snippet diagram at most once', name => {
    const entry = read(join(dir, name)) as FieldGuideEntry
    if (entry.kind !== 'guide') return
    const used = [...entry.examples.flatMap(item => [item.bad, item.good]), ...entry.antipatterns.flatMap(item => [item.bad, item.better])].flatMap(item => item.diagram ? [item.diagram] : [])
    expect(used.length).toBe(new Set(used).size)
  })

  it('keeps diagram ids unique across the whole guide, so the gallery has no duplicate element ids', () => {
    const ids = entries.flatMap(entry => entry.diagrams.map(diagram => diagram.id))
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([])
  })

  it('cites https sources for every case study', () => {
    for (const entry of entries) if (entry.kind === 'case') expect(entry.sources.length).toBeGreaterThanOrEqual(1)
  })

  it('lazy-loads the same entries the index lists', async () => {
    const loaded = await loadGuides()
    expect([...loaded.keys()]).toEqual(guideIndex.map(item => item.id))
  })

  it('maps topics to tracks the same way in the app and the build script', async () => {
    // @ts-expect-error plain JS build script
    const { GUIDE_TOPIC_TRACK } = await import('../scripts/build-content.mjs')
    expect(GUIDE_TOPIC_TRACK).toEqual(TOPIC_TRACK)
  })

  it('turns every quiz question into a flashcard in the deck of the topic track', async () => {
    // @ts-expect-error plain JS build script
    const { guideCards } = await import('../scripts/build-content.mjs')
    for (const entry of entries) {
      const cards = guideCards(entry) as { id: string; back: string }[]
      expect(cards).toHaveLength(entry.quiz.length)
      for (const card of cards) expect(card.id.startsWith(`${TOPIC_TRACK[entry.topic]}-fg-${entry.id}-`)).toBe(true)
    }
  })

  it('rejects malformed entries with readable errors', () => {
    const bad = {
      id: 'Bad', kind: 'guide', topic: 'cooking', level: 'staff', title: 'x', summary: 's', minutes: 2,
      diagrams: [
        { id: 'a', type: 'flow', title: 'A', alt: 'short', caption: 'c', nodes: [{ id: 'n', label: 'x'.repeat(30), kind: 'robot', col: 7, row: 0 }, { id: 'n', label: 'B', kind: 'db', col: 0, row: 0 }], edges: [{ from: 'n', to: 'zz' }] },
        { id: 'a', type: 'pie', title: 'B', alt: 'x'.repeat(50), caption: 'c' },
        { id: 'c', type: 'flow', title: 'C', alt: 'x'.repeat(50), caption: 'c', nodes: [{ id: 'p', label: 'P', kind: 'service', col: 0, row: 0 }, { id: 'q', label: 'Q', kind: 'db', col: 1, row: 0 }], edges: [{ from: 'p', to: 'q' }] },
      ],
      interview: ['one'], quiz: [{ question: 'q', choices: ['a', 'a'], answer: 5, explain: 'e' }],
      practice: { prompt: 'p', answer: 'a', rubric: ['r'] }, links: {},
      principle: 'p', why: 'w', checklist: ['c'], examples: [{ title: 't', why: 'w', bad: { label: 'b', code: 'x', diagram: 'a' }, good: { label: 'g', diagram: 'missing' } }], antipatterns: [],
    }
    expect(validateGuide(bad, 'guide')).toEqual(expect.arrayContaining([
      'guide.id: expected kebab-case id',
      'guide.topic: unknown topic',
      'guide.level: expected se or sse',
      'guide.minutes: expected integer 5–45',
      'guide.diagrams[0].alt: alt text should describe the picture (40+ characters)',
      'guide.diagrams[0].nodes[0].label: expected at most 18 characters',
      'guide.diagrams[0].nodes[0].kind: unknown node kind',
      'guide.diagrams[0].nodes[0]: position outside the 5x6 grid',
      'guide.diagrams[0].nodes[1].id: expected unique id',
      'guide.diagrams[0].edges[0]: edge must join two different nodes',
      'guide.diagrams[1].type: expected one of flow, sequence, compare, chart, bars, timeline',
      'guide.diagrams[1].id: duplicate diagram id',
      'guide.interview: expected at least 2 strings',
      'guide.quiz: expected 3–6 questions',
      'guide.practice.rubric: expected at least 3 strings',
      'guide.checklist: expected at least 4 strings',
      'guide.links: expected at least one cross-link',
      'guide.examples[0].bad: expected exactly one of code or diagram',
      'guide.examples[0].good.diagram: unknown diagram id',
      'guide.antipatterns: expected at least 2 anti-patterns',
    ]))
  })
})

describe('diagram layout', () => {
  const body: FlowBody = {
    nodes: [{ id: 'a', label: 'A', kind: 'client', col: 0, row: 0 }, { id: 'b', label: 'B', kind: 'service', col: 1, row: 0 }, { id: 'c', label: 'C', kind: 'db', col: 2, row: 0 }],
    edges: [{ from: 'a', to: 'c', label: 'skips B' }],
  }
  it('flags an edge that passes through another node', () => {
    expect(edgeCrossings(body)).toHaveLength(1)
    expect(edgeCrossings({ ...body, edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }] })).toEqual([])
  })
  it('sizes the canvas to the used grid and keeps labels inside it', () => {
    const layout = layoutFlow({ ...body, edges: [{ from: 'a', to: 'b', label: 'call' }] })
    expect(layout.width).toBeGreaterThan(0)
    expect(layout.boxes.size).toBe(3)
    for (const edge of layout.edges) if (edge.label) { expect(edge.label.x).toBeGreaterThanOrEqual(0); expect(edge.label.x).toBeLessThanOrEqual(layout.width) }
  })
  it('turns flow steps and sequence messages into step text', () => {
    expect(diagramSteps({ id: 'f', type: 'flow', title: 't', alt: 'a', caption: 'c', ...body, steps: [{ edges: [0], text: 'one' }, { edges: [0], text: 'two' }] })).toEqual(['one', 'two'])
    expect(diagramSteps({ id: 's', type: 'sequence', title: 't', alt: 'a', caption: 'c', actors: [{ id: 'x', label: 'X' }, { id: 'y', label: 'Y' }], messages: [{ from: 'x', to: 'y', label: 'ping' }, { from: 'y', to: 'x', label: 'pong', note: 'back' }] })).toHaveLength(2)
  })
})

describe('quiz scoring', () => {
  const entry = { quiz: [{ answer: 0 }, { answer: 1 }, { answer: 2 }] } as Pick<FieldGuideEntry, 'quiz'>
  it('scores whole percentages and treats blanks as wrong', () => {
    expect(quizScore([0, 1, 2], entry)).toBe(100)
    expect(quizScore([0, undefined, 1], entry)).toBe(33)
    expect(quizScore([], entry)).toBe(0)
  })
})

// Field Guide IDs are stored in backups (the "guides" map). Append-only, like lesson IDs.
describe('Field Guide id registry', () => {
  const current = new Set(entries.map(item => item.id))
  it('keeps every id that has ever shipped', () => expect(knownIds.filter(id => !current.has(id))).toEqual([]))
  it('records every current id', () => expect([...current].filter(id => !knownIds.includes(id))).toEqual([]))
})

describe('Field Guide progress, XP, planner and mocks', () => {
  const now = new Date('2025-03-03T12:00:00Z')
  const first = guideIndex[0].id

  it('keeps the best quiz score, round-trips through a backup and ignores unknown ids', () => {
    let progress = recordGuide(emptyProgress(now), first, 75, now)
    progress = recordGuide(progress, first, 50, now)
    expect(progress.guides?.[first].best).toBe(75)
    expect(parseBackup(serializeBackup(progress))).toEqual(progress)
    expect(() => recordGuide(progress, 'not-a-guide', 100, now)).toThrow('Unknown Field Guide entry')
  })

  it('loads backups that have no guides field (older versions) unchanged', () => {
    const old = emptyProgress(now)
    expect(parseBackup(serializeBackup(old)).guides).toBeUndefined()
  })

  it('rejects a backup that names a Field Guide entry this version does not have', () => {
    const text = JSON.parse(serializeBackup(recordGuide(emptyProgress(now), first, 100, now)))
    text.guides['retired-guide'] = { best: 100, at: now.toISOString() }
    expect(() => parseBackup(JSON.stringify(text))).toThrow('unknown Field Guide entry')
  })

  it('gives XP for reading plus a bonus for a perfect quiz, and awards the first-guide badge', () => {
    const progress = recordGuide(emptyProgress(now), first, 100, now)
    expect(guideXp(progress)).toBe(XP_RULES.guide + XP_RULES.guidePerfect)
    const stats = gameStats(progress, now)
    expect(stats.badges.find(badge => badge.id === 'first-guide')?.earned).toBe(true)
    expect(stats.streak.current).toBeGreaterThanOrEqual(1)
  })

  it('queues unread entries for the planner and adds them to the plan', () => {
    const progress = emptyProgress(now)
    expect(guideQueue(progress).map(item => item.id)).toContain(first)
    expect(guideQueue(recordGuide(progress, first, 100, now)).map(item => item.id)).not.toContain(first)
    const plan = planStudy(progress, '2025-03-03')
    expect(plan.days.flatMap(day => day.items).some(item => item.kind === 'guide')).toBe(true)
  })

  it('adds one guide practice question to technical mocks on the matching track', async () => {
    const data = { problems: await loadProblems(), cases: await loadCases(), guides: await loadGuides() }
    const track = TOPIC_TRACK[data.guides.get(first)!.topic]
    const mock = buildMock(track, 'sse', 7, data)
    expect(mock.questions.filter(question => question.kind === 'guide')).toHaveLength(1)
    expect(buildMock('behavioral', 'sse', 7, data).questions.some(question => question.kind === 'guide')).toBe(false)
  })
})
