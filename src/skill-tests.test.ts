import { afterEach, describe, expect, it, vi } from 'vitest'
import legacyBackup from '../tests/fixtures/v1-progress.json' with { type: 'json' }
import tests from './generated/skill-tests.json' with { type: 'json' }
import { parseFullBackup, serializeFullBackup } from './board-backup'
import { emptyProgress, serializeBackup } from './progress'
import {
  parseReactProgress, REACT_EXERCISE_IDS, reactCompletedCount, readReactDraft, readReactProgress, recordReactRun, writeReactDraft, writeReactProgress,
} from './react-module'
import {
  NODE_EXERCISE_IDS, nodeCompletedCount, parseNodeProgress, readNodeDraft, readNodeProgress, recordNodeRun, writeNodeDraft, writeNodeProgress,
} from './node-module'
import {
  MAX_RESULTS, newAttempt, parseSkillTests, pickQuestions, readAttempt, readSkillTests, recordResult, scoreAttempt, writeAttempt, writeSkillTests,
  type SkillTest,
} from './skill-tests'
import { TASK_MODULES } from './skill-test-tasks'

const react = (tests as unknown as SkillTest[]).find(test => test.id === 'react')!

function memoryStorage() {
  const items = new Map<string, string>()
  vi.stubGlobal('window', { localStorage: { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => { items.set(key, value) } } })
}
afterEach(() => { vi.unstubAllGlobals() })

describe('skill test content', () => {
  it('has enough questions per topic and tasks that a module can run', () => {
    for (const test of tests as unknown as SkillTest[]) {
      expect(test.pick).toBeLessThanOrEqual(test.questions.length)
      for (const topic of test.topics) expect(test.questions.filter(question => question.topic === topic.id).length).toBeGreaterThanOrEqual(2)
      for (const task of test.tasks) expect(TASK_MODULES[task.module], task.id).toBeDefined()
    }
  })
})

describe('picking and scoring', () => {
  it('draws the same questions for a seed, covering every topic once before repeating', () => {
    const first = pickQuestions(react, 42)
    expect(first).toHaveLength(react.pick)
    expect(new Set(first).size).toBe(react.pick)
    expect(pickQuestions(react, 42)).toEqual(first)
    expect(pickQuestions(react, 43)).not.toEqual(first)
    const topics = new Set(first.map(id => react.questions.find(question => question.id === id)!.topic))
    expect(topics.size).toBe(react.topics.length)
    const perTopic = react.topics.map(topic => first.filter(id => react.questions.find(question => question.id === id)!.topic === topic.id).length)
    expect(Math.max(...perTopic) - Math.min(...perTopic)).toBeLessThanOrEqual(1)
  })

  it('scores answers per topic, marks weak topics and counts passed tasks', () => {
    const attempt = newAttempt(react, 0, 7)
    const [weakTopic] = react.topics
    const answers = Object.fromEntries(attempt.questions.map(id => {
      const question = react.questions.find(item => item.id === id)!
      return [id, question.topic === weakTopic.id ? (question.answer + 1) % 4 : question.answer]
    }))
    const score = scoreAttempt(react, attempt.questions, answers, { [react.tasks[0].id]: 'passed', [react.tasks[1].id]: 'failed' })
    const wrong = attempt.questions.filter(id => react.questions.find(item => item.id === id)!.topic === weakTopic.id).length
    expect(score).toMatchObject({ correct: react.pick - wrong, total: react.pick, tasksPassed: 1, taskTotal: react.tasks.length })
    expect(score.topics.filter(topic => topic.weak).map(topic => topic.topic.id)).toEqual([weakTopic.id])
    expect(scoreAttempt(react, [], {}).percent).toBe(0)
  })
})

describe('attempts and results on the device', () => {
  it('resumes an attempt, dropping answers and code that no longer match the test', () => {
    memoryStorage()
    const attempt = newAttempt(react, 1000, 3)
    const task = react.tasks[0].id
    expect(writeAttempt(react.id, { ...attempt, answers: { [attempt.questions[0]]: 2, gone: 1 }, code: { [task]: 'x', other: 'y' }, tasks: { [task]: 'passed' } })).toBe(true)
    expect(readAttempt(react)).toEqual({ ...attempt, answers: { [attempt.questions[0]]: 2 }, code: { [task]: 'x' }, tasks: { [task]: 'passed' } })
    writeAttempt(react.id, undefined)
    expect(readAttempt(react)).toBeUndefined()
  })

  it('records results newest last and keeps the most recent', () => {
    memoryStorage()
    const score = scoreAttempt(react, pickQuestions(react, 1), {})
    let state = readSkillTests()
    for (let i = 0; i < MAX_RESULTS + 2; i++) state = recordResult(state, react.id, score, `2026-11-${String(i + 1).padStart(2, '0')}`)
    expect(state.react).toHaveLength(MAX_RESULTS)
    expect(state.react.at(-1)!.date).toBe('2026-11-22')
    expect(state.react[0].weak).toEqual(react.topics.map(topic => topic.id))
    expect(writeSkillTests(state)).toBe(true)
    expect(readSkillTests()).toEqual(state)
  })

  it('tracks React exercise runs and drafts', () => {
    memoryStorage()
    const [id] = REACT_EXERCISE_IDS
    const once = recordReactRun(undefined, false, '2026-11-11')
    const passed = recordReactRun(once, true, '2026-11-12')
    expect(passed).toEqual({ attempts: 2, completed: '2026-11-12' })
    expect(recordReactRun(passed, true, '2026-11-13').completed).toBe('2026-11-12')
    expect(writeReactProgress({ [id]: passed })).toBe(true)
    expect(readReactProgress()).toEqual({ [id]: passed })
    expect(reactCompletedCount(readReactProgress())).toBe(1)
    writeReactDraft(id, 'code')
    expect(readReactDraft(id)).toBe('code')
    writeReactDraft(id, undefined)
    expect(readReactDraft(id)).toBeUndefined()
  })
})

describe('React and skill test backups', () => {
  const [id] = REACT_EXERCISE_IDS
  const reactState = { [id]: { attempts: 3, completed: '2026-11-11' } }
  const skillState = { react: [{ date: '2026-11-11', correct: 20, total: 30, tasksPassed: 1, taskTotal: 2, weak: ['react-effects'] }] }

  it('still imports an old backup, which has neither', () => {
    expect(Object.keys(parseFullBackup(JSON.stringify(legacyBackup)))).toEqual(['progress'])
    const progress = emptyProgress()
    expect(serializeFullBackup(progress, undefined, [], {}, {}, { react: {}, skilltests: {} })).toBe(serializeBackup(progress))
  })

  it('round-trips both, alone and alongside other data', () => {
    const text = serializeFullBackup(emptyProgress(), undefined, [], {}, {}, { react: reactState, skilltests: skillState })
    expect(JSON.parse(text)).toMatchObject({ react: reactState, skilltests: skillState })
    expect(parseFullBackup(text)).toMatchObject({ react: reactState, skilltests: skillState })
    expect(parseFullBackup(serializeFullBackup(emptyProgress(), [], [], {}, {}, { skilltests: skillState }))).toMatchObject({ boards: [], skilltests: skillState })
  })

  it('rejects bad entries', () => {
    const base = JSON.parse(serializeBackup(emptyProgress()))
    const bad = (extra: object) => () => parseFullBackup(JSON.stringify({ ...base, ...extra }))
    expect(bad({ react: { nope: { attempts: 1 } } })).toThrow('Invalid backup: unknown React exercise nope.')
    expect(bad({ react: { [id]: { attempts: -1 } } })).toThrow('invalid attempt count')
    expect(bad({ skilltests: { other: [] } })).toThrow('Invalid backup: unknown skill test other.')
    expect(bad({ skilltests: { react: [{ ...skillState.react[0], correct: 31 }] } })).toThrow('invalid score')
    expect(bad({ skilltests: { react: [{ ...skillState.react[0], extra: 1 }] } })).toThrow('unexpected or missing fields')
    expect(() => parseReactProgress([])).toThrow('Invalid backup: React progress must be an object.')
    expect(() => parseSkillTests(null)).toThrow('Invalid backup: skill test results must be an object.')
  })
})

describe('Node.js progress and backups', () => {
  const [id] = NODE_EXERCISE_IDS
  const nodeState = { [id]: { attempts: 2, completed: '2026-11-12' } }

  it('tracks Node.js exercise runs and drafts', () => {
    memoryStorage()
    const passed = recordNodeRun(recordNodeRun(undefined, false, '2026-11-11'), true, '2026-11-12')
    expect(passed).toEqual(nodeState[id])
    expect(writeNodeProgress(nodeState)).toBe(true)
    expect(readNodeProgress()).toEqual(nodeState)
    expect(nodeCompletedCount(readNodeProgress())).toBe(1)
    writeNodeDraft(id, 'code')
    expect(readNodeDraft(id)).toBe('code')
    writeNodeDraft(id, undefined)
    expect(readNodeDraft(id)).toBeUndefined()
  })

  it('omits empty Node.js progress and round-trips it alongside React', () => {
    const progress = emptyProgress()
    expect(serializeFullBackup(progress, undefined, [], {}, {}, { node: {} })).toBe(serializeBackup(progress))
    const text = serializeFullBackup(progress, undefined, [], {}, {}, { react: { [REACT_EXERCISE_IDS[0]]: { attempts: 1 } }, node: nodeState })
    expect(parseFullBackup(text)).toMatchObject({ react: { [REACT_EXERCISE_IDS[0]]: { attempts: 1 } }, node: nodeState })
    expect(parseFullBackup(serializeFullBackup(progress, undefined, [], {}, {}, { node: nodeState }))).toEqual({ progress, node: nodeState })
  })

  it('rejects bad Node.js entries', () => {
    const base = JSON.parse(serializeBackup(emptyProgress()))
    const bad = (extra: object) => () => parseFullBackup(JSON.stringify({ ...base, ...extra }))
    expect(bad({ node: { nope: { attempts: 1 } } })).toThrow('Invalid backup: unknown Node.js exercise nope.')
    expect(bad({ node: { [id]: { attempts: 1, completed: 'soon' } } })).toThrow('invalid completion date')
    expect(() => parseNodeProgress([])).toThrow('Invalid backup: Node.js progress must be an object.')
  })
})