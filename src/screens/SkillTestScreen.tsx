import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { AppModel } from '../app-model'
import Icon from '../components/Icon'
import TaskWorkspace, { reportPassed } from '../components/TaskWorkspace'
import { inline } from '../inline'
import { useBusy, useSaveCheck } from '../relaunch-guard'
import type { ProjectReport, RunPhase } from '../runner/runner'
import {
  attemptDeadline, loadSkillTests, MAX_TASK_CODE, newAttempt, readAttempt, readSkillTests, recordResult, scoreAttempt, writeAttempt, writeSkillTests,
  type SkillAttempt, type SkillQuestion, type SkillResult, type SkillScore, type SkillTask, type SkillTest,
} from '../skill-tests'
import { TASK_MODULES, type TaskExercise } from '../skill-test-tasks'
import '../skill-test.css'

/**
 * The timed skill-test simulator. Content-driven: each content/skill-tests/<id>.json is one test (multiple-choice
 * questions by topic plus coding tasks borrowed from a module's exercises), so new tests need no new screen code.
 */
export default function SkillTestScreen({ app, testId }: { app: AppModel; testId?: string }) {
  const [tests, setTests] = useState<SkillTest[]>()
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let live = true
    loadSkillTests().then(value => { if (live) setTests(value) }, () => { if (live) setFailed(true) })
    return () => { live = false }
  }, [])
  useEffect(() => { app.heading.current?.focus() }, [app.heading, testId, !!tests])

  if (failed) return <><Heading app={app} title="Skill tests" /><p role="alert">The skill tests could not load. Check your connection and try again.</p></>
  if (!tests) return <><Heading app={app} title="Skill tests" /><p role="status">Loading the skill tests…</p></>
  if (!testId) return <ListPage app={app} tests={tests} />
  const test = tests.find(item => item.id === testId)
  if (!test) return <>
    <BackLink />
    <Heading app={app} title="Test not found" />
    <p>That skill test does not exist. <a href="#skilltest">Choose one from the list</a>.</p>
  </>
  return <TestPage key={test.id} app={app} test={test} />
}

function Heading({ app, title, eyebrow = 'INTERVIEW · SKILL TESTS', children }: { app: AppModel; title: string; eyebrow?: string; children?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1 ref={app.heading} tabIndex={-1}>{title}</h1>{children}</div></div>
}

const BackLink = () => <a className="back-link" href="#skilltest"><Icon name="back" size={16} /> Skill tests</a>

function formatClock(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

const percentOf = (result: Pick<SkillResult, 'correct' | 'total'>) => result.total ? Math.round((result.correct / result.total) * 100) : 0

/* ---------- List ---------- */

function ListPage({ app, tests }: { app: AppModel; tests: SkillTest[] }) {
  const history = useMemo(readSkillTests, [])
  return <div className="skill-test">
    <Heading app={app} title="Skill tests">
      <p>Timed practice tests in the style of an online skill assessment: multiple-choice questions across every topic, plus coding tasks you run against tests. You get a score by topic, explanations, and links to review your weak topics.</p>
    </Heading>
    <ul className="skill-test-list">
      {tests.map(test => {
        const results = history[test.id] ?? []
        const last = results.at(-1)
        return <li key={test.id} className="card">
          <h2><a href={`#skilltest/${test.id}`}>{test.title}</a></h2>
          <p>{inline(test.summary)}</p>
          <p className="code-row-meta">
            <span className="pill">{test.minutes} min</span>
            <span className="pill">{test.pick} questions</span>
            <span className="pill">{test.tasks.length === 1 ? '1 coding task' : `${test.tasks.length} coding tasks`}</span>
            {last && <span className="pill">Last: {percentOf(last)}% on {last.date}</span>}
          </p>
        </li>
      })}
    </ul>
  </div>
}

/* ---------- One test ---------- */

type Finished = { score: SkillScore; attempt: SkillAttempt; saved: boolean }

function TestPage({ app, test }: { app: AppModel; test: SkillTest }) {
  const [attempt, setAttempt] = useState<SkillAttempt | undefined>(() => readAttempt(test))
  const [finished, setFinished] = useState<Finished>()
  const [history, setHistory] = useState<SkillResult[]>(() => readSkillTests()[test.id] ?? [])
  const [saveFailed, setSaveFailed] = useState(false)

  useEffect(() => {
    if (attempt) setSaveFailed(!writeAttempt(test.id, attempt))
  }, [test.id, attempt])
  useSaveCheck(() => saveFailed ? 'Your skill test answers could not be saved.' : undefined)

  const start = () => {
    setFinished(undefined)
    setAttempt(newAttempt(test, Date.now()))
    window.scrollTo(0, 0)
    app.heading.current?.focus()
  }
  const submit = useCallback((current: SkillAttempt) => {
    const score = scoreAttempt(test, current.questions, current.answers, current.tasks)
    const state = recordResult(readSkillTests(), test.id, score, app.today)
    const saved = writeSkillTests(state)
    writeAttempt(test.id, undefined)
    setHistory(state[test.id] ?? [])
    setAttempt(undefined)
    setFinished({ score, attempt: current, saved })
    window.scrollTo(0, 0)
    app.heading.current?.focus()
  }, [test, app.today, app.heading])

  if (finished) return <ResultsPage app={app} test={test} finished={finished} history={history} onRetake={start} />
  if (attempt) return <RunningPage app={app} test={test} attempt={attempt} onChange={setAttempt} onSubmit={submit} saveFailed={saveFailed} />
  return <div className="skill-test">
    <BackLink />
    <Heading app={app} title={test.title}>
      <p>{inline(test.summary)}</p>
    </Heading>
    <section className="card skill-test-section" aria-labelledby="skill-rules">
      <h2 id="skill-rules">How it works</h2>
      <ul>
        <li>You have <strong>{test.minutes} minutes</strong>. The clock keeps running if you leave the page, and the test submits itself when time is up.</li>
        <li><strong>{Math.min(test.pick, test.questions.length)} multiple-choice questions</strong> are drawn from {test.questions.length}, spread across {test.topics.length} topics. Each has exactly one right answer.</li>
        {test.tasks.length > 0 && <li><strong>{test.tasks.length === 1 ? '1 coding task' : `${test.tasks.length} coding tasks`}</strong>: write the code, then run the tests. A task counts when its latest run passes.</li>}
        <li>Your answers save on this device as you go, so you can close the tab and come back before the time runs out.</li>
        <li>Afterwards you see your score by topic, an explanation for every question, and links to review your weak topics.</li>
      </ul>
      <div className="button-row"><button className="primary" onClick={start}><Icon name="clock" size={16} />Start the test</button></div>
    </section>
    {history.length > 0 && <History history={history} test={test} />}
  </div>
}

function History({ history, test }: { history: SkillResult[]; test: SkillTest }) {
  const titles = new Map(test.topics.map(topic => [topic.id, topic]))
  return <section className="card skill-test-section" aria-labelledby="skill-history">
    <h2 id="skill-history">Your previous attempts</h2>
    <div className="skill-table-wrap" tabIndex={0} role="region" aria-labelledby="skill-history">
      <table className="skill-table">
        <thead><tr><th scope="col">Date</th><th scope="col">Questions</th><th scope="col">Coding tasks</th><th scope="col">Weak topics</th></tr></thead>
        <tbody>
          {[...history].reverse().map((result, index) => <tr key={index}>
            <td>{result.date}</td>
            <td>{result.correct} of {result.total} ({percentOf(result)}%)</td>
            <td>{result.tasksPassed} of {result.taskTotal}</td>
            <td>{result.weak.length ? result.weak.map((id, i) => {
              const topic = titles.get(id)
              return <span key={id}>{i > 0 && ', '}{topic ? <a href={topic.review}>{topic.title}</a> : id}</span>
            }) : 'None'}</td>
          </tr>)}
        </tbody>
      </table>
    </div>
  </section>
}

/* ---------- Running ---------- */

function RunningPage({ app, test, attempt, onChange, onSubmit, saveFailed }: {
  app: AppModel; test: SkillTest; attempt: SkillAttempt; onChange: (attempt: SkillAttempt) => void; onSubmit: (attempt: SkillAttempt) => void; saveFailed: boolean
}) {
  const [now, setNow] = useState(() => Date.now())
  const [confirming, setConfirming] = useState(false)
  const deadline = attemptDeadline(test, attempt)
  const left = deadline - now
  const latest = useRef(attempt)
  latest.current = attempt

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])
  useEffect(() => {
    if (left <= 0) onSubmit(latest.current)
  }, [left, onSubmit])
  useBusy('A timed skill test')

  const byId = useMemo(() => new Map(test.questions.map(question => [question.id, question])), [test])
  const questions = attempt.questions.map(id => byId.get(id)).filter((question): question is SkillQuestion => !!question)
  const answered = questions.filter(question => attempt.answers[question.id] !== undefined).length
  const unanswered = questions.length - answered
  const tasksPassed = test.tasks.filter(task => attempt.tasks[task.id] === 'passed').length
  const minutesLeft = Math.ceil(left / 60_000)

  const answer = (id: string, choice: number) => onChange({ ...latest.current, answers: { ...latest.current.answers, [id]: choice } })

  return <div className="skill-test">
    <Heading app={app} title={test.title} eyebrow="SKILL TEST · IN PROGRESS">
      <p>Answer every question, then run the coding tasks. Submit when you are done, or the test submits itself when time is up.</p>
    </Heading>
    <div className="card skill-test-bar" aria-label="Test status">
      <div className={left < 5 * 60_000 ? 'timer warn' : 'timer'} role="timer" aria-label={`Time left, ${minutesLeft === 1 ? '1 minute' : `${minutesLeft} minutes`}`}>{formatClock(left)}</div>
      <span className="pill">{answered} of {questions.length} answered</span>
      {test.tasks.length > 0 && <span className="pill">{tasksPassed} of {test.tasks.length} tasks passed</span>}
      <a href="#skill-submit" className="text-button">Go to submit</a>
    </div>
    {saveFailed && <p role="alert" className="skill-error">Your answers can’t be saved in this browser, so finish the test before you leave the page.</p>}
    <section aria-labelledby="skill-questions">
      <h2 id="skill-questions">Questions</h2>
      <ol className="skill-questions">
        {questions.map((question, index) => <li key={question.id}>
          <QuestionCard question={question} number={index + 1} chosen={attempt.answers[question.id]} onChoose={choice => answer(question.id, choice)} />
        </li>)}
      </ol>
    </section>
    {test.tasks.length > 0 && <section aria-labelledby="skill-tasks" className="skill-tasks">
      <h2 id="skill-tasks">Coding tasks</h2>
      {test.tasks.map((task, index) => <CodingTask key={task.id} task={task} number={index + 1}
        code={attempt.code[task.id]} status={attempt.tasks[task.id]}
        onCode={code => onChange({ ...latest.current, code: { ...latest.current.code, [task.id]: code.slice(0, MAX_TASK_CODE) } })}
        onStatus={status => onChange({ ...latest.current, tasks: { ...latest.current.tasks, [task.id]: status } })} />)}
    </section>}
    <section id="skill-submit" className="card skill-test-section" aria-labelledby="skill-submit-heading" tabIndex={-1}>
      <h2 id="skill-submit-heading">Submit</h2>
      {confirming
        ? <>
          <p role="status">{unanswered ? `${unanswered === 1 ? '1 question is' : `${unanswered} questions are`} still unanswered. ` : ''}You can’t change your answers after you submit.</p>
          <div className="button-row">
            <button className="primary" onClick={() => onSubmit(latest.current)}>Submit now</button>
            <button onClick={() => setConfirming(false)}>Keep going</button>
          </div>
        </>
        : <>
          <p>{unanswered ? `${unanswered === 1 ? '1 question' : `${unanswered} questions`} unanswered.` : 'Every question is answered.'} {test.tasks.length > 0 && `${tasksPassed} of ${test.tasks.length} coding tasks passed.`}</p>
          <div className="button-row"><button className="primary" onClick={() => setConfirming(true)}>Submit the test</button></div>
        </>}
    </section>
  </div>
}

function QuestionCard({ question, number, chosen, onChoose }: { question: SkillQuestion; number: number; chosen?: number; onChoose: (choice: number) => void }) {
  const name = `skill-q-${question.id}`
  return <fieldset className="card skill-question">
    <legend><span className="skill-question-number">Question {number}</span> {inline(question.prompt)}</legend>
    {question.code && <pre className="skill-code" tabIndex={0} aria-label={`Code for question ${number}`}><code>{question.code}</code></pre>}
    <div className="skill-choices">
      {question.choices.map((choice, index) => <label key={index} className="skill-choice">
        <input type="radio" name={name} checked={chosen === index} onChange={() => onChoose(index)} />
        <span>{inline(choice)}</span>
      </label>)}
    </div>
  </fieldset>
}

function CodingTask({ task, number, code, status, onCode, onStatus }: {
  task: SkillTask; number: number; code?: string; status?: 'passed' | 'failed'; onCode: (code: string) => void; onStatus: (status: 'passed' | 'failed') => void
}) {
  const [exercise, setExercise] = useState<TaskExercise | null>()
  const [phase, setPhase] = useState<RunPhase | 'idle'>('idle')
  const [done, setDone] = useState(0)
  const [total, setTotal] = useState<number>()
  const [report, setReport] = useState<ProjectReport>()
  const preview = useRef<HTMLDivElement>(null)
  const busy = phase !== 'idle'
  useBusy(busy && 'Skill test task')

  useEffect(() => {
    let live = true
    const module = TASK_MODULES[task.module]
    if (!module) { setExercise(null); return }
    module.load(task.exercise).then(value => { if (live) setExercise(value ?? null) }, () => { if (live) setExercise(null) })
    return () => { live = false }
  }, [task])

  const heading = <h3 id={`skill-task-${task.id}`}>Task {number}: {task.title.replace(/^Coding task:\s*/i, '')} {status && <span className={status === 'passed' ? 'pill solved' : 'pill'}>{status === 'passed' ? <><Icon name="check" size={14} />Passed</> : 'Not passing yet'}</span>}</h3>
  if (exercise === undefined) return <article className="card skill-task" aria-labelledby={`skill-task-${task.id}`}>{heading}<p role="status">Loading the task…</p></article>
  if (exercise === null) return <article className="card skill-task" aria-labelledby={`skill-task-${task.id}`}>{heading}<p role="alert">This task could not load. Check your connection and try again.</p></article>
  const source = code ?? exercise.starter

  const run = async () => {
    if (busy || !preview.current) return
    setDone(0)
    setTotal(undefined)
    setReport(undefined)
    try {
      const result = await TASK_MODULES[task.module].run(source, exercise, { host: preview.current, title: `Live preview of task ${number}`, onPhase: setPhase, onTotal: setTotal, onProgress: setDone })
      setReport(result)
      onStatus(reportPassed(result) ? 'passed' : 'failed')
    } finally {
      setPhase('idle')
    }
  }

  return <article className="skill-task" aria-labelledby={`skill-task-${task.id}`}>
    <div className="card skill-test-section">
      {heading}
      <div className="skill-task-prompt">{exercise.prompt.split(/\n\n+/).map((block, index) => <p key={index}>{inline(block)}</p>)}</div>
    </div>
    <TaskWorkspace id={`skill-editor-${task.id}`} lang={exercise.lang} file={exercise.file} testFile={exercise.testFile} code={source} onChange={onCode}
      tests={exercise.tests} phase={phase} done={done} total={total} limitMs={exercise.limitMs} report={report} preview={preview} headingLevel={3} label={`Task ${number} code`}
      onRun={() => { void run() }} onReset={code === undefined || code === exercise.starter ? undefined : () => { onCode(exercise.starter); setReport(undefined) }} />
  </article>
}

/* ---------- Results ---------- */

function ResultsPage({ app, test, finished, history, onRetake }: { app: AppModel; test: SkillTest; finished: Finished; history: SkillResult[]; onRetake: () => void }) {
  const { score, attempt, saved } = finished
  const byId = new Map(test.questions.map(question => [question.id, question]))
  const topicTitle = new Map(test.topics.map(topic => [topic.id, topic.title]))
  const questions = attempt.questions.map(id => byId.get(id)).filter((question): question is SkillQuestion => !!question)
  const weak = score.topics.filter(topic => topic.weak)
  return <div className="skill-test">
    <BackLink />
    <Heading app={app} title={`${test.title}: results`} eyebrow="SKILL TEST · RESULTS">
      <p className="skill-score"><strong>{score.percent}%</strong> <span>{score.correct} of {score.total} questions correct{score.taskTotal > 0 && `, ${score.tasksPassed} of ${score.taskTotal} coding tasks passed`}.</span></p>
    </Heading>
    {!saved && <p role="alert" className="skill-error">This result couldn’t be saved in this browser.</p>}
    <section className="card skill-test-section" aria-labelledby="skill-review">
      <h2 id="skill-review">Review next</h2>
      {weak.length
        ? <>
          <p>You scored under 70% in {weak.length === 1 ? 'this topic' : 'these topics'}. Review the lesson, then retake the test.</p>
          <ul className="skill-weak">{weak.map(topic => <li key={topic.topic.id}><a href={topic.topic.review}>{topic.topic.title}</a> <span className="muted">({topic.correct} of {topic.total})</span></li>)}</ul>
        </>
        : <p>No weak topics: you scored at least 70% in every topic. Keep it fresh with the flashcards.</p>}
      <div className="button-row">
        <button className="primary" onClick={onRetake}>Retake the test</button>
        <a className="button" href="#cards">Review flashcards</a>
      </div>
    </section>
    <section className="card skill-test-section" aria-labelledby="skill-topics">
      <h2 id="skill-topics">Score by topic</h2>
      <div className="skill-table-wrap" tabIndex={0} role="region" aria-label="Topic scores table">
        <table className="skill-table">
          <thead><tr><th scope="col">Topic</th><th scope="col">Correct</th><th scope="col">Result</th></tr></thead>
          <tbody>
            {score.topics.map(topic => <tr key={topic.topic.id}>
              <th scope="row"><a href={topic.topic.review}>{topic.topic.title}</a></th>
              <td>{topic.correct} of {topic.total}</td>
              <td>{topic.weak ? <span className="skill-weak-label">Review</span> : 'Good'}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </section>
    <section aria-labelledby="skill-answers">
      <h2 id="skill-answers">Answers and explanations</h2>
      <ol className="skill-questions">
        {questions.map((question, index) => {
          const chosen = attempt.answers[question.id]
          const right = chosen === question.answer
          return <li key={question.id} className="card skill-answer">
            <h3><span className={right ? 'skill-mark right' : 'skill-mark wrong'}><Icon name={right ? 'check' : 'x'} size={16} />{right ? 'Correct' : chosen === undefined ? 'Unanswered' : 'Incorrect'}</span> Question {index + 1} <span className="muted">· {topicTitle.get(question.topic)}</span></h3>
            <p>{inline(question.prompt)}</p>
            {question.code && <pre className="skill-code" tabIndex={0} aria-label={`Code for question ${index + 1}`}><code>{question.code}</code></pre>}
            <ul className="skill-answer-choices">
              {question.choices.map((choice, i) => <li key={i} className={i === question.answer ? 'right' : i === chosen ? 'wrong' : undefined}>
                {inline(choice)}{i === question.answer && <strong> (correct answer)</strong>}{i === chosen && i !== question.answer && <strong> (your answer)</strong>}
              </li>)}
            </ul>
            <p className="skill-explain">{inline(question.explain)}</p>
          </li>
        })}
      </ol>
    </section>
    {history.length > 1 && <History history={history} test={test} />}
  </div>
}
