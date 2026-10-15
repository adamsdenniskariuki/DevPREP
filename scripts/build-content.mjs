// Aggregates content/<track>/*.json into src/generated/curriculum.json so the app,
// Vitest and Playwright (plain Node) all load the same data with one JSON import.
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export const TRACK_ORDER = ['dsa', 'system-design', 'ml', 'ai', 'behavioral']
const read = path => JSON.parse(readFileSync(path, 'utf8'))

export function buildCurriculum(root = 'content') {
  const tracks = []
  const lessons = []
  for (const id of TRACK_ORDER) {
    const info = read(join(root, id, 'track.json'))
    const files = new Set(readdirSync(join(root, id)).filter(name => name.endsWith('.json') && name !== 'track.json'))
    for (const lessonId of info.lessons) {
      if (!files.delete(`${lessonId}.json`)) throw new Error(`content/${id}/track.json lists ${lessonId} but the file is missing`)
      lessons.push(read(join(root, id, `${lessonId}.json`)))
    }
    if (files.size) throw new Error(`content/${id} has lessons not listed in track.json: ${[...files].join(', ')}`)
    tracks.push({ id: info.id, title: info.title, description: info.description })
  }
  return { tracks, lessons }
}

export const OUTPUT = 'src/generated/curriculum.json'
export const PROBLEMS_OUTPUT = 'src/generated/problems.json'
export const PROBLEM_INDEX_OUTPUT = 'src/generated/problem-index.json'

export function buildProblems(root = 'content') {
  const dir = join(root, 'problems')
  const { problems: order } = read(join(dir, 'index.json'))
  const files = new Set(readdirSync(dir).filter(name => name.endsWith('.json') && name !== 'index.json'))
  const problems = order.map(id => {
    if (!files.delete(`${id}.json`)) throw new Error(`content/problems/index.json lists ${id} but the file is missing`)
    return read(join(dir, `${id}.json`))
  })
  if (files.size) throw new Error(`content/problems has problems not listed in index.json: ${[...files].join(', ')}`)
  const index = problems.map(({ id, title, pattern, level, difficulty, lessonId, paths }) => ({ id, title, pattern, level, difficulty, ...(lessonId ? { lessonId } : {}), ...(paths ? { paths } : {}) }))
  return { problems, index }
}

export const CASES_OUTPUT = 'src/generated/cases.json'
export const CASE_INDEX_OUTPUT = 'src/generated/case-index.json'

export function buildCases(root = 'content') {
  const dir = join(root, 'cases')
  const { cases: order } = read(join(dir, 'index.json'))
  const files = new Set(readdirSync(dir).filter(name => name.endsWith('.json') && name !== 'index.json'))
  const cases = order.map(id => {
    if (!files.delete(`${id}.json`)) throw new Error(`content/cases/index.json lists ${id} but the file is missing`)
    return read(join(dir, `${id}.json`))
  })
  if (files.size) throw new Error(`content/cases has cases not listed in index.json: ${[...files].join(', ')}`)
  const index = cases.map(({ id, title, level, minutes, summary }) => ({ id, title, level, minutes, summary }))
  return { cases, index }
}

/** First sentence of a prompt, so a card can recall a problem without its full statement. */
export function firstSentence(text) {
  const flat = text.replace(/\s+/g, ' ').trim()
  const match = /^.*?[.?!](?=\s|$)/.exec(flat)
  return match ? match[0] : flat
}

/** One recall card per runnable problem: spot the pattern, the key idea and the target complexity. */
export function problemCard(problem) {
  const question = `${problem.title}: which pattern fits, and what is the target cost?`
  const front = `${question} ${firstSentence(problem.prompt)}`
  return {
    id: `dsa-p-${problem.id}`,
    front: front.length <= 200 ? front : question,
    back: `${problem.pattern}. ${problem.hints.at(-1)} Time ${problem.complexity.time}, space ${problem.complexity.space}.`,
    level: problem.level,
  }
}

export const GUIDES_OUTPUT = 'src/generated/guides.json'
export const GUIDE_INDEX_OUTPUT = 'src/generated/guide-index.json'
/** Must match TOPIC_TRACK in src/guide-types.ts (checked by a test). */
export const GUIDE_TOPIC_TRACK = { api: 'system-design', 'system-design': 'system-design', algorithms: 'dsa', 'code-quality': 'dsa', testing: 'dsa', security: 'system-design', databases: 'system-design', 'ml-production': 'ml', 'llm-apps': 'ai' }

export function buildGuides(root = 'content') {
  const dir = join(root, 'field-guide')
  const { guides: order } = read(join(dir, 'index.json'))
  const files = new Set(readdirSync(dir).filter(name => name.endsWith('.json') && name !== 'index.json'))
  const guides = order.map(id => {
    if (!files.delete(`${id}.json`)) throw new Error(`content/field-guide/index.json lists ${id} but the file is missing`)
    return read(join(dir, `${id}.json`))
  })
  if (files.size) throw new Error(`content/field-guide has entries not listed in index.json: ${[...files].join(', ')}`)
  const index = guides.map(entry => ({
    id: entry.id, kind: entry.kind, topic: entry.topic, level: entry.level, title: entry.title, summary: entry.summary, minutes: entry.minutes,
    diagrams: entry.diagrams.length, antipatterns: entry.antipatterns?.length ?? 0, quiz: entry.quiz.length, links: entry.links,
    ...(entry.organisation ? { organisation: entry.organisation } : {}),
  }))
  return { guides, index }
}

/** Every Field Guide quiz question becomes a recall card in the deck of the track its topic feeds. */
export function guideCards(entry) {
  const track = GUIDE_TOPIC_TRACK[entry.topic]
  return entry.quiz.map((item, n) => ({
    id: `${track}-fg-${entry.id}-${n + 1}`,
    front: item.question,
    back: `${item.choices[item.answer]}. ${item.explain}`,
    level: entry.level,
  }))
}

export const FLASHCARDS_OUTPUT = 'src/generated/flashcards.json'
export const FLASHCARD_INDEX_OUTPUT = 'src/generated/flashcard-index.json'

export function buildFlashcards(root = 'content') {
  const dir = join(root, 'flashcards')
  const files = new Set(readdirSync(dir).filter(name => name.endsWith('.json')))
  const decks = TRACK_ORDER.map(id => {
    if (!files.delete(`${id}.json`)) throw new Error(`content/flashcards/${id}.json is missing`)
    return read(join(dir, `${id}.json`))
  })
  if (files.size) throw new Error(`content/flashcards has decks for unknown tracks: ${[...files].join(', ')}`)
  const dsa = decks.find(deck => deck.track === 'dsa')
  dsa.cards = [...dsa.cards, ...buildProblems(root).problems.map(problemCard)]
  if (existsSync(join(root, 'field-guide', 'index.json'))) for (const entry of buildGuides(root).guides) {
    const deck = decks.find(item => item.track === GUIDE_TOPIC_TRACK[entry.topic])
    deck.cards = [...deck.cards, ...guideCards(entry)]
  }
  const index = decks.map(deck => ({ track: deck.track, title: deck.title, cards: deck.cards.map(card => card.id) }))
  return { decks, index }
}

function writeIfChanged(path, value) {
  const text = JSON.stringify(value) + '\n'
  if (!existsSync(path) || readFileSync(path, 'utf8') !== text) {
    mkdirSync('src/generated', { recursive: true })
    writeFileSync(path, text)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeIfChanged(OUTPUT, buildCurriculum())
  const { problems, index } = buildProblems()
  writeIfChanged(PROBLEMS_OUTPUT, problems)
  writeIfChanged(PROBLEM_INDEX_OUTPUT, index)
  const designs = buildCases()
  writeIfChanged(CASES_OUTPUT, designs.cases)
  writeIfChanged(CASE_INDEX_OUTPUT, designs.index)
  const field = buildGuides()
  writeIfChanged(GUIDES_OUTPUT, field.guides)
  writeIfChanged(GUIDE_INDEX_OUTPUT, field.index)
  const cards = buildFlashcards()
  writeIfChanged(FLASHCARDS_OUTPUT, cards.decks)
  writeIfChanged(FLASHCARD_INDEX_OUTPUT, cards.index)
}