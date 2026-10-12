import type { Track } from './curriculum-types'
import { PROBLEM_PATTERNS } from './problem-types'
import { NODE_KINDS, STEP_KEYS } from './case-types'
import type { NodeKind } from './case-types'

export const TRACK_IDS: readonly Track[] = ['dsa', 'system-design', 'ml', 'ai', 'behavioral']

type Rec = Record<string, unknown>
const isRec = (value: unknown): value is Rec => typeof value === 'object' && value !== null && !Array.isArray(value)
const isText = (value: unknown) => typeof value === 'string' && value.trim().length > 0

class Checker {
  errors: string[] = []
  private readonly where: string
  constructor(where: string) { this.where = where }
  fail(path: string, message: string) { this.errors.push(`${this.where}${path ? `.${path}` : ''}: ${message}`) }
  keys(value: Rec, path: string, required: string[], optional: string[] = []) {
    for (const key of required) if (!(key in value)) this.fail(path, `missing "${key}"`)
    for (const key of Object.keys(value)) if (!required.includes(key) && !optional.includes(key)) this.fail(path, `unknown key "${key}"`)
  }
  text(value: unknown, path: string) { if (!isText(value)) this.fail(path, 'expected non-empty string') }
  texts(value: unknown, path: string, min = 1) {
    if (!Array.isArray(value) || value.length < min) return this.fail(path, `expected at least ${min} strings`)
    value.forEach((item, index) => this.text(item, `${path}[${index}]`))
  }
  section(value: unknown, path: string) {
    if (!isRec(value)) return this.fail(path, 'expected object')
    this.keys(value, path, ['title', 'body'], ['code'])
    this.text(value.title, `${path}.title`)
    this.text(value.body, `${path}.body`)
    if ('code' in value) this.text(value.code, `${path}.code`)
  }
  sections(value: unknown, path: string, min: number) {
    if (!Array.isArray(value) || value.length < min) return this.fail(path, `expected at least ${min} sections`)
    value.forEach((item, index) => this.section(item, `${path}[${index}]`))
  }
}

const LESSON_REQUIRED = ['id', 'track', 'title', 'minutes', 'summary', 'objectives', 'concepts', 'example', 'task', 'hints', 'solution', 'checklist', 'pitfalls', 'prerequisites', 'prerequisiteNotes', 'walkthrough', 'extraPractice', 'followUps', 'takeaways']

/** Validates one lesson document. Returns human-readable errors (empty when valid). */
export function validateLesson(value: unknown, where = 'lesson'): string[] {
  const check = new Checker(where)
  if (!isRec(value)) { check.fail('', 'expected object'); return check.errors }
  check.keys(value, '', LESSON_REQUIRED, ['starter'])
  if (typeof value.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.id)) check.fail('id', 'expected kebab-case id')
  if (!TRACK_IDS.includes(value.track as Track)) check.fail('track', 'unknown track')
  check.text(value.title, 'title')
  if (!Number.isInteger(value.minutes) || (value.minutes as number) < 5 || (value.minutes as number) > 120) check.fail('minutes', 'expected integer 5–120')
  for (const key of ['summary', 'example', 'task', 'solution', 'prerequisiteNotes']) check.text(value[key], key)
  if ('starter' in value) check.text(value.starter, 'starter')
  check.texts(value.objectives, 'objectives')
  check.texts(value.hints, 'hints')
  check.texts(value.checklist, 'checklist')
  check.texts(value.pitfalls, 'pitfalls')
  check.texts(value.takeaways, 'takeaways', 3)
  if (!Array.isArray(value.prerequisites) || value.prerequisites.some(item => typeof item !== 'string')) check.fail('prerequisites', 'expected string array')
  check.sections(value.concepts, 'concepts', 1)
  check.sections(value.walkthrough, 'walkthrough', 2)
  if (!Array.isArray(value.extraPractice)) check.fail('extraPractice', 'expected array')
  else value.extraPractice.forEach((item, index) => {
    const path = `extraPractice[${index}]`
    if (!isRec(item)) return check.fail(path, 'expected object')
    check.keys(item, path, ['id', 'title', 'prompt', 'hints', 'solution', 'checklist'])
    if (item.id !== 'warmup' && item.id !== 'stretch') check.fail(`${path}.id`, 'expected warmup or stretch')
    check.text(item.title, `${path}.title`)
    check.text(item.prompt, `${path}.prompt`)
    check.text(item.solution, `${path}.solution`)
    check.texts(item.hints, `${path}.hints`)
    check.texts(item.checklist, `${path}.checklist`)
  })
  if (!Array.isArray(value.followUps) || value.followUps.length < 2) check.fail('followUps', 'expected at least 2 follow-ups')
  else value.followUps.forEach((item, index) => {
    const path = `followUps[${index}]`
    if (!isRec(item)) return check.fail(path, 'expected object')
    check.keys(item, path, ['question', 'answer'])
    check.text(item.question, `${path}.question`)
    check.text(item.answer, `${path}.answer`)
  })
  return check.errors
}

const PROBLEM_REQUIRED = ['id', 'title', 'pattern', 'level', 'difficulty', 'prompt', 'function', 'starter', 'tests', 'hiddenTests', 'hints', 'solution', 'complexity', 'followUps']
const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/

/** Validates one content/problems/<id>.json runnable coding problem. */
export function validateProblem(value: unknown, where = 'problem'): string[] {
  const check = new Checker(where)
  if (!isRec(value)) { check.fail('', 'expected object'); return check.errors }
  check.keys(value, '', PROBLEM_REQUIRED, ['lessonId', 'paths'])
  if (typeof value.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.id)) check.fail('id', 'expected kebab-case id')
  for (const key of ['title', 'pattern', 'prompt']) check.text(value[key], key)
  if (value.level !== 'se' && value.level !== 'sse') check.fail('level', 'expected se or sse')
  if (!['warm-up', 'core', 'stretch'].includes(value.difficulty as string)) check.fail('difficulty', 'expected warm-up, core or stretch')
  if ('lessonId' in value) check.text(value.lessonId, 'lessonId')
  if (typeof value.pattern === 'string' && !(PROBLEM_PATTERNS as readonly string[]).includes(value.pattern)) check.fail('pattern', 'expected a known pattern')
  if ('paths' in value) {
    const paths = value.paths
    if (!Array.isArray(paths) || !paths.length || paths.some(path => path !== 'swe' && path !== 'senior') || new Set(paths).size !== paths.length) check.fail('paths', 'expected a non-empty list of swe/senior')
  }
  const pair = (key: string, extra: string[] = []) => {
    const item = value[key]
    if (!isRec(item)) return check.fail(key, 'expected object')
    check.keys(item, key, ['js', 'py', ...extra])
    for (const lang of ['js', 'py', ...extra]) check.text(item[lang], `${key}.${lang}`)
  }
  pair('function')
  pair('starter')
  pair('solution', ['explanation'])
  if (isRec(value.function)) {
    if (!IDENT.test(String(value.function.js))) check.fail('function.js', 'expected identifier')
    if (!IDENT.test(String(value.function.py))) check.fail('function.py', 'expected identifier')
  }
  const tests = (key: string, min: number) => {
    const list = value[key]
    if (!Array.isArray(list) || list.length < min) return check.fail(key, `expected at least ${min} tests`)
    list.forEach((item, index) => {
      const path = `${key}[${index}]`
      if (!isRec(item)) return check.fail(path, 'expected object')
      check.keys(item, path, ['args', 'expected'])
      if (!Array.isArray(item.args)) check.fail(`${path}.args`, 'expected array')
    })
  }
  tests('tests', 2)
  tests('hiddenTests', 3)
  check.texts(value.hints, 'hints', 3)
  check.texts(value.followUps, 'followUps')
  if (!isRec(value.complexity)) check.fail('complexity', 'expected object')
  else {
    check.keys(value.complexity, 'complexity', ['time', 'space', 'notes'])
    for (const key of ['time', 'space', 'notes']) check.text(value.complexity[key], `complexity.${key}`)
  }
  return check.errors
}

/** Validates a content/<track>/track.json document. */
export function validateTrack(value: unknown, where = 'track'): string[] {
  const check = new Checker(where)
  if (!isRec(value)) { check.fail('', 'expected object'); return check.errors }
  check.keys(value, '', ['id', 'title', 'description', 'lessons'])
  if (!TRACK_IDS.includes(value.id as Track)) check.fail('id', 'unknown track')
  check.text(value.title, 'title')
  check.text(value.description, 'description')
  check.texts(value.lessons, 'lessons')
  if (Array.isArray(value.lessons) && new Set(value.lessons).size !== value.lessons.length) check.fail('lessons', 'duplicate lesson id')
  return check.errors
}

export const CARD_FRONT_MAX = 200
export const CARD_BACK_MAX = 600

/** Validates a content/flashcards/<track>.json deck. Card ids must start with the track prefix. */
export function validateDeck(value: unknown, where = 'deck'): string[] {
  const check = new Checker(where)
  if (!isRec(value)) { check.fail('', 'expected object'); return check.errors }
  check.keys(value, '', ['track', 'title', 'cards'])
  if (!TRACK_IDS.includes(value.track as Track)) check.fail('track', 'unknown track')
  check.text(value.title, 'title')
  if (!Array.isArray(value.cards) || value.cards.length < 10) { check.fail('cards', 'expected at least 10 cards'); return check.errors }
  const ids = new Set<string>()
  value.cards.forEach((card, index) => {
    const path = `cards[${index}]`
    if (!isRec(card)) return check.fail(path, 'expected object')
    check.keys(card, path, ['id', 'front', 'back', 'level'])
    if (typeof card.id !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(card.id) || !card.id.startsWith(`${String(value.track)}-`)) check.fail(`${path}.id`, 'expected kebab-case id starting with the track id')
    else if (ids.has(card.id)) check.fail(`${path}.id`, 'duplicate card id')
    else ids.add(card.id)
    check.text(card.front, `${path}.front`)
    check.text(card.back, `${path}.back`)
    if (typeof card.front === 'string' && card.front.length > CARD_FRONT_MAX) check.fail(`${path}.front`, `longer than ${CARD_FRONT_MAX} characters`)
    if (typeof card.back === 'string' && card.back.length > CARD_BACK_MAX) check.fail(`${path}.back`, `longer than ${CARD_BACK_MAX} characters`)
    if (card.level !== 'se' && card.level !== 'sse') check.fail(`${path}.level`, 'expected "se" or "sse"')
  })
  return check.errors
}

const CASE_REQUIRED = ['id', 'title', 'level', 'minutes', 'summary', 'prompt', 'lessons', 'steps', 'diagram', 'rubric']
export const DIAGRAM_COLS = 6
export const DIAGRAM_ROWS = 5
export const MODEL_LABEL_MAX = 18

/** Validates one content/cases/<id>.json system design case study. `lessonIds` checks cross-links. */
export function validateCase(value: unknown, where = 'case', lessonIds?: Set<string>): string[] {
  const check = new Checker(where)
  if (!isRec(value)) { check.fail('', 'expected object'); return check.errors }
  check.keys(value, '', CASE_REQUIRED)
  if (typeof value.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.id)) check.fail('id', 'expected kebab-case id')
  for (const key of ['title', 'summary', 'prompt']) check.text(value[key], key)
  if (value.level !== 'se' && value.level !== 'sse') check.fail('level', 'expected se or sse')
  if (!Number.isInteger(value.minutes) || (value.minutes as number) < 15 || (value.minutes as number) > 90) check.fail('minutes', 'expected integer 15–90')
  check.texts(value.lessons, 'lessons')
  if (lessonIds && Array.isArray(value.lessons)) value.lessons.forEach((id, index) => { if (!lessonIds.has(id as string)) check.fail(`lessons[${index}]`, `unknown lesson ${String(id)}`) })
  if (!isRec(value.steps)) check.fail('steps', 'expected object')
  else {
    check.keys(value.steps, 'steps', [...STEP_KEYS])
    for (const key of STEP_KEYS) check.texts(value.steps[key], `steps.${key}`, 2)
  }
  const diagram = value.diagram
  if (!isRec(diagram)) check.fail('diagram', 'expected object')
  else {
    check.keys(diagram, 'diagram', ['nodes', 'edges'])
    const ids = new Set<string>()
    const cells = new Set<string>()
    if (!Array.isArray(diagram.nodes) || diagram.nodes.length < 3) check.fail('diagram.nodes', 'expected at least 3 nodes')
    else diagram.nodes.forEach((node, index) => {
      const path = `diagram.nodes[${index}]`
      if (!isRec(node)) return check.fail(path, 'expected object')
      check.keys(node, path, ['id', 'kind', 'label', 'col', 'row'])
      if (typeof node.id !== 'string' || ids.has(node.id)) check.fail(`${path}.id`, 'expected unique id')
      else ids.add(node.id)
      if (!NODE_KINDS.includes(node.kind as NodeKind)) check.fail(`${path}.kind`, 'unknown node kind')
      check.text(node.label, `${path}.label`)
      if (typeof node.label === 'string' && node.label.length > MODEL_LABEL_MAX) check.fail(`${path}.label`, `expected at most ${MODEL_LABEL_MAX} characters`)
      const col = node.col as number, row = node.row as number
      if (!Number.isInteger(col) || col < 0 || col >= DIAGRAM_COLS || !Number.isInteger(row) || row < 0 || row >= DIAGRAM_ROWS) check.fail(path, 'position outside the grid')
      else if (cells.has(`${col},${row}`)) check.fail(path, 'two nodes share a grid cell')
      else cells.add(`${col},${row}`)
    })
    if (!Array.isArray(diagram.edges) || diagram.edges.length < 2) check.fail('diagram.edges', 'expected at least 2 edges')
    else diagram.edges.forEach((edge, index) => {
      const path = `diagram.edges[${index}]`
      if (!isRec(edge)) return check.fail(path, 'expected object')
      check.keys(edge, path, ['from', 'to'], ['label'])
      if (!ids.has(edge.from as string) || !ids.has(edge.to as string) || edge.from === edge.to) check.fail(path, 'edge must join two different nodes')
      if ('label' in edge) check.text(edge.label, `${path}.label`)
    })
  }
  if (!Array.isArray(value.rubric) || value.rubric.length < 5 || value.rubric.length > 10) check.fail('rubric', 'expected 5–10 items')
  else {
    value.rubric.forEach((item, index) => {
      const path = `rubric[${index}]`
      if (!isRec(item)) return check.fail(path, 'expected object')
      check.keys(item, path, ['text'], ['sse'])
      check.text(item.text, `${path}.text`)
      if ('sse' in item && item.sse !== true) check.fail(`${path}.sse`, 'expected true when present')
    })
    if (!value.rubric.some(item => isRec(item) && item.sse)) check.fail('rubric', 'expected at least one SSE item')
  }
  return check.errors
}
