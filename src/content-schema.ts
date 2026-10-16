import type { LabLanguage, Track } from './curriculum-types'
import { PROBLEM_PATTERNS } from './problem-types'
import { NODE_KINDS, STEP_KEYS } from './case-types'
import type { NodeKind } from './case-types'
import { DIAGRAM_TYPES, EDGE_STYLES, FLOW_NODE_KINDS, GUIDE_TOPICS, SNIPPET_LANGS, TIMELINE_KINDS } from './guide-types'

export const TRACK_IDS: readonly Track[] = ['dsa', 'system-design', 'ml', 'ai', 'behavioral', 'python', 'typescript', 'sql']
/** Language tracks and the lab language their lessons run. */
export const LANGUAGE_TRACK_LANG: Partial<Record<Track, LabLanguage>> = { python: 'py', typescript: 'ts', sql: 'sql' }

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
    this.keys(value, path, ['title', 'body'], ['code', 'diagram'])
    this.text(value.title, `${path}.title`)
    this.text(value.body, `${path}.body`)
    if ('code' in value) this.text(value.code, `${path}.code`)
    if ('diagram' in value) this.text(value.diagram, `${path}.diagram`)
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
  check.keys(value, '', LESSON_REQUIRED, ['starter', 'level', 'paths', 'lab'])
  if (typeof value.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.id)) check.fail('id', 'expected kebab-case id')
  if (!TRACK_IDS.includes(value.track as Track)) check.fail('track', 'unknown track')
  const labLang = LANGUAGE_TRACK_LANG[value.track as Track]
  if (labLang) {
    if (value.level !== 'se' && value.level !== 'sse') check.fail('level', 'expected se or sse')
    if ('paths' in value) {
      const paths = value.paths
      if (!Array.isArray(paths) || !paths.length || paths.some(path => path !== 'swe' && path !== 'senior') || new Set(paths).size !== paths.length) check.fail('paths', 'expected a non-empty list of swe/senior')
    }
    if (!('lab' in value)) check.fail('', 'missing "lab"')
    else lab(check, value.lab, labLang, value)
  } else for (const key of ['level', 'paths', 'lab']) if (key in value) check.fail(key, 'only language-track lessons have this key')
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
  check.keys(value, '', ['id', 'title', 'description', 'lessons'], ['kind', 'placement'])
  if (!TRACK_IDS.includes(value.id as Track)) check.fail('id', 'unknown track')
  const language = !!LANGUAGE_TRACK_LANG[value.id as Track]
  if (language !== (value.kind === 'language')) check.fail('kind', language ? 'expected "language"' : 'only language tracks have a kind')
  if (language) placement(check, value.placement, value.lessons)
  else if ('placement' in value) check.fail('placement', 'only language tracks have a placement check')
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

// ---- Field Guide ------------------------------------------------------------------------------
// Limits keep every diagram legible at 360px: short labels, small grids, few actors.
export const FLOW_COLS = 5
export const FLOW_ROWS = 6
export const FLOW_LABEL_MAX = 18
export const FLOW_SUB_MAX = 22
export const EDGE_LABEL_MAX = 22
export const ACTOR_LABEL_MAX = 16
export const MESSAGE_LABEL_MAX = 34
export const CHART_LABEL_MAX = 22
export const TIMELINE_LABEL_MAX = 90
export const MIN_DIAGRAMS = 3
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function maxLength(check: Checker, value: unknown, path: string, max: number) {
  check.text(value, path)
  if (typeof value === 'string' && value.length > max) check.fail(path, `expected at most ${max} characters`)
}

function flowBody(check: Checker, value: Rec, path: string, maxCols = FLOW_COLS, minNodes = 2) {
  const ids = new Set<string>()
  const cells = new Set<string>()
  if (!Array.isArray(value.nodes) || value.nodes.length < minNodes || value.nodes.length > 14) check.fail(`${path}.nodes`, `expected ${minNodes}–14 nodes`)
  else value.nodes.forEach((node, index) => {
    const at = `${path}.nodes[${index}]`
    if (!isRec(node)) return check.fail(at, 'expected object')
    check.keys(node, at, ['id', 'label', 'kind', 'col', 'row'], ['sub'])
    if (typeof node.id !== 'string' || !node.id || ids.has(node.id)) check.fail(`${at}.id`, 'expected unique id')
    else ids.add(node.id)
    maxLength(check, node.label, `${at}.label`, FLOW_LABEL_MAX)
    if ('sub' in node) maxLength(check, node.sub, `${at}.sub`, FLOW_SUB_MAX)
    if (!(FLOW_NODE_KINDS as readonly string[]).includes(node.kind as string)) check.fail(`${at}.kind`, 'unknown node kind')
    const col = node.col as number, row = node.row as number
    if (!Number.isInteger(col) || col < 0 || col >= maxCols || !Number.isInteger(row) || row < 0 || row >= FLOW_ROWS) check.fail(at, `position outside the ${maxCols}x${FLOW_ROWS} grid`)
    else if (cells.has(`${col},${row}`)) check.fail(at, 'two nodes share a grid cell')
    else cells.add(`${col},${row}`)
  })
  if (!Array.isArray(value.edges)) check.fail(`${path}.edges`, 'expected array')
  else value.edges.forEach((edge, index) => {
    const at = `${path}.edges[${index}]`
    if (!isRec(edge)) return check.fail(at, 'expected object')
    check.keys(edge, at, ['from', 'to'], ['label', 'style'])
    if (!ids.has(edge.from as string) || !ids.has(edge.to as string) || edge.from === edge.to) check.fail(at, 'edge must join two different nodes')
    if ('label' in edge) maxLength(check, edge.label, `${at}.label`, EDGE_LABEL_MAX)
    if ('style' in edge && !(EDGE_STYLES as readonly string[]).includes(edge.style as string)) check.fail(`${at}.style`, 'unknown edge style')
  })
}

function diagram(check: Checker, value: unknown, path: string) {
  if (!isRec(value)) return check.fail(path, 'expected object')
  const base = ['type', 'id', 'title', 'alt', 'caption']
  if (typeof value.id !== 'string' || !KEBAB.test(value.id)) check.fail(`${path}.id`, 'expected kebab-case id')
  maxLength(check, value.title, `${path}.title`, 80)
  check.text(value.alt, `${path}.alt`)
  check.text(value.caption, `${path}.caption`)
  if (typeof value.alt === 'string' && value.alt.length < 40) check.fail(`${path}.alt`, 'alt text should describe the picture (40+ characters)')
  switch (value.type) {
    case 'flow': {
      check.keys(value, path, [...base, 'nodes', 'edges'], ['steps'])
      flowBody(check, value, path, FLOW_COLS, 2)
      if (Array.isArray(value.edges) && value.edges.length < 1) check.fail(`${path}.edges`, 'expected at least 1 edge')
      if ('steps' in value) {
        const edgeCount = Array.isArray(value.edges) ? value.edges.length : 0
        if (!Array.isArray(value.steps) || value.steps.length < 2) check.fail(`${path}.steps`, 'expected at least 2 steps')
        else value.steps.forEach((step, index) => {
          const at = `${path}.steps[${index}]`
          if (!isRec(step)) return check.fail(at, 'expected object')
          check.keys(step, at, ['edges', 'text'])
          check.text(step.text, `${at}.text`)
          if (!Array.isArray(step.edges) || !step.edges.length || step.edges.some(item => !Number.isInteger(item) || item < 0 || item >= edgeCount)) check.fail(`${at}.edges`, 'expected edge indexes')
        })
      }
      break
    }
    case 'sequence': {
      check.keys(value, path, [...base, 'actors', 'messages'])
      const ids = new Set<string>()
      if (!Array.isArray(value.actors) || value.actors.length < 2 || value.actors.length > 5) check.fail(`${path}.actors`, 'expected 2–5 actors')
      else value.actors.forEach((actor, index) => {
        const at = `${path}.actors[${index}]`
        if (!isRec(actor)) return check.fail(at, 'expected object')
        check.keys(actor, at, ['id', 'label'])
        if (typeof actor.id !== 'string' || !actor.id || ids.has(actor.id)) check.fail(`${at}.id`, 'expected unique id')
        else ids.add(actor.id)
        maxLength(check, actor.label, `${at}.label`, ACTOR_LABEL_MAX)
      })
      if (!Array.isArray(value.messages) || value.messages.length < 2 || value.messages.length > 14) check.fail(`${path}.messages`, 'expected 2–14 messages')
      else value.messages.forEach((message, index) => {
        const at = `${path}.messages[${index}]`
        if (!isRec(message)) return check.fail(at, 'expected object')
        check.keys(message, at, ['from', 'to', 'label'], ['style', 'note'])
        if (!ids.has(message.from as string) || !ids.has(message.to as string) || message.from === message.to) check.fail(at, 'message must join two different actors')
        maxLength(check, message.label, `${at}.label`, MESSAGE_LABEL_MAX)
        if ('note' in message) check.text(message.note, `${at}.note`)
        if ('style' in message && !(EDGE_STYLES as readonly string[]).includes(message.style as string)) check.fail(`${at}.style`, 'unknown style')
      })
      break
    }
    case 'compare': {
      check.keys(value, path, [...base, 'before', 'after'])
      for (const side of ['before', 'after']) {
        const body = value[side]
        if (!isRec(body)) { check.fail(`${path}.${side}`, 'expected object'); continue }
        check.keys(body, `${path}.${side}`, ['label', 'nodes', 'edges'])
        maxLength(check, body.label, `${path}.${side}.label`, 40)
        flowBody(check, body, `${path}.${side}`, 3, 2)
      }
      break
    }
    case 'chart': {
      check.keys(value, path, [...base, 'x', 'y', 'points'])
      for (const axis of ['x', 'y']) {
        const item = value[axis]
        if (!isRec(item)) { check.fail(`${path}.${axis}`, 'expected object'); continue }
        check.keys(item, `${path}.${axis}`, ['label', 'low', 'high'])
        maxLength(check, item.label, `${path}.${axis}.label`, 30)
        maxLength(check, item.low, `${path}.${axis}.low`, 16)
        maxLength(check, item.high, `${path}.${axis}.high`, 16)
      }
      if (!Array.isArray(value.points) || value.points.length < 2 || value.points.length > 8) check.fail(`${path}.points`, 'expected 2–8 points')
      else {
        const spots = new Set<string>()
        value.points.forEach((point, index) => {
          const at = `${path}.points[${index}]`
          if (!isRec(point)) return check.fail(at, 'expected object')
          check.keys(point, at, ['label', 'x', 'y'], ['highlight'])
          maxLength(check, point.label, `${at}.label`, CHART_LABEL_MAX)
          for (const axis of ['x', 'y']) if (typeof point[axis] !== 'number' || (point[axis] as number) < 0 || (point[axis] as number) > 10) check.fail(`${at}.${axis}`, 'expected 0–10')
          if ('highlight' in point && point.highlight !== true) check.fail(`${at}.highlight`, 'expected true when present')
          const spot = `${Math.round(Number(point.x))},${Math.round(Number(point.y))}`
          if (spots.has(spot)) check.fail(at, 'points overlap; move one at least 1 unit')
          spots.add(spot)
        })
      }
      break
    }
    case 'bars': {
      check.keys(value, path, [...base, 'unit', 'bars'])
      maxLength(check, value.unit, `${path}.unit`, 24)
      if (!Array.isArray(value.bars) || value.bars.length < 2 || value.bars.length > 8) check.fail(`${path}.bars`, 'expected 2–8 bars')
      else value.bars.forEach((bar, index) => {
        const at = `${path}.bars[${index}]`
        if (!isRec(bar)) return check.fail(at, 'expected object')
        check.keys(bar, at, ['label', 'value'], ['highlight'])
        maxLength(check, bar.label, `${at}.label`, CHART_LABEL_MAX)
        if (typeof bar.value !== 'number' || !(bar.value > 0)) check.fail(`${at}.value`, 'expected a positive number')
        if ('highlight' in bar && bar.highlight !== true) check.fail(`${at}.highlight`, 'expected true when present')
      })
      break
    }
    case 'timeline': {
      check.keys(value, path, [...base, 'events'])
      if (!Array.isArray(value.events) || value.events.length < 3 || value.events.length > 14) check.fail(`${path}.events`, 'expected 3–14 events')
      else value.events.forEach((event, index) => {
        const at = `${path}.events[${index}]`
        if (!isRec(event)) return check.fail(at, 'expected object')
        check.keys(event, at, ['at', 'label', 'kind'])
        maxLength(check, event.at, `${at}.at`, 24)
        maxLength(check, event.label, `${at}.label`, TIMELINE_LABEL_MAX)
        if (!(TIMELINE_KINDS as readonly string[]).includes(event.kind as string)) check.fail(`${at}.kind`, 'unknown event kind')
      })
      break
    }
    default: check.fail(`${path}.type`, `expected one of ${DIAGRAM_TYPES.join(', ')}`)
  }
}

function labTests(check: Checker, list: unknown, path: string, min: number) {
  if (!Array.isArray(list) || list.length < min) return check.fail(path, `expected at least ${min} tests`)
  list.forEach((item, index) => {
    const at = `${path}[${index}]`
    if (!isRec(item)) return check.fail(at, 'expected object')
    check.keys(item, at, ['args', 'expected'])
    if (!Array.isArray(item.args)) check.fail(`${at}.args`, 'expected array')
  })
}

function sqlTests(check: Checker, list: unknown, path: string, min: number) {
  if (!Array.isArray(list) || list.length < min) return check.fail(path, `expected at least ${min} tests`)
  const names = new Set<string>()
  list.forEach((item, index) => {
    const at = `${path}[${index}]`
    if (!isRec(item)) return check.fail(at, 'expected object')
    check.keys(item, at, ['name', 'seed', 'expected'])
    check.text(item.name, `${at}.name`)
    if (typeof item.name === 'string') { if (names.has(item.name)) check.fail(`${at}.name`, 'duplicate test name'); names.add(item.name) }
    if (typeof item.seed !== 'string') check.fail(`${at}.seed`, 'expected SQL text (may be empty)')
    const expected = item.expected
    if (!isRec(expected)) return check.fail(`${at}.expected`, 'expected object')
    check.keys(expected, `${at}.expected`, ['columns', 'rows'])
    const columns = expected.columns
    if (!Array.isArray(columns) || !columns.length || columns.some(name => typeof name !== 'string' || !name)) return check.fail(`${at}.expected.columns`, 'expected column names')
    if (!Array.isArray(expected.rows) || expected.rows.some(row => !Array.isArray(row) || row.length !== columns.length)) check.fail(`${at}.expected.rows`, `expected rows of ${columns.length} cells`)
  })
}

/** A SQL exercise: schema DDL, starter and solution SQL, and test cases with seed rows and an expected result. */
function sqlExercise(check: Checker, item: Rec, at: string) {
  check.keys(item, at, ['id', 'schema', 'starter', 'solution', 'tests', 'hiddenTests'], ['ordered', 'check'])
  check.text(item.schema, `${at}.schema`)
  if ('ordered' in item && typeof item.ordered !== 'boolean') check.fail(`${at}.ordered`, 'expected boolean')
  if ('check' in item) check.text(item.check, `${at}.check`)
  sqlTests(check, item.tests, `${at}.tests`, 2)
  sqlTests(check, item.hiddenTests, `${at}.hiddenTests`, 3)
}

/** Validates the lab of a language-track lesson: diagrams, runnable exercises, predict quiz, tip and links. */
function lab(check: Checker, value: unknown, lang: LabLanguage, lesson: Rec) {
  if (!isRec(value)) return check.fail('lab', 'expected object')
  check.keys(value, 'lab', ['lang', 'diagrams', 'exercises', 'predict', 'tip', 'links'])
  if (value.lang !== lang) check.fail('lab.lang', `expected "${lang}" for this track`)
  check.text(value.tip, 'lab.tip')
  const diagramIds = new Set<string>()
  if (!Array.isArray(value.diagrams) || value.diagrams.length < 2) check.fail('lab.diagrams', 'expected at least 2 diagrams')
  else value.diagrams.forEach((item, index) => {
    diagram(check, item, `lab.diagrams[${index}]`)
    if (isRec(item) && typeof item.id === 'string') {
      if (diagramIds.has(item.id)) check.fail(`lab.diagrams[${index}].id`, 'duplicate diagram id')
      diagramIds.add(item.id)
    }
  })
  const used = new Set<string>()
  for (const key of ['concepts', 'walkthrough']) if (Array.isArray(lesson[key])) (lesson[key] as unknown[]).forEach((section, index) => {
    if (!isRec(section) || !('diagram' in section)) return
    const id = section.diagram as string
    if (!diagramIds.has(id)) check.fail(`${key}[${index}].diagram`, 'unknown diagram id')
    else if (used.has(id)) check.fail(`${key}[${index}].diagram`, 'diagram is already shown in another section')
    used.add(id)
  })
  for (const id of diagramIds) if (!used.has(id)) check.fail('lab.diagrams', `diagram ${id} is not placed in any concept or walkthrough section`)
  const stages = new Set(['core', ...(Array.isArray(lesson.extraPractice) ? lesson.extraPractice.map(item => isRec(item) ? item.id : undefined) : [])])
  const seen = new Set<string>()
  if (!Array.isArray(value.exercises) || !value.exercises.length) check.fail('lab.exercises', 'expected at least the core exercise')
  else {
    value.exercises.forEach((item, index) => {
      const at = `lab.exercises[${index}]`
      if (!isRec(item)) return check.fail(at, 'expected object')
      if (lang === 'sql') {
        sqlExercise(check, item, at)
      } else {
        check.keys(item, at, ['id', 'function', 'starter', 'solution', 'tests', 'hiddenTests'], ['typeChecks'])
        if (!IDENT.test(String(item.function))) check.fail(`${at}.function`, 'expected identifier')
        labTests(check, item.tests, `${at}.tests`, 2)
        labTests(check, item.hiddenTests, `${at}.hiddenTests`, 3)
      }
      if ('typeChecks' in item) {
        if (lang !== 'ts') check.fail(`${at}.typeChecks`, 'type checks are for TypeScript labs only')
        else check.text(item.typeChecks, `${at}.typeChecks`)
      }
      if (!stages.has(item.id as string)) check.fail(`${at}.id`, 'expected core or the id of an extra practice item')
      else if (seen.has(item.id as string)) check.fail(`${at}.id`, 'duplicate exercise')
      seen.add(item.id as string)
      check.text(item.starter, `${at}.starter`)
      check.text(item.solution, `${at}.solution`)
    })
    if (!seen.has('core')) check.fail('lab.exercises', 'expected a core exercise')
  }
  if (!Array.isArray(value.predict) || value.predict.length < 2) check.fail('lab.predict', 'expected at least 2 predict-the-output items')
  else value.predict.forEach((item, index) => {
    const at = `lab.predict[${index}]`
    if (!isRec(item)) return check.fail(at, 'expected object')
    check.keys(item, at, ['code', 'choices', 'answer', 'explain'])
    check.text(item.code, `${at}.code`)
    check.text(item.explain, `${at}.explain`)
    const choices = item.choices
    if (!Array.isArray(choices) || choices.length < 2 || choices.length > 4 || choices.some(choice => typeof choice !== 'string') || new Set(choices).size !== choices.length) check.fail(`${at}.choices`, 'expected 2–4 distinct strings')
    else if (!Number.isInteger(item.answer) || (item.answer as number) < 0 || (item.answer as number) >= choices.length) check.fail(`${at}.answer`, 'expected a choice index')
  })
  if (!isRec(value.links)) check.fail('lab.links', 'expected object')
  else {
    check.keys(value.links, 'lab.links', [], ['problems', 'guides', 'lessons'])
    for (const key of ['problems', 'guides', 'lessons']) if (key in value.links) check.texts(value.links[key], `lab.links.${key}`)
  }
}

/** Validates the skip-ahead placement check of a language track. */
function placement(check: Checker, value: unknown, lessons: unknown) {
  const listed = new Set(Array.isArray(lessons) ? lessons : [])
  if (!Array.isArray(value) || value.length < 4) return check.fail('placement', 'expected at least 4 questions')
  value.forEach((item, index) => {
    const at = `placement[${index}]`
    if (!isRec(item)) return check.fail(at, 'expected object')
    check.keys(item, at, ['question', 'choices', 'answer', 'explain', 'lessons'], ['code'])
    maxLength(check, item.question, `${at}.question`, QUIZ_QUESTION_MAX)
    if ('code' in item) check.text(item.code, `${at}.code`)
    check.text(item.explain, `${at}.explain`)
    const choices = item.choices
    if (!Array.isArray(choices) || choices.length < 2 || choices.length > 4 || choices.some(choice => !isText(choice)) || new Set(choices).size !== choices.length) check.fail(`${at}.choices`, 'expected 2–4 distinct strings')
    else if (!Number.isInteger(item.answer) || (item.answer as number) < 0 || (item.answer as number) >= choices.length) check.fail(`${at}.answer`, 'expected a choice index')
    if (!Array.isArray(item.lessons) || !item.lessons.length || item.lessons.some(id => !listed.has(id))) check.fail(`${at}.lessons`, 'expected lesson ids from this track')
  })
}

function snippet(check: Checker, value: unknown, path: string, diagramIds: Set<string>) {
  if (!isRec(value)) return check.fail(path, 'expected object')
  check.keys(value, path, ['label'], ['lang', 'code', 'diagram'])
  maxLength(check, value.label, `${path}.label`, 60)
  if (('code' in value) === ('diagram' in value)) check.fail(path, 'expected exactly one of code or diagram')
  if ('code' in value) check.text(value.code, `${path}.code`)
  if ('lang' in value && !(SNIPPET_LANGS as readonly string[]).includes(value.lang as string)) check.fail(`${path}.lang`, 'unknown language')
  if ('diagram' in value && !diagramIds.has(value.diagram as string)) check.fail(`${path}.diagram`, 'unknown diagram id')
}

export const QUIZ_QUESTION_MAX = 200
export const QUIZ_BACK_MAX = 600
const GUIDE_BASE = ['id', 'kind', 'topic', 'level', 'title', 'summary', 'minutes', 'diagrams', 'interview', 'quiz', 'practice', 'links']
const GUIDE_ONLY = ['principle', 'why', 'examples', 'checklist', 'antipatterns']
const CASE_ONLY = ['organisation', 'year', 'problem', 'constraints', 'decisions', 'failures', 'lessons', 'sources']

/** Validates one content/field-guide/<id>.json guide or case study. Cross-links are checked by the tests. */
export function validateGuide(value: unknown, where = 'guide'): string[] {
  const check = new Checker(where)
  if (!isRec(value)) { check.fail('', 'expected object'); return check.errors }
  const isCase = value.kind === 'case'
  if (value.kind !== 'guide' && !isCase) check.fail('kind', 'expected guide or case')
  check.keys(value, '', [...GUIDE_BASE, ...(isCase ? CASE_ONLY : GUIDE_ONLY)], isCase ? ['caveats'] : [])
  if (typeof value.id !== 'string' || !KEBAB.test(value.id)) check.fail('id', 'expected kebab-case id')
  if (!(GUIDE_TOPICS as readonly string[]).includes(value.topic as string)) check.fail('topic', 'unknown topic')
  if (value.level !== 'se' && value.level !== 'sse') check.fail('level', 'expected se or sse')
  maxLength(check, value.title, 'title', 70)
  maxLength(check, value.summary, 'summary', 220)
  if (!Number.isInteger(value.minutes) || (value.minutes as number) < 5 || (value.minutes as number) > 45) check.fail('minutes', 'expected integer 5–45')
  const diagramIds = new Set<string>()
  if (!Array.isArray(value.diagrams) || value.diagrams.length < MIN_DIAGRAMS) check.fail('diagrams', `expected at least ${MIN_DIAGRAMS} diagrams`)
  else {
    value.diagrams.forEach((item, index) => {
      diagram(check, item, `diagrams[${index}]`)
      if (isRec(item) && typeof item.id === 'string') {
        if (diagramIds.has(item.id)) check.fail(`diagrams[${index}].id`, 'duplicate diagram id')
        diagramIds.add(item.id)
      }
    })
    if (new Set(value.diagrams.map(item => isRec(item) ? item.type : '')).size < 2) check.fail('diagrams', 'expected at least 2 different diagram types')
  }
  check.texts(value.interview, 'interview', 2)
  if (!Array.isArray(value.quiz) || value.quiz.length < 3 || value.quiz.length > 6) check.fail('quiz', 'expected 3–6 questions')
  else value.quiz.forEach((item, index) => {
    const at = `quiz[${index}]`
    if (!isRec(item)) return check.fail(at, 'expected object')
    check.keys(item, at, ['question', 'choices', 'answer', 'explain'])
    maxLength(check, item.question, `${at}.question`, QUIZ_QUESTION_MAX)
    check.text(item.explain, `${at}.explain`)
    const choices = item.choices
    if (!Array.isArray(choices) || choices.length < 3 || choices.length > 4 || choices.some(choice => !isText(choice)) || new Set(choices).size !== choices.length) check.fail(`${at}.choices`, 'expected 3–4 distinct choices')
    else {
      if (!Number.isInteger(item.answer) || (item.answer as number) < 0 || (item.answer as number) >= choices.length) check.fail(`${at}.answer`, 'expected a choice index')
      else if (`${choices[item.answer as number]}. ${String(item.explain)}`.length > QUIZ_BACK_MAX) check.fail(at, `answer plus explanation longer than ${QUIZ_BACK_MAX - 2} characters`)
    }
  })
  if (!isRec(value.practice)) check.fail('practice', 'expected object')
  else {
    check.keys(value.practice, 'practice', ['prompt', 'answer', 'rubric'])
    check.text(value.practice.prompt, 'practice.prompt')
    check.text(value.practice.answer, 'practice.answer')
    check.texts(value.practice.rubric, 'practice.rubric', 3)
  }
  if (!isRec(value.links)) check.fail('links', 'expected object')
  else {
    check.keys(value.links, 'links', [], ['lessons', 'problems', 'cases', 'guides'])
    for (const [key, list] of Object.entries(value.links)) if (!Array.isArray(list) || list.some(item => typeof item !== 'string')) check.fail(`links.${key}`, 'expected string array')
    if (!Object.values(value.links).some(list => Array.isArray(list) && list.length)) check.fail('links', 'expected at least one cross-link')
  }
  if (isCase) {
    maxLength(check, value.organisation, 'organisation', 40)
    if (!Number.isInteger(value.year) || (value.year as number) < 1990 || (value.year as number) > 2100) check.fail('year', 'expected a year')
    check.text(value.problem, 'problem')
    check.text(value.failures, 'failures')
    if ('caveats' in value) check.text(value.caveats, 'caveats')
    check.texts(value.constraints, 'constraints', 2)
    check.texts(value.lessons, 'lessons', 3)
    if (!Array.isArray(value.decisions) || value.decisions.length < 2) check.fail('decisions', 'expected at least 2 decisions')
    else value.decisions.forEach((item, index) => {
      const at = `decisions[${index}]`
      if (!isRec(item)) return check.fail(at, 'expected object')
      check.keys(item, at, ['decision', 'tradeoff'])
      check.text(item.decision, `${at}.decision`)
      check.text(item.tradeoff, `${at}.tradeoff`)
    })
    if (!Array.isArray(value.sources) || value.sources.length < 1) check.fail('sources', 'expected at least 1 source')
    else value.sources.forEach((item, index) => {
      const at = `sources[${index}]`
      if (!isRec(item)) return check.fail(at, 'expected object')
      check.keys(item, at, ['title', 'publisher', 'url'], ['date'])
      check.text(item.title, `${at}.title`)
      check.text(item.publisher, `${at}.publisher`)
      if (typeof item.url !== 'string' || !/^https:\/\/[^\s]+$/.test(item.url)) check.fail(`${at}.url`, 'expected an https URL')
      if ('date' in item && (typeof item.date !== 'string' || !/^\d{4}(-\d{2}(-\d{2})?)?$/.test(item.date))) check.fail(`${at}.date`, 'expected YYYY, YYYY-MM or YYYY-MM-DD')
    })
  } else {
    check.text(value.principle, 'principle')
    check.text(value.why, 'why')
    check.texts(value.checklist, 'checklist', 4)
    if (!Array.isArray(value.examples) || value.examples.length < 1) check.fail('examples', 'expected at least 1 good/bad example')
    else value.examples.forEach((item, index) => {
      const at = `examples[${index}]`
      if (!isRec(item)) return check.fail(at, 'expected object')
      check.keys(item, at, ['title', 'bad', 'good', 'why'])
      check.text(item.title, `${at}.title`)
      check.text(item.why, `${at}.why`)
      snippet(check, item.bad, `${at}.bad`, diagramIds)
      snippet(check, item.good, `${at}.good`, diagramIds)
    })
    if (!Array.isArray(value.antipatterns) || value.antipatterns.length < 2) check.fail('antipatterns', 'expected at least 2 anti-patterns')
    else value.antipatterns.forEach((item, index) => {
      const at = `antipatterns[${index}]`
      if (!isRec(item)) return check.fail(at, 'expected object')
      check.keys(item, at, ['title', 'bad', 'better', 'why'])
      maxLength(check, item.title, `${at}.title`, 80)
      check.text(item.why, `${at}.why`)
      snippet(check, item.bad, `${at}.bad`, diagramIds)
      snippet(check, item.better, `${at}.better`, diagramIds)
    })
  }
  return check.errors
}
