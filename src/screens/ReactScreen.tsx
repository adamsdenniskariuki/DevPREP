import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { AppModel } from '../app-model'
import Icon from '../components/Icon'
import TaskWorkspace, { reportPassed } from '../components/TaskWorkspace'
import { inline } from '../inline'
import { useBusy, useSaveCheck } from '../relaunch-guard'
import type { ProjectReport, RunPhase } from '../runner/runner'
import { REACT_TIMEOUT_MS } from '../runner/react-core'
import {
  loadReact, MAX_REACT_DRAFT, REACT_EXERCISE_IDS, reactCompletedCount, readReactDraft, readReactProgress, recordReactRun, writeReactDraft, writeReactProgress,
  type ReactContent, type ReactExercise, type ReactLesson, type ReactProgress,
} from '../react-module'
import '../react.css'

export default function ReactScreen({ app, itemId }: { app: AppModel; itemId?: string }) {
  const [content, setContent] = useState<ReactContent>()
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let live = true
    loadReact().then(value => { if (live) setContent(value) }, () => { if (live) setFailed(true) })
    return () => { live = false }
  }, [])
  // This screen is lazy, so it may mount after App's route-change focus has already run.
  useEffect(() => { app.heading.current?.focus() }, [app.heading, itemId, !!content])

  if (failed) return <><Heading app={app} title="React" /><p role="alert">The React module could not load. Check your connection and try again.</p></>
  if (!content) return <><Heading app={app} title="React" /><p role="status">Loading the React module…</p></>
  if (!itemId) return <IndexPage app={app} content={content} />
  const lesson = content.lessons.find(item => item.id === itemId)
  if (lesson) return <LessonPage key={lesson.id} app={app} content={content} lesson={lesson} />
  const exercise = content.exercises.find(item => item.id === itemId)
  if (exercise) return <ExercisePage key={exercise.id} app={app} content={content} exercise={exercise} />
  return <>
    <BackLink />
    <Heading app={app} title="Page not found" />
    <p>That React lesson or exercise does not exist. <a href="#react">Choose one from the list</a>.</p>
  </>
}

function Heading({ app, title, eyebrow = 'LEARN · REACT', children }: { app: AppModel; title: string; eyebrow?: string; children?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1 ref={app.heading} tabIndex={-1}>{title}</h1>{children}</div></div>
}

const BackLink = () => <a className="back-link" href="#react"><Icon name="back" size={16} /> React</a>

/** Paragraphs separated by blank lines; lines starting "- " become a list. */
function Prose({ text }: { text: string }) {
  return <>{text.split(/\n\n+/).map((block, index) => {
    const lines = block.split('\n')
    if (lines.every(line => line.startsWith('- '))) return <ul key={index}>{lines.map((line, i) => <li key={i}>{inline(line.slice(2))}</li>)}</ul>
    return <p key={index}>{lines.map((line, i) => <Fragment key={i}>{i > 0 && <br />}{inline(line)}</Fragment>)}</p>
  })}</>
}

const Code = ({ code, label }: { code: string; label: string }) => <pre className="react-code" tabIndex={0} aria-label={label}><code>{code}</code></pre>

/* ---------- Index ---------- */

function IndexPage({ app, content }: { app: AppModel; content: ReactContent }) {
  const progress = useMemo(readReactProgress, [])
  return <div className="react-module">
    <div className="page-heading">
      <div>
        <div className="eyebrow">LEARN · REACT</div>
        <h1 ref={app.heading} tabIndex={-1}>React</h1>
        <p>Modern React with hooks, React 19 and TypeScript: {content.lessons.length} short lessons with test-style gotchas, then {content.exercises.length} exercises you run in the browser against real tests.</p>
      </div>
      <span className="pill">{reactCompletedCount(progress)} of {REACT_EXERCISE_IDS.length} exercises passed</span>
    </div>
    <section className="card react-callout" aria-labelledby="react-prepare">
      <h2 id="react-prepare">Preparing for a React skill test?</h2>
      <p>Follow the <a href="#plans/react-skill-test-2wk">two-week React plan</a>, drill the <a href="#cards">React flashcards</a>, then sit the <a href="#skilltest/react">timed React skill test</a> under exam conditions.</p>
    </section>
    <section aria-labelledby="react-lessons">
      <h2 id="react-lessons">Lessons</h2>
      <ol className="react-list">
        {content.lessons.map(lesson => {
          const exercises = content.exercises.filter(exercise => exercise.lesson === lesson.id)
          return <li key={lesson.id} className="card">
            <a href={`#react/${lesson.id}`}>{lesson.title}</a>
            <p className="muted">{lesson.summary}</p>
            <span className="code-row-meta">
              <span className="pill">{lesson.minutes} min</span>
              {exercises.length > 0 && <span className="pill">{exercises.filter(exercise => progress[exercise.id]?.completed).length} of {exercises.length} {exercises.length === 1 ? 'exercise' : 'exercises'}</span>}
            </span>
          </li>
        })}
      </ol>
    </section>
    <section aria-labelledby="react-exercises">
      <h2 id="react-exercises">Exercises</h2>
      <p className="muted">Each exercise is a component or hook in <code>App.tsx</code>. Run checks it with React Testing Library-style tests in a sandbox that cannot reach the network, and shows a live preview.</p>
      <ExerciseList exercises={content.exercises} progress={progress} />
    </section>
  </div>
}

function ExerciseList({ exercises, progress }: { exercises: ReactExercise[]; progress: ReactProgress }) {
  return <ul className="react-exercise-list">
    {exercises.map(exercise => {
      const entry = progress[exercise.id]
      return <li key={exercise.id}>
        <a href={`#react/${exercise.id}`}>{exercise.title}</a>
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

function LessonPage({ app, content, lesson }: { app: AppModel; content: ReactContent; lesson: ReactLesson }) {
  const index = content.lessons.indexOf(lesson)
  const next = content.lessons[index + 1]
  const exercises = content.exercises.filter(exercise => exercise.lesson === lesson.id)
  const progress = useMemo(readReactProgress, [])
  return <div className="react-module">
    <BackLink />
    <Heading app={app} title={lesson.title} eyebrow={`REACT · LESSON ${index + 1} OF ${content.lessons.length}`}>
      <p>{inline(lesson.summary)}</p>
      <p className="code-row-meta"><span className="pill">{lesson.minutes} min</span></p>
    </Heading>
    {lesson.sections.map((section, i) => <section key={i} className="card react-section" aria-labelledby={`react-s${i}`}>
      <h2 id={`react-s${i}`}>{section.title}</h2>
      <Prose text={section.body} />
      {section.code && <Code code={section.code} label={`Example: ${section.title}`} />}
    </section>)}
    <section className="card react-section" aria-labelledby="react-pitfalls">
      <h2 id="react-pitfalls">Common pitfalls</h2>
      <ul>{lesson.pitfalls.map((pitfall, i) => <li key={i}>{inline(pitfall)}</li>)}</ul>
    </section>
    <section className="card react-section" aria-labelledby="react-gotchas">
      <h2 id="react-gotchas">Test-style gotchas</h2>
      <p className="muted">Answer each one in your head before you open it.</p>
      <div className="react-gotchas">
        {lesson.gotchas.map((gotcha, i) => <details key={i} className="react-gotcha">
          <summary>{inline(gotcha.question)}</summary>
          {gotcha.code && <Code code={gotcha.code} label={`Code for gotcha ${i + 1}`} />}
          <Prose text={gotcha.answer} />
        </details>)}
      </div>
    </section>
    {exercises.length > 0 && <section className="card react-section" aria-labelledby="react-practise">
      <h2 id="react-practise">Practise</h2>
      <ExerciseList exercises={exercises} progress={progress} />
    </section>}
    <nav className="button-row react-next" aria-label="Lesson navigation">
      {next ? <a className="button primary" href={`#react/${next.id}`}>Next: {next.title}</a> : <a className="button primary" href="#skilltest/react">Take the React skill test</a>}
    </nav>
  </div>
}

/* ---------- Exercise ---------- */

function ExercisePage({ app, content, exercise }: { app: AppModel; content: ReactContent; exercise: ReactExercise }) {
  const lesson = content.lessons.find(item => item.id === exercise.lesson)
  const index = content.exercises.indexOf(exercise)
  const next = content.exercises[index + 1]
  const [code, setCode] = useState(() => readReactDraft(exercise.id) ?? exercise.starter)
  const [progress, setProgress] = useState(() => readReactProgress()[exercise.id])
  const [phase, setPhase] = useState<RunPhase | 'idle'>('idle')
  const [done, setDone] = useState(0)
  const [total, setTotal] = useState<number>()
  const [report, setReport] = useState<ProjectReport>()
  const [saveFailed, setSaveFailed] = useState(false)
  const [showSolution, setShowSolution] = useState(false)
  const preview = useRef<HTMLDivElement>(null)
  const busy = phase !== 'idle'

  useEffect(() => {
    setSaveFailed(!writeReactDraft(exercise.id, code === exercise.starter ? undefined : code))
  }, [exercise, code])
  useSaveCheck(() => saveFailed ? 'Your React exercise draft could not be saved.' : undefined)
  useBusy(busy && 'React tests')

  const run = async () => {
    if (busy || !preview.current) return
    setDone(0)
    setTotal(undefined)
    setReport(undefined)
    try {
      const { runReact } = await import('../runner/react-runner')
      const result = await runReact(code, exercise.tests, { host: preview.current, title: `Live preview of ${exercise.title}`, onPhase: setPhase, onTotal: setTotal, onProgress: setDone })
      setReport(result)
      const all = readReactProgress()
      const entry = recordReactRun(all[exercise.id], reportPassed(result), app.today)
      all[exercise.id] = entry
      if (!writeReactProgress(all)) setSaveFailed(true)
      setProgress(entry)
    } finally {
      setPhase('idle')
    }
  }

  return <div className="react-module">
    <BackLink />
    <Heading app={app} title={exercise.title} eyebrow={`REACT · EXERCISE ${index + 1} OF ${content.exercises.length}`}>
      <p className="code-row-meta">
        <span className="pill">{exercise.minutes} min</span>
        {progress?.completed && <span className="pill solved"><Icon name="check" size={14} />Passed</span>}
        {lesson && <a href={`#react/${lesson.id}`}>Lesson: {lesson.title}</a>}
      </p>
    </Heading>
    <section className="card react-section" aria-labelledby="react-task">
      <h2 id="react-task">The task</h2>
      <Prose text={exercise.prompt} />
      {exercise.hints.length > 0 && <details className="react-hints">
        <summary>Hints ({exercise.hints.length})</summary>
        <ol>{exercise.hints.map((hint, i) => <li key={i}>{inline(hint)}</li>)}</ol>
      </details>}
    </section>
    <TaskWorkspace id="react-editor" lang="tsx" file="App.tsx" testFile="App.test.tsx" code={code} onChange={value => setCode(value.slice(0, MAX_REACT_DRAFT))} tests={exercise.tests}
      phase={phase} done={done} total={total} limitMs={REACT_TIMEOUT_MS} report={report} preview={preview} onRun={() => { void run() }}
      onReset={code === exercise.starter ? undefined : () => { setCode(exercise.starter); setReport(undefined) }}
      helper={saveFailed ? ' Drafts can’t be saved in this browser.' : ''} />
    <section className="card react-section" aria-labelledby="react-solution">
      <h2 id="react-solution">Reference solution</h2>
      {showSolution
        ? <Code code={exercise.solution} label="Reference solution" />
        : <><p>Try the exercise first: open the solution when you have passed or are stuck.</p><button className="text-button" onClick={() => setShowSolution(true)}>Show the solution</button></>}
    </section>
    <nav className="button-row react-next" aria-label="Exercise navigation">
      {next ? <a className="button" href={`#react/${next.id}`}>Next exercise: {next.title}</a> : <a className="button" href="#skilltest/react">Take the React skill test</a>}
    </nav>
  </div>
}
