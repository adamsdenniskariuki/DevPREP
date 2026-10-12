import type { Track } from './curriculum-types'

export const TRACK_IDS: readonly Track[] = ['dsa', 'system-design', 'ml', 'behavioral']

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
  check.keys(value, '', PROBLEM_REQUIRED, ['lessonId'])
  if (typeof value.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.id)) check.fail('id', 'expected kebab-case id')
  for (const key of ['title', 'pattern', 'prompt']) check.text(value[key], key)
  if (value.level !== 'se' && value.level !== 'sse') check.fail('level', 'expected se or sse')
  if (!['warm-up', 'core', 'stretch'].includes(value.difficulty as string)) check.fail('difficulty', 'expected warm-up, core or stretch')
  if ('lessonId' in value) check.text(value.lessonId, 'lessonId')
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
