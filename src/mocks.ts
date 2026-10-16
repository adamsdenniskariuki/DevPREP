import { isLanguageTrack, lessons } from './curriculum'
import type { Lesson, LessonLab, Track } from './curriculum-types'
import type { DesignCase } from './case-types'
import type { Problem } from './problem-types'
import type { FieldGuideEntry } from './guide-types'
import { TOPIC_TRACK } from './guide-types'
import { COMPETENCIES, SSE_SIGNALS } from './stories'

export type MockLevel = 'se' | 'sse'
export interface MockQuestion {
  kind: 'problem' | 'case' | 'task' | 'followup' | 'behavioral' | 'guide' | 'trivia'
  /** Problem, case, lesson, Field Guide or competency id the question came from. */
  ref: string
  title: string
  prompt: string
  /** Code shown under the prompt (trivia rounds). */
  code?: string
  answer: string
  rubric: string[]
}
export interface Mock {
  track: Track
  level: MockLevel
  seed: number
  minutes: number
  questions: MockQuestion[]
}

export const MOCK_MINUTES: Record<Track, number> = { dsa: 45, 'system-design': 45, ml: 40, ai: 40, behavioral: 30, python: 30 }
export const STAR_RUBRIC = [
  'Set the situation in two or three sentences',
  'Made your own role and the stakes clear',
  'Described specific actions you took, using “I”',
  'Gave a measurable or observable result',
  'Said what you learned or would change',
]
export const SSE_STAR_RUBRIC = 'Showed impact beyond your own work: scope, influence or growing others'
const FOLLOWUP_RUBRIC = ['Answered directly before adding detail', 'Covered the main point of the model answer', 'Backed it with an example, number or trade-off']

/** Small deterministic PRNG so a mock can be rebuilt from its seed after a reload. */
export function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length)]
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function followUps(pool: Lesson[], count: number, random: () => number, skip?: string): MockQuestion[] {
  const items = shuffle(pool.filter(lesson => lesson.id !== skip), random).slice(0, count)
  return items.map(lesson => {
    const item = pick(lesson.followUps, random)
    return { kind: 'followup', ref: lesson.id, title: lesson.title, prompt: item.question, answer: item.answer, rubric: FOLLOWUP_RUBRIC }
  })
}

export interface MockData {
  problems: Map<string, Problem>
  cases: Map<string, DesignCase>
  /** Field Guide entries. When given, technical mocks add one practice question from a guide on that track. */
  guides?: Map<string, FieldGuideEntry>
  /** Language lesson labs. When given, language mocks become a coding task plus predict-the-output trivia rounds. */
  labs?: Map<string, LessonLab>
}

export const TRIVIA_ROUNDS = 4
const TRIVIA_RUBRIC = ['Predicted the exact output', 'Explained why in one or two sentences']

/** Builds a mock interview for a track from existing content. The same seed always gives the same mock. */
export function buildMock(track: Track, level: MockLevel, seed: number, data: MockData): Mock {
  const random = seeded(seed)
  const trackLessons = lessons.filter(lesson => lesson.track === track)
  const questions: MockQuestion[] = []
  if (track === 'dsa') {
    const all = [...data.problems.values()]
    const pool = all.filter(problem => level === 'sse' ? problem.difficulty !== 'warm-up' : problem.level === 'se')
    const problem = pick(pool.length ? pool : all, random)
    questions.push({
      kind: 'problem', ref: problem.id, title: problem.title, prompt: problem.prompt,
      answer: `${problem.solution.explanation}\n\nTime ${problem.complexity.time}, space ${problem.complexity.space}. ${problem.complexity.notes}`,
      rubric: ['Clarified inputs, outputs and edge cases first', 'Described a brute-force approach and its cost', `Reached ${problem.complexity.time} time and ${problem.complexity.space} space`, 'Wrote working code and traced a test by hand', 'Named the edge cases the solution handles'],
    })
    questions.push(...followUps(trackLessons, 2, random, problem.lessonId))
  } else if (track === 'system-design') {
    const all = [...data.cases.values()]
    const pool = all.filter(item => item.level === level)
    const design = pick(pool.length ? pool : all, random)
    questions.push({
      kind: 'case', ref: design.id, title: design.title, prompt: design.prompt,
      answer: [...design.steps.design, ...design.steps.tradeoffs].map(line => `• ${line}`).join('\n'),
      rubric: design.rubric.filter(item => level === 'sse' || !item.sse).map(item => item.text),
    })
    questions.push(...followUps(trackLessons, 1, random))
  } else if (track === 'behavioral') {
    const signals = COMPETENCIES.filter(item => SSE_SIGNALS.includes(item.id))
    const first = level === 'sse' ? [pick(signals, random)] : []
    const rest = shuffle(COMPETENCIES.filter(item => !first.includes(item)), random).slice(0, 3 - first.length)
    for (const item of [...first, ...rest]) {
      questions.push({
        kind: 'behavioral', ref: item.id, title: item.title, prompt: item.prompt,
        answer: 'Use one story from your bank. Spend about 10% on the situation, 10% on the task, 60% on your actions and 20% on the result and what you learned.',
        rubric: level === 'sse' ? [...STAR_RUBRIC, SSE_STAR_RUBRIC] : STAR_RUBRIC,
      })
    }
  } else if (isLanguageTrack(track) && data.labs) {
    const pool = trackLessons.filter(lesson => level === 'sse' || lesson.level !== 'sse')
    const usable = pool.length ? pool : trackLessons
    const lesson = pick(usable, random)
    const lab = data.labs.get(lesson.id)
    const core = lab?.exercises.find(exercise => exercise.id === 'core')
    questions.push({ kind: 'task', ref: lesson.id, title: lesson.title, prompt: lesson.task, answer: core ? `${lesson.solution}\n\n${core.solution}` : lesson.solution, rubric: lesson.checklist })
    const items = shuffle(usable.flatMap(item => (data.labs!.get(item.id)?.predict ?? []).map(predict => ({ lesson: item, predict }))), random).slice(0, TRIVIA_ROUNDS)
    for (const { lesson: item, predict } of items) {
      questions.push({
        kind: 'trivia', ref: item.id, title: `Trivia: ${item.title}`,
        prompt: 'What does this print?', code: predict.code,
        answer: `${predict.choices[predict.answer]}\n\n${predict.explain}`, rubric: TRIVIA_RUBRIC,
      })
    }
  } else {
    const lesson = pick(trackLessons, random)
    questions.push({ kind: 'task', ref: lesson.id, title: lesson.title, prompt: lesson.task, answer: lesson.solution, rubric: lesson.checklist })
    questions.push(...followUps(trackLessons, 2, random, lesson.id))
  }
  if (track !== 'behavioral' && data.guides) {
    const pool = [...data.guides.values()].filter(entry => TOPIC_TRACK[entry.topic] === track && (level === 'sse' || entry.level === 'se'))
    if (pool.length) {
      const entry = pick(pool, random)
      questions.push({ kind: 'guide', ref: entry.id, title: entry.title, prompt: entry.practice.prompt, answer: entry.practice.answer, rubric: entry.practice.rubric })
    }
  }
  return { track, level, seed, minutes: MOCK_MINUTES[track], questions }
}

/** Percentage of rubric items checked across the whole mock, rounded to a whole number. */
export function mockScore(mock: Pick<Mock, 'questions'>, checked: boolean[][]): number {
  const total = mock.questions.reduce((sum, question) => sum + question.rubric.length, 0)
  const ticked = mock.questions.reduce((sum, question, index) => sum + question.rubric.filter((_, item) => checked[index]?.[item]).length, 0)
  return total ? Math.round(ticked / total * 100) : 0
}
