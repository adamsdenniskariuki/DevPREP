import { Fragment, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { AppModel } from '../app-model'
import Icon from '../components/Icon'
import TaskWorkspace, { reportPassed } from '../components/TaskWorkspace'
import { inline } from '../inline'
import { useBusy, useSaveCheck } from '../relaunch-guard'
import type { ProjectReport, RunPhase } from '../runner/runner'
import { PROJECT_TIMEOUT_MS } from '../runner/project'
import {
  loadReactNative, MAX_REACT_NATIVE_DRAFT, REACT_NATIVE_EXERCISE_IDS, REACT_NATIVE_FILE, REACT_NATIVE_TEST_FILE, reactNativeCompletedCount, readReactNativeDraft, readReactNativeProgress, recordReactNativeRun, runReactNativeExercise, writeReactNativeDraft, writeReactNativeProgress,
  type ReactNativeContent, type ReactNativeExercise, type ReactNativeLesson, type ReactNativeProgress,
} from '../react-native-module'
import '../react-native.css'

export default function ReactNativeScreen({ app, itemId }: { app: AppModel; itemId?: string }) {
  const [content, setContent] = useState<ReactNativeContent>()
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let live = true
    loadReactNative().then(value => { if (live) setContent(value) }, () => { if (live) setFailed(true) })
    return () => { live = false }
  }, [])
  // This screen is lazy, so it may mount after App's route-change focus has already run.
  useEffect(() => { app.heading.current?.focus() }, [app.heading, itemId, !!content])

  if (failed) return <><Heading app={app} title="React Native" /><p role="alert">The React Native module could not load. Check your connection and try again.</p></>
  if (!content) return <><Heading app={app} title="React Native" /><p role="status">Loading the React Native module…</p></>
  if (!itemId) return <IndexPage app={app} content={content} />
  const lesson = content.lessons.find(item => item.id === itemId)
  if (lesson) return <LessonPage key={lesson.id} app={app} content={content} lesson={lesson} />
  const exercise = content.exercises.find(item => item.id === itemId)
  if (exercise) return <ExercisePage key={exercise.id} app={app} content={content} exercise={exercise} />
  return <>
    <BackLink />
    <Heading app={app} title="Page not found" />
    <p>That React Native lesson or exercise does not exist. <a href="#react-native">Choose one from the list</a>.</p>
  </>
}

function Heading({ app, title, eyebrow = 'LEARN · REACT NATIVE', children }: { app: AppModel; title: string; eyebrow?: string; children?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1 ref={app.heading} tabIndex={-1}>{title}</h1>{children}</div></div>
}

const BackLink = () => <a className="back-link" href="#react-native"><Icon name="back" size={16} /> React Native</a>

/** Paragraphs separated by blank lines; lines starting "- " become a list. */
function Prose({ text }: { text: string }) {
  return <>{text.split(/\n\n+/).map((block, index) => {
    const lines = block.split('\n')
    if (lines.every(line => line.startsWith('- '))) return <ul key={index}>{lines.map((line, i) => <li key={i}>{inline(line.slice(2))}</li>)}</ul>
    return <p key={index}>{lines.map((line, i) => <Fragment key={i}>{i > 0 && <br />}{inline(line)}</Fragment>)}</p>
  })}</>
}

const Code = ({ code, label }: { code: string; label: string }) => <pre className="rn-code" tabIndex={0} aria-label={label}><code>{code}</code></pre>

/* ---------- Index ---------- */

function IndexPage({ app, content }: { app: AppModel; content: ReactNativeContent }) {
  const progress = useMemo(readReactNativeProgress, [])
  return <div className="rn-module">
    <div className="page-heading">
      <div>
        <div className="eyebrow">LEARN · REACT NATIVE</div>
        <h1 ref={app.heading} tabIndex={-1}>React Native</h1>
        <p>React Native for mobile interviews and skill tests, written in TypeScript: {content.lessons.length} short lessons with test-style gotchas, then {content.exercises.length} exercises you run in the browser against real tests.</p>
      </div>
      <span className="pill">{reactNativeCompletedCount(progress)} of {REACT_NATIVE_EXERCISE_IDS.length} exercises passed</span>
    </div>
    <section className="card rn-callout" aria-labelledby="rn-prepare">
      <h2 id="rn-prepare">Preparing for a React Native skill test?</h2>
      <p>Follow the <a href="#plans/react-native-skill-test-2wk">two-week React Native plan</a>, drill the <a href="#cards">React Native flashcards</a>, then sit the <a href="#skilltest/react-native">timed React Native skill test</a> under exam conditions.</p>
    </section>
    <section className="card rn-callout" aria-labelledby="rn-runs-here">
      <h2 id="rn-runs-here">What runs here</h2>
      <p>There is no React Native runtime, device or simulator here. Exercises run as TypeScript in a sandbox in your browser, so each one models app logic (navigation stacks, list windows, storage, offline queues, permission flows) as plain functions and reducers with no native modules, views or network. The lessons cover how the real components and APIs behave on iOS and Android.</p>
    </section>
    <section aria-labelledby="rn-lessons">
      <h2 id="rn-lessons">Lessons</h2>
      <ol className="rn-list">
        {content.lessons.map(lesson => {
          const exercises = content.exercises.filter(exercise => exercise.lesson === lesson.id)
          return <li key={lesson.id} className="card">
            <a href={`#react-native/${lesson.id}`}>{lesson.title}</a>
            <p className="muted">{lesson.summary}</p>
            <span className="code-row-meta">
              <span className="pill">{lesson.minutes} min</span>
              {exercises.length > 0 && <span className="pill">{exercises.filter(exercise => progress[exercise.id]?.completed).length} of {exercises.length} {exercises.length === 1 ? 'exercise' : 'exercises'}</span>}
            </span>
          </li>
        })}
      </ol>
    </section>
    <section aria-labelledby="rn-exercises">
      <h2 id="rn-exercises">Exercises</h2>
      <p className="muted">Each exercise is a module in <code>index.ts</code>. Run type-checks it and runs the tests in <code>index.test.ts</code> in a sandbox that cannot reach the network.</p>
      <ExerciseList exercises={content.exercises} progress={progress} />
    </section>
  </div>
}

function ExerciseList({ exercises, progress }: { exercises: ReactNativeExercise[]; progress: ReactNativeProgress }) {
  return <ul className="rn-exercise-list">
    {exercises.map(exercise => {
      const entry = progress[exercise.id]
      return <li key={exercise.id}>
        <a href={`#react-native/${exercise.id}`}>{exercise.title}</a>
        <span className="code-row-meta">
          <span className="pill">{exercise.minutes} min</span>
          {entry?.completed && <span className="pill solved"><Icon name="check" size={14} />Passed</span>}
          {!entry?.completed && entry?.attempts ? <span className="pill">{entry.attempts === 1 ? '1 run' : `${entry.attempts} runs`}</span> : null}
        </span>
      </li>
    })}
  </ul>
}

/* ---------- Lesson ---------- */

function LessonPage({ app, content, lesson }: { app: AppModel; content: ReactNativeContent; lesson: ReactNativeLesson }) {
  const index = content.lessons.indexOf(lesson)
  const next = content.lessons[index + 1]
  const exercises = content.exercises.filter(exercise => exercise.lesson === lesson.id)
  const progress = useMemo(readReactNativeProgress, [])
  return <div className="rn-module">
    <BackLink />
    <Heading app={app} title={lesson.title} eyebrow={`REACT NATIVE · LESSON ${index + 1} OF ${content.lessons.length}`}>
      <p>{inline(lesson.summary)}</p>
      <p className="code-row-meta"><span className="pill">{lesson.minutes} min</span></p>
    </Heading>
    {lesson.sections.map((section, i) => <section key={i} className="card rn-section" aria-labelledby={`rn-s${i}`}>
      <h2 id={`rn-s${i}`}>{section.title}</h2>
      <Prose text={section.body} />
      {section.code && <Code code={section.code} label={`Example: ${section.title}`} />}
    </section>)}
    <section className="card rn-section" aria-labelledby="rn-pitfalls">
      <h2 id="rn-pitfalls">Common pitfalls</h2>
      <ul>{lesson.pitfalls.map((pitfall, i) => <li key={i}>{inline(pitfall)}</li>)}</ul>
    </section>
    <section className="card rn-section" aria-labelledby="rn-gotchas">
      <h2 id="rn-gotchas">Test-style gotchas</h2>
      <p className="muted">Answer each one in your head before you open it.</p>
      <div className="rn-gotchas">
        {lesson.gotchas.map((gotcha, i) => <details key={i} className="rn-gotcha">
          <summary>{inline(gotcha.question)}</summary>
          {gotcha.code && <Code code={gotcha.code} label={`Code for gotcha ${i + 1}`} />}
          <Prose text={gotcha.answer} />
        </details>)}
      </div>
    </section>
    {exercises.length > 0 && <section className="card rn-section" aria-labelledby="rn-practise">
      <h2 id="rn-practise">Practise</h2>
      <ExerciseList exercises={exercises} progress={progress} />
    </section>}
    <nav className="button-row rn-next" aria-label="Lesson navigation">
      {next ? <a className="button primary" href={`#react-native/${next.id}`}>Next: {next.title}</a> : <a className="button primary" href="#skilltest/react-native">Take the React Native skill test</a>}
    </nav>
  </div>
}

/* ---------- Exercise ---------- */

function ExercisePage({ app, content, exercise }: { app: AppModel; content: ReactNativeContent; exercise: ReactNativeExercise }) {
  const lesson = content.lessons.find(item => item.id === exercise.lesson)
  const index = content.exercises.indexOf(exercise)
  const next = content.exercises[index + 1]
  const [code, setCode] = useState(() => readReactNativeDraft(exercise.id) ?? exercise.starter)
  const [progress, setProgress] = useState(() => readReactNativeProgress()[exercise.id])
  const [phase, setPhase] = useState<RunPhase | 'idle'>('idle')
  const [done, setDone] = useState(0)
  const [total, setTotal] = useState<number>()
  const [report, setReport] = useState<ProjectReport>()
  const [saveFailed, setSaveFailed] = useState(false)
  const [showSolution, setShowSolution] = useState(false)
  const busy = phase !== 'idle'

  useEffect(() => {
    setSaveFailed(!writeReactNativeDraft(exercise.id, code === exercise.starter ? undefined : code))
  }, [exercise, code])
  useSaveCheck(() => saveFailed ? 'Your React Native exercise draft could not be saved.' : undefined)
  useBusy(busy && 'React Native tests')

  const run = async () => {
    if (busy) return
    setDone(0)
    setTotal(undefined)
    setReport(undefined)
    try {
      const { runProject } = await import('../runner/runner')
      const result = await runReactNativeExercise(runProject, code, exercise.tests, { onPhase: setPhase, onTotal: setTotal, onProgress: setDone })
      setReport(result)
      const all = readReactNativeProgress()
      const entry = recordReactNativeRun(all[exercise.id], reportPassed(result), app.today)
      all[exercise.id] = entry
      if (!writeReactNativeProgress(all)) setSaveFailed(true)
      setProgress(entry)
    } finally {
      setPhase('idle')
    }
  }

  return <div className="rn-module">
    <BackLink />
    <Heading app={app} title={exercise.title} eyebrow={`REACT NATIVE · EXERCISE ${index + 1} OF ${content.exercises.length}`}>
      <p className="code-row-meta">
        <span className="pill">{exercise.minutes} min</span>
        {progress?.completed && <span className="pill solved"><Icon name="check" size={14} />Passed</span>}
        {lesson && <a href={`#react-native/${lesson.id}`}>Lesson: {lesson.title}</a>}
      </p>
    </Heading>
    <section className="card rn-section" aria-labelledby="rn-task">
      <h2 id="rn-task">The task</h2>
      <Prose text={exercise.prompt} />
      {exercise.hints.length > 0 && <details className="rn-hints">
        <summary>Hints ({exercise.hints.length})</summary>
        <ol>{exercise.hints.map((hint, i) => <li key={i}>{inline(hint)}</li>)}</ol>
      </details>}
    </section>
    <TaskWorkspace id="rn-editor" lang="ts" file={REACT_NATIVE_FILE} testFile={REACT_NATIVE_TEST_FILE} code={code} onChange={value => setCode(value.slice(0, MAX_REACT_NATIVE_DRAFT))} tests={exercise.tests}
      phase={phase} done={done} total={total} limitMs={PROJECT_TIMEOUT_MS.ts} report={report} onRun={() => { void run() }}
      onReset={code === exercise.starter ? undefined : () => { setCode(exercise.starter); setReport(undefined) }}
      helper={saveFailed ? ' Drafts can’t be saved in this browser.' : ''} />
    <section className="card rn-section" aria-labelledby="rn-solution">
      <h2 id="rn-solution">Reference solution</h2>
      {showSolution
        ? <Code code={exercise.solution} label="Reference solution" />
        : <><p>Try the exercise first: open the solution when you have passed or are stuck.</p><button className="text-button" onClick={() => setShowSolution(true)}>Show the solution</button></>}
    </section>
    <nav className="button-row rn-next" aria-label="Exercise navigation">
      {next ? <a className="button" href={`#react-native/${next.id}`}>Next exercise: {next.title}</a> : <a className="button" href="#skilltest/react-native">Take the React Native skill test</a>}
    </nav>
  </div>
}
