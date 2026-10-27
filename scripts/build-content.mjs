// Aggregates content/<track>/*.json into src/generated/curriculum.json so the app,
// Vitest and Playwright (plain Node) all load the same data with one JSON import.
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

/** Interview tracks first, then language tracks (track.json "kind": "language"). */
export const TRACK_ORDER = ['dsa', 'system-design', 'ml', 'ai', 'behavioral', 'python', 'typescript', 'sql']
const read = path => JSON.parse(readFileSync(path, 'utf8'))

export function buildCurriculum(root = 'content') {
  const tracks = []
  const lessons = []
  const labs = {}
  for (const id of TRACK_ORDER) {
    const info = read(join(root, id, 'track.json'))
    const files = new Set(readdirSync(join(root, id)).filter(name => name.endsWith('.json') && name !== 'track.json'))
    for (const lessonId of info.lessons) {
      if (!files.delete(`${lessonId}.json`)) throw new Error(`content/${id}/track.json lists ${lessonId} but the file is missing`)
      // Labs (diagrams, runnable exercises, quizzes) are heavy, so they ship as a separate lazy chunk.
      const { lab, ...lesson } = read(join(root, id, `${lessonId}.json`))
      if (lab) { labs[lesson.id] = lab; lesson.lang = lab.lang }
      lessons.push(lesson)
    }
    if (files.size) throw new Error(`content/${id} has lessons not listed in track.json: ${[...files].join(', ')}`)
    tracks.push({ id: info.id, title: info.title, description: info.description, ...(info.kind ? { kind: info.kind } : {}), ...(info.placement ? { placement: info.placement } : {}) })
  }
  return { tracks, lessons, labs }
}

export const OUTPUT = 'src/generated/curriculum.json'
export const LABS_OUTPUT = 'src/generated/labs.json'
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
  const index = problems.map(({ id, title, pattern, level, difficulty, lessonId, paths, subpattern }) => ({ id, title, pattern, level, difficulty, ...(lessonId ? { lessonId } : {}), ...(paths ? { paths } : {}), ...(subpattern ? { subpattern } : {}) }))
  return { problems, index }
}

export const SQL_PROBLEMS_OUTPUT = 'src/generated/sql-problems.json'
export const SQL_PROBLEM_INDEX_OUTPUT = 'src/generated/sql-problem-index.json'

export function buildSqlProblems(root = 'content') {
  const dir = join(root, 'sql-problems')
  if (!existsSync(join(dir, 'index.json'))) return { problems: [], index: [] }
  const { problems: order } = read(join(dir, 'index.json'))
  const files = new Set(readdirSync(dir).filter(name => name.endsWith('.json') && name !== 'index.json'))
  const problems = order.map(id => {
    if (!files.delete(`${id}.json`)) throw new Error(`content/sql-problems/index.json lists ${id} but the file is missing`)
    return read(join(dir, `${id}.json`))
  })
  if (files.size) throw new Error(`content/sql-problems has problems not listed in index.json: ${[...files].join(', ')}`)
  const index = problems.map(({ id, title, topic, level, difficulty, lessonId, paths }) => ({ id, title, topic, level, difficulty, ...(lessonId ? { lessonId } : {}), ...(paths ? { paths } : {}) }))
  return { problems, index }
}

/** One recall card per SQL problem: the technique that cracks it. */
export function sqlProblemCard(problem) {
  const question = `${problem.title}: which SQL technique cracks it?`
  const front = `${question} ${firstSentence(problem.prompt)}`
  return {
    id: `sql-p-${problem.id}`,
    front: front.length <= 200 ? front : question,
    back: `${problem.topic}. ${problem.hints.at(-1)}`,
    level: problem.level,
  }
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

export const COMPANIES_OUTPUT = 'src/generated/companies.json'
export const COMPANY_IDS_OUTPUT = 'src/generated/company-ids.json'

/** Company prep pages, in hub order. Only the id list is eager (for backups); the pages load lazily. */
export function buildCompanies(root = 'content') {
  const dir = join(root, 'companies')
  const { companies: order } = read(join(dir, 'index.json'))
  const files = new Set(readdirSync(dir).filter(name => name.endsWith('.json') && name !== 'index.json'))
  const companies = order.map(id => {
    if (!files.delete(`${id}.json`)) throw new Error(`content/companies/index.json lists ${id} but the file is missing`)
    return read(join(dir, `${id}.json`))
  })
  if (files.size) throw new Error(`content/companies has pages not listed in index.json: ${[...files].join(', ')}`)
  return { companies, ids: companies.map(company => company.id) }
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

export const PATTERNS_OUTPUT = 'src/generated/patterns.json'
export const PATTERN_INDEX_OUTPUT = 'src/generated/pattern-index.json'

/** Pattern pages, in learning order. A page is published when content/patterns/index.json lists it. */
export function buildPatterns(root = 'content') {
  const dir = join(root, 'patterns')
  if (!existsSync(join(dir, 'index.json'))) return { patterns: [], index: [] }
  const { patterns: order } = read(join(dir, 'index.json'))
  const files = new Set(readdirSync(dir).filter(name => name.endsWith('.json') && name !== 'index.json'))
  const patterns = order.map(id => {
    if (!files.delete(`${id}.json`)) throw new Error(`content/patterns/index.json lists ${id} but the file is missing`)
    return read(join(dir, `${id}.json`))
  })
  if (files.size) throw new Error(`content/patterns has pages not listed in index.json: ${[...files].join(', ')}`)
  const prompts = new Map(buildProblems(root).problems.map(problem => [problem.id, problem.prompt]))
  const index = patterns.map(page => ({
    id: page.id, title: page.title, ...(page.parent ? { parent: page.parent } : {}), category: page.category, level: page.level,
    summary: page.summary, minutes: page.minutes, idea: page.idea, oneLiner: page.oneLiner,
    time: page.complexity.time, space: page.complexity.space, signals: page.recognise.signals,
    drills: [...page.recognise.phrasings, ...page.problems.map(link => prompts.has(link.id) ? firstSentence(prompts.get(link.id)) : undefined).filter(text => text && text.length <= 200)],
    problems: page.problems,
  }))
  return { patterns, index }
}

/** Pattern quiz questions, then one "which pattern?" card per recognition signal. */
export function patternCards(page) {
  return [
    ...page.quiz.map((item, n) => ({ id: `dsa-pt-${page.id}-${n + 1}`, front: item.question, back: `${item.choices[item.answer]}. ${item.explain}`, level: page.level })),
    ...page.recognise.signals.map((signal, n) => ({ id: `dsa-pt-${page.id}-${page.quiz.length + n + 1}`, front: `You see: ${signal.see} Which pattern?`, back: `${page.title}: ${signal.think}`, level: page.level })),
  ]
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
  dsa.cards = [...dsa.cards, ...buildProblems(root).problems.map(problemCard), ...buildPatterns(root).patterns.flatMap(patternCards)]
  const sql = decks.find(deck => deck.track === 'sql')
  sql.cards = [...sql.cards, ...buildSqlProblems(root).problems.map(sqlProblemCard)]
  if (existsSync(join(root, 'field-guide', 'index.json'))) for (const entry of buildGuides(root).guides) {
    const deck = decks.find(item => item.track === GUIDE_TOPIC_TRACK[entry.topic])
    deck.cards = [...deck.cards, ...guideCards(entry)]
  }
  const index = decks.map(deck => ({ track: deck.track, title: deck.title, cards: deck.cards.map(card => card.id) }))
  return { decks, index }
}

export const NAV_INDEX_OUTPUT = 'src/generated/nav-index.json'

/**
 * A compact, lazily loaded index for the navigation tree: ids, titles and grouping keys only, as tuples.
 * The app renders the top two nav levels from a static model and loads this when a deep branch is needed.
 */
export function buildNavIndex(root = 'content') {
  const { tracks, lessons } = buildCurriculum(root)
  const decks = buildFlashcards(root).decks
  return {
    tracks: tracks.map(track => [track.id, track.title, lessons.filter(lesson => lesson.track === track.id).map(lesson => lesson.id)]),
    patterns: buildPatterns(root).index.map(page => [page.id, page.title, page.parent ?? '']),
    problems: buildProblems(root).index.map(problem => [problem.id, problem.title, problem.pattern]),
    sql: buildSqlProblems(root).index.map(problem => [problem.id, problem.title, problem.topic]),
    guides: existsSync(join(root, 'field-guide', 'index.json')) ? buildGuides(root).index.map(entry => [entry.id, entry.title, entry.topic, entry.kind]) : [],
    cases: buildCases(root).index.map(item => [item.id, item.title]),
    companies: buildCompanies(root).companies.map(company => [company.id, company.name]),
    decks: decks.map(deck => [deck.track, deck.title, deck.cards.length]),
  }
}

function writeIfChanged(path, value) {
  const text = JSON.stringify(value) + '\n'
  if (!existsSync(path) || readFileSync(path, 'utf8') !== text) {
    mkdirSync('src/generated', { recursive: true })
    writeFileSync(path, text)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { labs, ...curriculum } = buildCurriculum()
  writeIfChanged(OUTPUT, curriculum)
  writeIfChanged(LABS_OUTPUT, labs)
  const { problems, index } = buildProblems()
  writeIfChanged(PROBLEMS_OUTPUT, problems)
  writeIfChanged(PROBLEM_INDEX_OUTPUT, index)
  const sqlSet = buildSqlProblems()
  writeIfChanged(SQL_PROBLEMS_OUTPUT, sqlSet.problems)
  writeIfChanged(SQL_PROBLEM_INDEX_OUTPUT, sqlSet.index)
  const designs = buildCases()
  writeIfChanged(CASES_OUTPUT, designs.cases)
  writeIfChanged(CASE_INDEX_OUTPUT, designs.index)
  const companySet = buildCompanies()
  writeIfChanged(COMPANIES_OUTPUT, companySet.companies)
  writeIfChanged(COMPANY_IDS_OUTPUT, companySet.ids)
  const field = buildGuides()
  writeIfChanged(GUIDES_OUTPUT, field.guides)
  writeIfChanged(GUIDE_INDEX_OUTPUT, field.index)
  const patternSet = buildPatterns()
  writeIfChanged(PATTERNS_OUTPUT, patternSet.patterns)
  writeIfChanged(PATTERN_INDEX_OUTPUT, patternSet.index)
  const cards = buildFlashcards()
  writeIfChanged(FLASHCARDS_OUTPUT, cards.decks)
  writeIfChanged(FLASHCARD_INDEX_OUTPUT, cards.index)
  writeIfChanged(NAV_INDEX_OUTPUT, buildNavIndex())
}