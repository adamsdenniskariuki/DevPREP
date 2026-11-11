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
  loadNode, MAX_NODE_DRAFT, NODE_EXERCISE_IDS, NODE_FILE, NODE_TEST_FILE, nodeCompletedCount, readNodeDraft, readNodeProgress, recordNodeRun, runNodeExercise, writeNodeDraft, writeNodeProgress,
  type NodeContent, type NodeExercise, type NodeLesson, type NodeProgress,
} from '../node-module'
import '../node.css'

export default function NodeScreen({ app, itemId }: { app: AppModel; itemId?: string }) {
  const [content, setContent] = useState<NodeContent>()
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let live = true
    loadNode().then(value => { if (live) setContent(value) }, () => { if (live) setFailed(true) })
    return () => { live = false }
  }, [])
  // This screen is lazy, so it may mount after App's route-change focus has already run.
  useEffect(() => { app.heading.current?.focus() }, [app.heading, itemId, !!content])

  if (failed) return <><Heading app={app} title="Node.js" /><p role="alert">The Node.js module could not load. Check your connection and try again.</p></>
  if (!content) return <><Heading app={app} title="Node.js" /><p role="status">Loading the Node.js module…</p></>
  if (!itemId) return <IndexPage app={app} content={content} />
  const lesson = content.lessons.find(item => item.id === itemId)
  if (lesson) return <LessonPage key={lesson.id} app={app} content={content} lesson={lesson} />
  const exercise = content.exercises.find(item => item.id === itemId)
  if (exercise) return <ExercisePage key={exercise.id} app={app} content={content} exercise={exercise} />
  return <>
    <BackLink />
    <Heading app={app} title="Page not found" />
    <p>That Node.js lesson or exercise does not exist. <a href="#node">Choose one from the list</a>.</p>
  </>
}

function Heading({ app, title, eyebrow = 'LEARN · NODE.JS', children }: { app: AppModel; title: string; eyebrow?: string; children?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1 ref={app.heading} tabIndex={-1}>{title}</h1>{children}</div></div>
}

const BackLink = () => <a className="back-link" href="#node"><Icon name="back" size={16} /> Node.js</a>

/** Paragraphs separated by blank lines; lines starting "- " become a list. */
function Prose({ text }: { text: string }) {
  return <>{text.split(/\n\n+/).map((block, index) => {
    const lines = block.split('\n')
    if (lines.every(line => line.startsWith('- '))) return <ul key={index}>{lines.map((line, i) => <li key={i}>{inline(line.slice(2))}</li>)}</ul>
    return <p key={index}>{lines.map((line, i) => <Fragment key={i}>{i > 0 && <br />}{inline(line)}</Fragment>)}</p>
  })}</>
}

const Code = ({ code, label }: { code: string; label: string }) => <pre className="node-code" tabIndex={0} aria-label={label}><code>{code}</code></pre>

/* ---------- Index ---------- */

function IndexPage({ app, content }: { app: AppModel; content: NodeContent }) {
  const progress = useMemo(readNodeProgress, [])
  return <div className="node-module">
    <div className="page-heading">
      <div>
        <div className="eyebrow">LEARN · NODE.JS</div>
        <h1 ref={app.heading} tabIndex={-1}>Node.js</h1>
        <p>Node.js for backend interviews and skill tests, written in TypeScript: {content.lessons.length} short lessons with test-style gotchas, then {content.exercises.length} exercises you run in the browser against real tests.</p>
      </div>
      <span className="pill">{nodeCompletedCount(progress)} of {NODE_EXERCISE_IDS.length} exercises passed</span>
    </div>
    <section className="card node-callout" aria-labelledby="node-prepare">
      <h2 id="node-prepare">Preparing for a Node.js skill test?</h2>
      <p>Follow the <a href="#plans/node-skill-test-2wk">two-week Node.js plan</a>, drill the <a href="#cards">Node.js flashcards</a>, then sit the <a href="#skilltest/node">timed Node.js skill test</a> under exam conditions.</p>
    </section>
    <section className="card node-callout" aria-labelledby="node-runs-here">
      <h2 id="node-runs-here">What runs here</h2>
      <p>Exercises run as TypeScript in a sandbox in your browser, not in a real Node.js process. There is no file system, <code>process</code>, <code>Buffer</code> or network, so each exercise models those parts with plain functions and in-memory data. The lessons cover how the real APIs behave.</p>
    </section>
    <section aria-labelledby="node-lessons">
      <h2 id="node-lessons">Lessons</h2>
      <ol className="node-list">
        {content.lessons.map(lesson => {
          const exercises = content.exercises.filter(exercise => exercise.lesson === lesson.id)
          return <li key={lesson.id} className="card">
            <a href={`#node/${lesson.id}`}>{lesson.title}</a>
            <p className="muted">{lesson.summary}</p>
            <span className="code-row-meta">
              <span className="pill">{lesson.minutes} min</span>
              {exercises.length > 0 && <span className="pill">{exercises.filter(exercise => progress[exercise.id]?.completed).length} of {exercises.length} {exercises.length === 1 ? 'exercise' : 'exercises'}</span>}
            </span>
          </li>
        })}
      </ol>
    </section>
    <section aria-labelledby="node-exercises">
      <h2 id="node-exercises">Exercises</h2>
      <p className="muted">Each exercise is a module in <code>index.ts</code>. Run type-checks it and runs the tests in <code>index.test.ts</code> in a sandbox that cannot reach the network.</p>
      <ExerciseList exercises={content.exercises} progress={progress} />
    </section>
  </div>
}

function ExerciseList({ exercises, progress }: { exercises: NodeExercise[]; progress: NodeProgress }) {
  return <ul className="node-exercise-list">
    {exercises.map(exercise => {
      const entry = progress[exercise.id]
      return <li key={exercise.id}>
        <a href={`#node/${exercise.id}`}>{exercise.title}</a>
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

function LessonPage({ app, content, lesson }: { app: AppModel; content: NodeContent; lesson: NodeLesson }) {
  const index = content.lessons.indexOf(lesson)
  const next = content.lessons[index + 1]
  const exercises = content.exercises.filter(exercise => exercise.lesson === lesson.id)
  const progress = useMemo(readNodeProgress, [])
  return <div className="node-module">
    <BackLink />
    <Heading app={app} title={lesson.title} eyebrow={`NODE.JS · LESSON ${index + 1} OF ${content.lessons.length}`}>
      <p>{inline(lesson.summary)}</p>
      <p className="code-row-meta"><span className="pill">{lesson.minutes} min</span></p>
    </Heading>
    {lesson.sections.map((section, i) => <section key={i} className="card node-section" aria-labelledby={`node-s${i}`}>
      <h2 id={`node-s${i}`}>{section.title}</h2>
      <Prose text={section.body} />
      {section.code && <Code code={section.code} label={`Example: ${section.title}`} />}
    </section>)}
    <section className="card node-section" aria-labelledby="node-pitfalls">
      <h2 id="node-pitfalls">Common pitfalls</h2>
      <ul>{lesson.pitfalls.map((pitfall, i) => <li key={i}>{inline(pitfall)}</li>)}</ul>
    </section>
    <section className="card node-section" aria-labelledby="node-gotchas">
      <h2 id="node-gotchas">Test-style gotchas</h2>
      <p className="muted">Answer each one in your head before you open it.</p>
      <div className="node-gotchas">
        {lesson.gotchas.map((gotcha, i) => <details key={i} className="node-gotcha">
          <summary>{inline(gotcha.question)}</summary>
          {gotcha.code && <Code code={gotcha.code} label={`Code for gotcha ${i + 1}`} />}
          <Prose text={gotcha.answer} />
        </details>)}
      </div>
    </section>
    {exercises.length > 0 && <section className="card node-section" aria-labelledby="node-practise">
      <h2 id="node-practise">Practise</h2>
      <ExerciseList exercises={exercises} progress={progress} />
    </section>}
    <nav className="button-row node-next" aria-label="Lesson navigation">
      {next ? <a className="button primary" href={`#node/${next.id}`}>Next: {next.title}</a> : <a className="button primary" href="#skilltest/node">Take the Node.js skill test</a>}
    </nav>
  </div>
}

/* ---------- Exercise ---------- */

function ExercisePage({ app, content, exercise }: { app: AppModel; content: NodeContent; exercise: NodeExercise }) {
  const lesson = content.lessons.find(item => item.id === exercise.lesson)
  const index = content.exercises.indexOf(exercise)
  const next = content.exercises[index + 1]
  const [code, setCode] = useState(() => readNodeDraft(exercise.id) ?? exercise.starter)
  const [progress, setProgress] = useState(() => readNodeProgress()[exercise.id])
  const [phase, setPhase] = useState<RunPhase | 'idle'>('idle')
  const [done, setDone] = useState(0)
  const [total, setTotal] = useState<number>()
  const [report, setReport] = useState<ProjectReport>()
  const [saveFailed, setSaveFailed] = useState(false)
  const [showSolution, setShowSolution] = useState(false)
  const busy = phase !== 'idle'

  useEffect(() => {
    setSaveFailed(!writeNodeDraft(exercise.id, code === exercise.starter ? undefined : code))
  }, [exercise, code])
  useSaveCheck(() => saveFailed ? 'Your Node.js exercise draft could not be saved.' : undefined)
  useBusy(busy && 'Node.js tests')

  const run = async () => {
    if (busy) return
    setDone(0)
    setTotal(undefined)
    setReport(undefined)
    try {
      const { runProject } = await import('../runner/runner')
      const result = await runNodeExercise(runProject, code, exercise.tests, { onPhase: setPhase, onTotal: setTotal, onProgress: setDone })
      setReport(result)
      const all = readNodeProgress()
      const entry = recordNodeRun(all[exercise.id], reportPassed(result), app.today)
      all[exercise.id] = entry
      if (!writeNodeProgress(all)) setSaveFailed(true)
      setProgress(entry)
    } finally {
      setPhase('idle')
    }
  }

  return <div className="node-module">
    <BackLink />
    <Heading app={app} title={exercise.title} eyebrow={`NODE.JS · EXERCISE ${index + 1} OF ${content.exercises.length}`}>
      <p className="code-row-meta">
        <span className="pill">{exercise.minutes} min</span>
        {progress?.completed && <span className="pill solved"><Icon name="check" size={14} />Passed</span>}
        {lesson && <a href={`#node/${lesson.id}`}>Lesson: {lesson.title}</a>}
      </p>
    </Heading>
    <section className="card node-section" aria-labelledby="node-task">
      <h2 id="node-task">The task</h2>
      <Prose text={exercise.prompt} />
      {exercise.hints.length > 0 && <details className="node-hints">
        <summary>Hints ({exercise.hints.length})</summary>
        <ol>{exercise.hints.map((hint, i) => <li key={i}>{inline(hint)}</li>)}</ol>
      </details>}
    </section>
    <TaskWorkspace id="node-editor" lang="ts" file={NODE_FILE} testFile={NODE_TEST_FILE} code={code} onChange={value => setCode(value.slice(0, MAX_NODE_DRAFT))} tests={exercise.tests}
      phase={phase} done={done} total={total} limitMs={PROJECT_TIMEOUT_MS.ts} report={report} onRun={() => { void run() }}
      onReset={code === exercise.starter ? undefined : () => { setCode(exercise.starter); setReport(undefined) }}
      helper={saveFailed ? ' Drafts can’t be saved in this browser.' : ''} />
    <section className="card node-section" aria-labelledby="node-solution">
      <h2 id="node-solution">Reference solution</h2>
      {showSolution
        ? <Code code={exercise.solution} label="Reference solution" />
        : <><p>Try the exercise first: open the solution when you have passed or are stuck.</p><button className="text-button" onClick={() => setShowSolution(true)}>Show the solution</button></>}
    </section>
    <nav className="button-row node-next" aria-label="Exercise navigation">
      {next ? <a className="button" href={`#node/${next.id}`}>Next exercise: {next.title}</a> : <a className="button" href="#skilltest/node">Take the Node.js skill test</a>}
    </nav>
  </div>
}
