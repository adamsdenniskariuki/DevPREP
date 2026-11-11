import type { ProjectReport, RunPhase } from './runner/runner'

/** What a skill test needs to show and check one coding task. */
export interface TaskExercise {
  title: string
  prompt: string
  starter: string
  /** Read-only tests the run checks against. */
  tests: string
  /** Editor language. */
  lang: 'tsx' | 'ts'
  /** Whether runs render a live preview (React) or only report tests (Node.js). */
  preview: boolean
  /** File the learner edits and the read-only test file, as shown in the workspace. */
  file: string
  testFile: string
  /** Time limit of one run, for the progress bar. */
  limitMs: number
}

export interface TaskRunOptions {
  /** Where a previewing module renders; a detached element when the task has no preview. */
  host: HTMLElement
  title: string
  onPhase: (phase: RunPhase) => void
  onTotal: (total: number) => void
  onProgress: (done: number) => void
}

/** A module whose exercises a skill test can reuse as timed coding tasks. */
export interface TaskModule {
  load(exerciseId: string): Promise<TaskExercise | undefined>
  run(code: string, exercise: TaskExercise, options: TaskRunOptions): Promise<ProjectReport>
}

/**
 * Task runners by module id (SkillTask.module). Add an entry here when a new module (Node, React Native,
 * TypeScript…) offers runnable exercises; everything else in the simulator stays the same.
 */
export const TASK_MODULES: Record<string, TaskModule> = {
  react: {
    async load(exerciseId) {
      const [{ loadReact }, { REACT_TIMEOUT_MS, REACT_APP_FILE, REACT_TEST_FILE }] = await Promise.all([import('./react-module'), import('./runner/react-core')])
      const exercise = (await loadReact()).exercises.find(item => item.id === exerciseId)
      return exercise && { title: exercise.title, prompt: exercise.prompt, starter: exercise.starter, tests: exercise.tests, lang: 'tsx', preview: true, file: REACT_APP_FILE, testFile: REACT_TEST_FILE, limitMs: REACT_TIMEOUT_MS }
    },
    async run(code, exercise, options) {
      const { runReact } = await import('./runner/react-runner')
      return runReact(code, exercise.tests, options)
    },
  },
  node: {
    async load(exerciseId) {
      const [{ loadNode, NODE_FILE, NODE_TEST_FILE }, { PROJECT_TIMEOUT_MS }] = await Promise.all([import('./node-module'), import('./runner/project')])
      const exercise = (await loadNode()).exercises.find(item => item.id === exerciseId)
      return exercise && { title: exercise.title, prompt: exercise.prompt, starter: exercise.starter, tests: exercise.tests, lang: 'ts', preview: false, file: NODE_FILE, testFile: NODE_TEST_FILE, limitMs: PROJECT_TIMEOUT_MS.ts }
    },
    async run(code, exercise, options) {
      const [{ runNodeExercise }, { runProject }] = await Promise.all([import('./node-module'), import('./runner/runner')])
      return runNodeExercise(runProject, code, exercise.tests, options)
    },
  },
  'react-native': {
    async load(exerciseId) {
      const [{ loadReactNative, REACT_NATIVE_FILE, REACT_NATIVE_TEST_FILE }, { PROJECT_TIMEOUT_MS }] = await Promise.all([import('./react-native-module'), import('./runner/project')])
      const exercise = (await loadReactNative()).exercises.find(item => item.id === exerciseId)
      return exercise && { title: exercise.title, prompt: exercise.prompt, starter: exercise.starter, tests: exercise.tests, lang: 'ts', preview: false, file: REACT_NATIVE_FILE, testFile: REACT_NATIVE_TEST_FILE, limitMs: PROJECT_TIMEOUT_MS.ts }
    },
    async run(code, exercise, options) {
      const [{ runReactNativeExercise }, { runProject }] = await Promise.all([import('./react-native-module'), import('./runner/runner')])
      return runReactNativeExercise(runProject, code, exercise.tests, options)
    },
  },
}
