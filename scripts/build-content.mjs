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
export const GUIDE_TOPIC_TRACK = { api: 'system-design', 'system-design': 'system-design', algorithms: 'dsa', 'code-quality': 'dsa', testing: 'dsa', security: 'system-design', databases: 'system-design', 'ml-production': 'ml', 'llm-apps': 'ai', 'customer-engineering': 'system-design' }

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
  const guides = existsSync(join(root, 'field-guide', 'index.json')) ? buildGuides(root) : { guides: [], index: [] }
  return {
    tracks: tracks.map(track => [track.id, track.title, lessons.filter(lesson => lesson.track === track.id).map(lesson => lesson.id)]),
    patterns: buildPatterns(root).index.map(page => [page.id, page.title, page.parent ?? '']),
    problems: buildProblems(root).index.map(problem => [problem.id, problem.title, problem.pattern]),
    sql: buildSqlProblems(root).index.map(problem => [problem.id, problem.title, problem.topic]),
    guides: guides.index.map(entry => [entry.id, entry.title, entry.topic, entry.kind]),
    cases: buildCases(root).index.map(item => [item.id, item.title]),
    companies: buildCompanies(root).companies.map(company => [company.id, company.name]),
    codebase: buildCodebase(root).repos.map(repo => [repo.id, repo.title, repo.lang, repo.tasks.map(task => [task.id, task.title, task.kind])]),
    decks: decks.map(deck => [deck.track, deck.title, deck.cards.length]),
    antipatterns: guides.guides.flatMap(entry => (entry.antipatterns ?? []).map(item => [entry.id, item.title])),
    plans: buildPlans(root).plans.map(plan => [plan.id, plan.title, plan.tracks.map(track => [track.id, track.title]), plan.weeks.map(week => [week.n, week.title, week.track ?? '', week.days.flatMap(day => day.items.map(item => item.id))])]),
  }
}

export const PLANS_OUTPUT = 'src/generated/plans.json'
export const PLAN_IDS_OUTPUT = 'src/generated/plan-ids.json'
/** Interview languages a plan may offer. Must match PLAN_LANGUAGES in src/study-plans.ts (checked by a test). */
export const PLAN_LANGUAGES = ['python', 'typescript']
/** Section pages a plan item may link to without an id. Every href is also checked against the router in a test. */
export const PLAN_PAGES = ['#plans', '#mock', '#stories', '#playground', '#cards', '#board', '#code', '#sql', '#design', '#guide', '#patterns', '#tracks', '#practice', '#progress', '#plan', '#codebase']

/**
 * Study plans, in hub order. Every link must point at content that exists, so the build fails on a broken link.
 * Only the id list is eager (for routing); plans load lazily.
 */
export function buildPlans(root = 'content') {
  const dir = join(root, 'plans')
  if (!existsSync(join(dir, 'index.json'))) return { plans: [], ids: [] }
  const { plans: order } = read(join(dir, 'index.json'))
  const files = new Set(readdirSync(dir).filter(name => name.endsWith('.json') && name !== 'index.json'))
  const targets = {
    code: new Set(buildProblems(root).index.map(item => item.id)),
    sql: new Set(buildSqlProblems(root).index.map(item => item.id)),
    design: new Set(buildCases(root).index.map(item => item.id)),
    guide: new Set(existsSync(join(root, 'field-guide', 'index.json')) ? buildGuides(root).index.map(item => item.id) : []),
    patterns: new Set([...buildPatterns(root).index.map(item => item.id), 'pick', 'cheatsheet']),
    tracks: new Set(TRACK_ORDER),
    company: new Set(buildCompanies(root).ids),
    mock: new Set(buildCompanies(root).ids),
    plans: new Set(order),
    codebase: new Set(buildCodebase(root).repos.flatMap(repo => [repo.id, ...repo.tasks.map(task => `${repo.id}/${task.id}`)])),
  }
  const lessons = new Set(buildCurriculum(root).lessons.map(lesson => lesson.id))
  const labs = { [MATH_LAB_PLAN]: new Set(buildMathLabs(root).map(lab => lab.id)) }
  const plans = order.map(id => {
    if (!files.delete(`${id}.json`)) throw new Error(`content/plans/index.json lists ${id} but the file is missing`)
    return validatePlan(read(join(dir, `${id}.json`)), id, { targets, lessons, labs })
  })
  if (files.size) throw new Error(`content/plans has plans not listed in index.json: ${[...files].join(', ')}`)
  for (const [planId, ids] of Object.entries(labs)) {
    const plan = plans.find(item => item.id === planId)
    const linked = new Set(plan ? plan.weeks.flatMap(week => week.days.flatMap(day => day.items.map(item => item.href))) : [])
    const orphans = [...ids].filter(id => !linked.has(`#plans/${planId}/${id}`))
    if (orphans.length) throw new Error(`content/math: labs not linked from the ${planId} plan: ${orphans.join(', ')}`)
  }
  return { plans, ids: plans.map(plan => plan.id) }
}

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max
/** True when `value` has exactly one entry per plan language and each entry passes `check`. */
const perLanguage = (value, languages, check) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join() === [...languages].sort().join() && languages.every(lang => check(value[lang]))

/** Checks a plan's shape and links, throwing a readable error; returns the plan. */
export function validatePlan(plan, file, { targets, lessons, labs = {} }) {
  const fail = message => { throw new Error(`content/plans/${file}.json: ${message}`) }
  const keys = Object.keys(plan ?? {}).sort().join(',')
  if (keys !== 'hoursPerWeek,id,languages,phases,refresher,rhythm,rules,summary,tips,title,tracks,weeks') fail('must have exactly id, title, summary, hoursPerWeek, languages, rhythm, rules, tips, refresher, tracks, phases and weeks')
  if (plan.id !== file || !KEBAB.test(plan.id)) fail('id must be kebab-case and match the file name')
  if (!text(plan.title, 80) || !text(plan.summary, 300) || !text(plan.hoursPerWeek, 20)) fail('title (≤80), summary (≤300) and hoursPerWeek are required')
  if (!Array.isArray(plan.languages) || !plan.languages.length || plan.languages.some(lang => !PLAN_LANGUAGES.includes(lang))) fail(`languages must be a non-empty list of ${PLAN_LANGUAGES.join(', ')}`)
  if (!Array.isArray(plan.rhythm) || plan.rhythm.some(row => !text(row?.when, 30) || !text(row?.time, 20) || !text(row?.text, 300))) fail('rhythm rows need when, time and text')
  if (!Array.isArray(plan.rules) || plan.rules.some(rule => !text(rule, 200))) fail('rules must be short strings')
  const languages = plan.languages
  if (new Set(languages).size !== languages.length) fail('languages must not repeat')
  if (!perLanguage(plan.tips, languages, tips => Array.isArray(tips) && tips.length > 0 && tips.length <= 8 && tips.every(tip => text(tip, 200)))) fail(`tips need 1–8 short strings for each of ${languages.join(', ')}`)
  if (!perLanguage(plan.refresher, languages, href => /^#tracks\/[a-z0-9-]+$/.test(href ?? '') && targets.tracks.has(href.slice(8)))) fail(`refresher needs a #tracks/<id> link for each of ${languages.join(', ')}`)
  if (!Array.isArray(plan.tracks) || plan.tracks.some(track => !KEBAB.test(track?.id ?? '') || !text(track.title, 40) || !text(track.summary, 200))) fail('tracks need id, title and summary')
  const trackIds = plan.tracks.map(track => track.id)
  if (new Set(trackIds).size !== trackIds.length) fail('track ids must be unique')
  if (!Array.isArray(plan.weeks) || !plan.weeks.length) fail('needs weeks')
  const length = Math.max(...plan.weeks.map(week => week.n))
  let next = 1
  for (const phase of plan.phases ?? []) {
    if (!KEBAB.test(phase?.id ?? '') || !text(phase.title, 60) || !text(phase.check, 300)) fail('phases need id, title and check')
    if (!Array.isArray(phase.weeks) || phase.weeks[0] !== next || !(phase.weeks[1] >= phase.weeks[0])) fail(`phase ${phase.id} must start at week ${next}`)
    next = phase.weeks[1] + 1
  }
  if (!plan.phases?.length || next !== length + 1) fail(`phases must cover weeks 1–${length} in order`)
  const itemIds = new Set()
  for (let n = 1; n <= length; n++) {
    const variants = plan.weeks.filter(week => week.n === n)
    const tracked = variants.filter(week => week.track)
    if (!(variants.length === 1 && !tracked.length) && !(tracked.length === variants.length && [...trackIds].sort().join() === tracked.map(week => week.track).sort().join())) fail(`week ${n} needs one shared entry or exactly one entry per track`)
  }
  for (const week of plan.weeks) {
    const at = `week ${week.n}${week.track ? ` (${week.track})` : ''}`
    const phase = plan.phases.find(item => item.id === week.phase)
    if (!phase || week.n < phase.weeks[0] || week.n > phase.weeks[1]) fail(`${at} is not inside its phase`)
    if (!text(week.title, 80) || !text(week.focus, 300)) fail(`${at} needs a title and focus`)
    if (week.tip !== undefined && !perLanguage(week.tip, languages, tip => text(tip, 300))) fail(`${at}: tip needs 1–300 characters for each of ${languages.join(', ')}`)
    if (!Array.isArray(week.days) || week.days.length !== 7) fail(`${at} needs exactly 7 days`)
    week.days.forEach((day, d) => {
      if (!text(day?.title, 60) || !Array.isArray(day.items) || !day.items.length || day.items.length > 6) fail(`${at} day ${d + 1} needs a title and 1–6 items`)
      for (const item of day.items) {
        const where = `${at} day ${d + 1} item ${item?.id}`
        if (!KEBAB.test(item?.id ?? '') || itemIds.has(item.id)) fail(`${where}: item ids must be unique kebab-case`)
        itemIds.add(item.id)
        if (Object.keys(item).some(key => !['id', 'text', 'minutes', 'href', 'lesson'].includes(key))) fail(`${where}: unknown key`)
        const itemText = value => text(value, 300) && !/\{(?!lang\})/.test(value)
        if (typeof item.text === 'string' ? !itemText(item.text) : !perLanguage(item.text, languages, itemText)) fail(`${where}: text must be 1–300 characters (or one such text per language: ${languages.join(', ')}) and only use the {lang} placeholder`)
        if (!Number.isInteger(item.minutes) || item.minutes < 5 || item.minutes > 120) fail(`${where}: minutes must be 5–120`)
        if (item.href && item.lesson) fail(`${where}: use href or lesson, not both`)
        if (item.lesson !== undefined && !lessons.has(item.lesson)) fail(`${where}: unknown lesson ${item.lesson}`)
        if (item.href !== undefined) {
          const [route, sub, ...rest] = String(item.href).replace(/^#/, '').split('/')
          const lab = route === 'plans' && rest.length === 1 && !!labs[sub]?.has(rest[0])
          const task = route === 'codebase' && rest.length === 1 && !!targets.codebase?.has(`${sub}/${rest[0]}`)
          const ok = item.href.startsWith('#') && (lab || task || (!rest.length && (sub === undefined ? PLAN_PAGES.includes(item.href) : !!targets[route]?.has(sub))))
          if (!ok) fail(`${where}: link ${item.href} does not resolve`)
        }
      }
    })
  }
  return plan
}

export const MATH_LABS_OUTPUT = 'src/generated/math-labs.json'
/** The study plan whose days link to the math labs (#plans/<plan>/<lab>). Same as MATH_PLAN_ID in src/math-labs.ts. */
export const MATH_LAB_PLAN = 'math-for-ml-6wk'
export const MATH_TOPICS = ['linear-algebra', 'probability', 'statistics', 'calculus', 'optimisation']
const MATH_LAB_KEYS = ['id', 'title', 'topic', 'minutes', 'summary', 'intro', 'prompt', 'function', 'starter', 'solution', 'tests', 'hiddenTests', 'hints', 'explanation']
const MATH_LAB_OPTIONAL = ['formula', 'tolerance', 'lessons', 'diagram']

/**
 * Runnable Python + NumPy labs for the math plan, in plan order. They load lazily with the lab view.
 * Shape and links are checked here; diagrams and every solution/starter are checked in src/math-labs.test.ts.
 */
export function buildMathLabs(root = 'content') {
  const dir = join(root, 'math')
  if (!existsSync(join(dir, 'index.json'))) return []
  const { labs: order } = read(join(dir, 'index.json'))
  const files = new Set(readdirSync(dir).filter(name => name.endsWith('.json') && name !== 'index.json'))
  const lessons = new Set(buildCurriculum(root).lessons.map(lesson => lesson.id))
  const labs = order.map(id => {
    if (!files.delete(`${id}.json`)) throw new Error(`content/math/index.json lists ${id} but the file is missing`)
    const lab = read(join(dir, `${id}.json`))
    const fail = message => { throw new Error(`content/math/${id}.json: ${message}`) }
    const keys = Object.keys(lab ?? {})
    const missing = MATH_LAB_KEYS.filter(key => !keys.includes(key))
    const unknown = keys.filter(key => !MATH_LAB_KEYS.includes(key) && !MATH_LAB_OPTIONAL.includes(key))
    if (missing.length || unknown.length) fail(`missing ${missing.join(', ') || 'nothing'}; unknown ${unknown.join(', ') || 'nothing'}`)
    if (lab.id !== id || !KEBAB.test(id)) fail('id must be kebab-case and match the file name')
    if (!text(lab.title, 80) || !text(lab.summary, 200) || !text(lab.prompt, 1200) || !text(lab.explanation, 1200)) fail('title (≤80), summary (≤200), prompt and explanation (≤1200) are required')
    if (!MATH_TOPICS.includes(lab.topic)) fail(`topic must be one of ${MATH_TOPICS.join(', ')}`)
    if (!Number.isInteger(lab.minutes) || lab.minutes < 10 || lab.minutes > 90) fail('minutes must be 10–90')
    if (!Array.isArray(lab.intro) || !lab.intro.length || lab.intro.length > 5 || lab.intro.some(para => !text(para, 700))) fail('intro needs 1–5 paragraphs of at most 700 characters')
    if (lab.formula !== undefined && !text(lab.formula, 300)) fail('formula must be 1–300 characters')
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(lab.function ?? '')) fail('function must be a Python identifier')
    if (!text(lab.starter, 4000) || !text(lab.solution, 4000) || !lab.starter.includes(`def ${lab.function}(`) || !lab.solution.includes(`def ${lab.function}(`)) fail(`starter and solution must define ${lab.function}`)
    for (const [name, min] of [['tests', 2], ['hiddenTests', 1]]) {
      if (!Array.isArray(lab[name]) || lab[name].length < min || lab[name].some(test => Object.keys(test ?? {}).sort().join() !== 'args,expected' || !Array.isArray(test.args))) fail(`${name} needs at least ${min} { args, expected } cases`)
    }
    if (!Array.isArray(lab.hints) || !lab.hints.length || lab.hints.length > 4 || lab.hints.some(hint => !text(hint, 300))) fail('hints needs 1–4 short strings')
    if (lab.tolerance !== undefined && (Object.keys(lab.tolerance).some(key => key !== 'rel' && key !== 'abs') || Object.values(lab.tolerance).some(value => typeof value !== 'number' || !(value >= 0) || value > 0.1))) fail('tolerance may only set rel and abs, each 0–0.1')
    if (lab.lessons !== undefined && (!Array.isArray(lab.lessons) || lab.lessons.some(lesson => !lessons.has(lesson)))) fail('lessons must be existing lesson ids')
    return lab
  })
  if (files.size) throw new Error(`content/math has labs not listed in index.json: ${[...files].join(', ')}`)
  return labs
}

export const CODEBASE_OUTPUT = 'src/generated/codebase.json'
/** Just the "repo/task" ids, so routes and backups can check them without loading the codebases. */
export const CODEBASE_IDS_OUTPUT = 'src/generated/codebase-ids.json'
export const CODEBASE_LANGS = { py: { ext: '.py', test: /^tests\/test_[a-z0-9_]+\.py$/ }, ts: { ext: '.ts', test: /^tests\/[a-z0-9-]+\.test\.ts$/ } }
export const CODEBASE_STEPS = ['clarify', 'orient', 'reproduce', 'trace', 'change', 'verify', 'wrap-up']
const CODEBASE_TASK_KEYS = 'brief,done,id,kind,minutes,title,walkthrough'
const CODEBASE_WALKTHROUGH_KEYS = 'failingTest,orient,questions,trace,wrapUp'

/** Every file under `dir`, keyed by its forward-slash path relative to `dir`. */
function readTree(dir) {
  const out = {}
  if (!existsSync(dir)) return out
  const walk = sub => {
    for (const entry of readdirSync(join(dir, sub), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const rel = sub ? `${sub}/${entry.name}` : entry.name
      if (entry.isDirectory()) walk(rel)
      else out[rel] = readFileSync(join(dir, rel), 'utf8').replace(/\r\n/g, '\n')
    }
  }
  walk('')
  return out
}

/** Line diff (LCS) as unified-style hunks with `context` lines around each change. */
export function unifiedDiff(before, after, context = 3) {
  const a = before.split('\n')
  const b = after.split('\n')
  const table = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) {
    table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1])
  }
  const ops = []
  let i = 0
  let j = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { ops.push([' ', a[i], i, j]); i++; j++ }
    else if (i < a.length && (j === b.length || table[i + 1][j] >= table[i][j + 1])) { ops.push(['-', a[i], i, j]); i++ }
    else { ops.push(['+', b[j], i, j]); j++ }
  }
  const hunks = []
  let current = null
  let lastChange = -Infinity
  ops.forEach((op, index) => {
    if (op[0] === ' ') return
    if (current && index - lastChange <= context * 2 + 1) {
      current.end = index
    } else {
      if (current) hunks.push(current)
      current = { start: Math.max(0, index - context), end: index }
    }
    lastChange = index
  })
  if (current) hunks.push(current)
  return hunks.map(hunk => {
    const slice = ops.slice(hunk.start, Math.min(ops.length, hunk.end + context + 1))
    const first = slice[0]
    return [`@@ -${first[2] + 1} +${first[3] + 1} @@`, ...slice.map(([mark, line]) => `${mark}${line}`)].join('\n')
  }).join('\n')
}

/**
 * Practice codebases for #codebase, plus the guide and rubric. Each repo has 4–7 files and exactly one bug and one
 * feature task. Starters, solutions and hidden tests are checked by running them in src/codebase.test.ts.
 */
export function buildCodebase(root = 'content') {
  const dir = join(root, 'codebase')
  if (!existsSync(join(dir, 'guide.json'))) return { guide: null, repos: [] }
  const guide = read(join(dir, 'guide.json'))
  const gfail = message => { throw new Error(`content/codebase/guide.json: ${message}`) }
  if (!text(guide.title, 80) || !text(guide.summary, 600)) gfail('needs a title and summary')
  if (!Array.isArray(guide.steps) || guide.steps.map(step => step?.id).join() !== CODEBASE_STEPS.join()) gfail(`steps must be ${CODEBASE_STEPS.join(', ')} in order`)
  for (const step of guide.steps) {
    if (!text(step.title, 60) || !text(step.minutes, 20) || !Array.isArray(step.body) || !step.body.length || step.body.some(para => !text(para, 600))) gfail(`step ${step.id} needs a title, minutes and body`)
    if (!Array.isArray(step.checklist) || !step.checklist.length || step.checklist.some(item => !text(item, 120))) gfail(`step ${step.id} needs a checklist`)
  }
  if (!Array.isArray(guide.throughout) || !guide.throughout.length || guide.throughout.some(tip => !text(tip, 300))) gfail('throughout needs short tips')
  if (!Array.isArray(guide.rubric) || guide.rubric.length !== 4) gfail('rubric needs exactly 4 areas')
  for (const area of guide.rubric) {
    if (!KEBAB.test(area?.id ?? '') || !text(area.title, 40)) gfail('rubric areas need an id and title')
    if (!Array.isArray(area.steps) || !area.steps.length || area.steps.some(step => !CODEBASE_STEPS.includes(step))) gfail(`rubric ${area.id} must map to guide steps`)
    if (!Array.isArray(area.levels) || area.levels.length !== 4 || area.levels.some(level => !text(level, 200))) gfail(`rubric ${area.id} needs 4 level descriptions`)
  }
  const covered = new Set(guide.rubric.flatMap(area => area.steps))
  const uncovered = CODEBASE_STEPS.filter(step => !covered.has(step))
  if (uncovered.length) gfail(`rubric does not cover ${uncovered.join(', ')}`)

  const { repos: order } = read(join(dir, 'index.json'))
  const present = new Set(readdirSync(dir, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name))
  const repos = order.map(id => {
    const fail = message => { throw new Error(`content/codebase/${id}: ${message}`) }
    if (!present.delete(id)) fail('is listed in index.json but missing')
    const meta = read(join(dir, id, 'repo.json'))
    if (Object.keys(meta).sort().join() !== 'id,lang,summary,tasks,title') fail('repo.json must have exactly id, title, lang, summary and tasks')
    if (meta.id !== id || !KEBAB.test(id)) fail('id must be kebab-case and match the folder')
    if (!text(meta.title, 40) || !text(meta.summary, 200)) fail('title (≤40) and summary (≤200) are required')
    const lang = CODEBASE_LANGS[meta.lang]
    if (!lang) fail('lang must be py or ts')
    const files = readTree(join(dir, id, 'files'))
    const paths = Object.keys(files)
    if (paths.length < 4 || paths.length > 7) fail(`must have 4–7 files (has ${paths.length})`)
    if (!files['README.md']) fail('needs a README.md')
    if (paths.some(path => !/^[a-zA-Z0-9_./-]+$/.test(path) || (path !== 'README.md' && !path.endsWith(lang.ext)))) fail(`files must be README.md or ${lang.ext}`)
    if (!paths.some(path => lang.test.test(path))) fail('needs at least one visible test file')
    if (!Array.isArray(meta.tasks) || meta.tasks.length !== 2 || meta.tasks.map(task => task?.kind).sort().join() !== 'bug,feature') fail('needs exactly one bug task and one feature task')
    const taskDirs = new Set(readdirSync(join(dir, id, 'tasks')))
    const tasks = meta.tasks.map(task => {
      const at = `task ${task?.id}`
      if (Object.keys(task).sort().join() !== CODEBASE_TASK_KEYS) fail(`${at} must have exactly ${CODEBASE_TASK_KEYS}`)
      if (!KEBAB.test(task.id) || !taskDirs.delete(task.id)) fail(`${at} needs a kebab-case id and a tasks/${task.id} folder`)
      if (!text(task.title, 60)) fail(`${at} title must be 1–60 characters`)
      if (!Number.isInteger(task.minutes) || task.minutes < 45 || task.minutes > 60) fail(`${at} minutes must be 45–60`)
      if (!Array.isArray(task.brief) || !task.brief.length || task.brief.some(para => !text(para, 600))) fail(`${at} needs a brief`)
      if (!Array.isArray(task.done) || !task.done.length || task.done.some(item => !text(item, 200))) fail(`${at} needs done criteria`)
      const walk = task.walkthrough ?? {}
      if (Object.keys(walk).sort().join() !== CODEBASE_WALKTHROUGH_KEYS) fail(`${at} walkthrough must have exactly ${CODEBASE_WALKTHROUGH_KEYS}`)
      for (const key of ['questions', 'orient', 'trace', 'wrapUp']) if (!Array.isArray(walk[key]) || !walk[key].length || walk[key].some(item => !text(item, 400))) fail(`${at} walkthrough.${key} needs short items`)
      if (!text(walk.failingTest, 1500)) fail(`${at} walkthrough.failingTest is required`)
      const tdir = join(dir, id, 'tasks', task.id)
      const starter = readTree(join(tdir, 'starter'))
      const solution = readTree(join(tdir, 'solution'))
      const hidden = readTree(join(tdir, 'hidden'))
      if (task.kind === 'bug' && !Object.keys(starter).length) fail(`${at} is a bug task, so it needs starter overrides`)
      if (task.kind === 'feature' && Object.keys(starter).length) fail(`${at} is a feature task; it starts from files/`)
      if (Object.keys(starter).some(path => !(path in files))) fail(`${at} starter may only override existing files`)
      if (!Object.keys(solution).some(path => !lang.test.test(path))) fail(`${at} solution must change source code`)
      if (!Object.keys(solution).some(path => lang.test.test(path))) fail(`${at} solution must add a regression test to a visible test file`)
      const hiddenPaths = Object.keys(hidden)
      if (!hiddenPaths.length || hiddenPaths.some(path => !lang.test.test(path) || path in files)) fail(`${at} needs hidden test files with new names under tests/`)
      const start = { ...files, ...starter }
      const end = { ...start, ...solution }
      const diff = Object.keys(end).filter(path => start[path] !== end[path]).map(path => ({ path, diff: unifiedDiff(start[path] ?? '', end[path]) }))
      return { ...task, starter, solution, hidden, diff }
    })
    if (taskDirs.size) fail(`has task folders not listed in repo.json: ${[...taskDirs].join(', ')}`)
    return { id, title: meta.title, lang: meta.lang, summary: meta.summary, files, tasks }
  })
  if (present.size) throw new Error(`content/codebase has repos not listed in index.json: ${[...present].join(', ')}`)
  return { guide, repos }
}

export const CHANGELOG_OUTPUT = 'src/generated/changelog.json'
export const VERSION_PATTERN = /^\d+\.\d+\.\d+$/

/** Numeric x.y.z comparison: negative when a is older than b. */
export function compareVersions(a, b) {
  const left = a.split('.').map(Number)
  const right = b.split('.').map(Number)
  for (let index = 0; index < 3; index++) if (left[index] !== right[index]) return left[index] - right[index]
  return 0
}

/**
 * content/changelog.json: newest release first. The newest version is the app version (vite.config.ts) and must
 * match package.json. Highlight routes are checked against the router in src/changelog.test.ts.
 */
export function buildChangelog(root = 'content') {
  const releases = validateChangelog(read(join(root, 'changelog.json')))
  const pkg = read('package.json')
  if (root === 'content' && pkg.version !== releases[0].version) throw new Error(`content/changelog.json: the newest release (${releases[0].version}) must match package.json version (${pkg.version})`)
  return releases
}

/** Checks the changelog's shape and order, throwing a readable error; returns the releases. */
export function validateChangelog({ releases } = {}) {
  const fail = message => { throw new Error(`content/changelog.json: ${message}`) }
  if (!Array.isArray(releases) || releases.length === 0) fail('needs a non-empty "releases" array')
  releases.forEach((release, index) => {
    const at = `release ${index + 1} (${release?.version ?? 'no version'})`
    const keys = Object.keys(release ?? {}).sort().join(',')
    if (keys !== 'date,highlights,notes,title,version') fail(`${at} must have exactly version, date, title, highlights and notes`)
    if (typeof release.version !== 'string' || !VERSION_PATTERN.test(release.version)) fail(`${at} version must look like 1.2.3`)
    if (typeof release.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(release.date) || new Date(`${release.date}T00:00:00Z`).toISOString().slice(0, 10) !== release.date) fail(`${at} date must be an ISO date (YYYY-MM-DD)`)
    if (typeof release.title !== 'string' || !release.title.trim() || release.title.length > 80) fail(`${at} title must be 1–80 characters`)
    if (!Array.isArray(release.highlights) || release.highlights.length < 2 || release.highlights.length > 3) fail(`${at} needs 2–3 highlights`)
    for (const item of release.highlights) {
      if (Object.keys(item ?? {}).sort().join(',') !== 'route,text') fail(`${at} highlights need exactly text and route`)
      if (typeof item.text !== 'string' || !item.text.trim() || item.text.length > 200) fail(`${at} highlight text must be 1–200 characters`)
      if (typeof item.route !== 'string' || !/^#[a-z]+(\/[a-z0-9-]+)?$/.test(item.route)) fail(`${at} highlight route must be an app hash such as #playground`)
    }
    if (!Array.isArray(release.notes) || release.notes.some(note => typeof note !== 'string' || !note.trim())) fail(`${at} notes must be an array of non-empty strings`)
    const next = releases[index + 1]
    if (next && compareVersions(release.version, next.version) <= 0) fail(`${at} must be newer than the release after it (newest first, no duplicates)`)
    if (next && release.date < next.date) fail(`${at} is dated before the release after it`)
  })
  return releases
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
  const planSet = buildPlans()
  writeIfChanged(PLANS_OUTPUT, planSet.plans)
  writeIfChanged(PLAN_IDS_OUTPUT, planSet.ids)
  writeIfChanged(MATH_LABS_OUTPUT, buildMathLabs())
  const codebase = buildCodebase()
  writeIfChanged(CODEBASE_OUTPUT, codebase)
  writeIfChanged(CODEBASE_IDS_OUTPUT, codebase.repos.flatMap(repo => repo.tasks.map(task => `${repo.id}/${task.id}`)))
  writeIfChanged(NAV_INDEX_OUTPUT, buildNavIndex())
  writeIfChanged(CHANGELOG_OUTPUT, buildChangelog())
}