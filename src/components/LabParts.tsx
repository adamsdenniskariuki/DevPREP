import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import DiagramFigure from './Diagram'
import CodeEditor from './CodeEditor'
import Icon from './Icon'
import RunResults from './RunResults'
import SqlLabRunner from './SqlLab'
import { lessons } from '../curriculum'
import { isSqlExercise, type AnyLabExercise, type LabExercise, type Lesson, type LessonLab, type TrackInfo } from '../curriculum-types'
import { problemIndex } from '../problems'
import { guideIndex } from '../guides'
import { runCode, type RunLanguage, type RunPhase, type RunReport } from '../runner/runner'
import type { CodeLanguage } from '../problem-types'
import { inline } from '../inline'
import '../field-guide.css'
import '../lab.css'

/** Runner language for a lab: TypeScript is type-checked and transpiled in its own worker. */
export function runLanguage(lab: LessonLab): RunLanguage {
  return lab.lang === 'ts' ? 'ts' : 'py'
}
/** Editor and result-formatting language: TypeScript reads as JavaScript. */
function displayLanguage(lab: LessonLab): CodeLanguage {
  return lab.lang === 'py' ? 'py' : 'js'
}
const DOWNLOAD_NOTE = { py: ' Python’s first run downloads about 13 MB, then works offline.', ts: ' TypeScript’s first run downloads the compiler (about 3 MB compressed), then works offline.' } as const
const LOADING_LABEL: Partial<Record<RunPhase, string>> = { 'loading-python': 'Loading Python…', 'loading-typescript': 'Loading TypeScript…', running: 'Running…' }
const LANGUAGE_NAME = { py: 'Python', ts: 'TypeScript' } as const

/** A lab diagram, numbered by its place in the lab. */
export function LabDiagram({ lab, id }: { lab: LessonLab; id: string }) {
  const index = lab.diagrams.findIndex(diagram => diagram.id === id)
  if (index < 0) return null
  return <DiagramFigure diagram={lab.diagrams[index]} number={index + 1} />
}

/** "Predict the output": answer every item, then check. Practice only, so nothing is saved. */
export function PredictQuiz({ lab }: { lab: LessonLab }) {
  const [answers, setAnswers] = useState<(number | undefined)[]>([])
  const [checked, setChecked] = useState(false)
  const ready = lab.predict.every((_, i) => answers[i] !== undefined)
  const correct = lab.predict.filter((item, i) => answers[i] === item.answer).length
  return <div className="lab-predict">
    <p className="muted">Read each snippet and pick what it {lab.lang === 'sql' ? 'returns' : 'prints'}. Then check.</p>
    <ol className="fg-questions">
      {lab.predict.map((item, q) => <li key={q}>
        <fieldset disabled={checked}>
          <legend className="sr-only">Snippet {q + 1}: what does it {lab.lang === 'sql' ? 'return' : 'print'}?</legend>
          <pre className="lab-code" tabIndex={0} aria-label={`Snippet ${q + 1}`}><code>{item.code}</code></pre>
          {item.choices.map((choice, c) => {
            const mark = checked ? c === item.answer ? 'right' : answers[q] === c ? 'wrong' : '' : ''
            return <label key={c} className={`fg-choice ${mark}`}>
              <input type="radio" name={`predict-${q}`} checked={answers[q] === c} onChange={() => setAnswers(prev => { const next = [...prev]; next[q] = c; return next })} />
              <code className="lab-output">{choice}</code>
              {mark === 'right' && <span className="fg-mark"><Icon name="check" size={16} /><span className="sr-only">Correct answer</span></span>}
              {mark === 'wrong' && <span className="fg-mark"><Icon name="x" size={16} /><span className="sr-only">Your answer, incorrect</span></span>}
            </label>
          })}
        </fieldset>
        {checked && <p className="fg-explain">{inline(item.explain)}</p>}
      </li>)}
    </ol>
    {checked
      ? <div className="fg-quiz-result" role="status"><strong>{correct} of {lab.predict.length}</strong> right<button type="button" className="text-button" onClick={() => { setAnswers([]); setChecked(false) }}>Try again</button></div>
      : <button type="button" className="primary" disabled={!ready} onClick={() => setChecked(true)}>Check answers</button>}
  </div>
}

/** Interview tip plus links to related DSA problems, Field Guide entries and lessons. */
export function LabTakeaways({ lab, openLesson }: { lab: LessonLab; openLesson: (lesson: Lesson) => void }) {
  const { problems = [], guides = [], lessons: lessonIds = [] } = lab.links
  const items: ReactNode[] = [
    ...problems.map(id => { const item = problemIndex.find(p => p.id === id); return item && <li key={`p-${id}`}><a className="text-button" href={`#code/${id}`}><Icon name="code" size={16} />Problem: {item.title}</a></li> }),
    ...guides.map(id => { const item = guideIndex.find(g => g.id === id); return item && <li key={`g-${id}`}><a className="text-button" href={`#guide/${id}`}><Icon name="compass" size={16} />Field Guide: {item.title}</a></li> }),
    ...lessonIds.map(id => { const item = lessons.find(l => l.id === id); return item && <li key={`l-${id}`}><button type="button" className="text-button" onClick={() => openLesson(item)}><Icon name="book" size={16} />Lesson: {item.title}</button></li> }),
  ].filter(Boolean)
  return <>
    <aside className="lab-tip" aria-label="Interview tip"><strong>Interview tip</strong><p>{inline(lab.tip)}</p></aside>
    {items.length > 0 && <><h3>Practise it</h3><ul className="lab-links">{items}</ul></>}
  </>
}

/**
 * Editor plus test runner for one exercise. The parent owns the code so the core exercise can live in
 * the saved session draft; `onPass` fires when every visible and hidden test passes.
 */
export function LabRunner(props: {
  lab: LessonLab
  exercise: AnyLabExercise
  value: string
  onChange: (value: string) => void
  onPass?: () => void
  label: string
}) {
  const { exercise, ...rest } = props
  return isSqlExercise(exercise) ? <SqlLabRunner exercise={exercise} {...rest} /> : <CodeLabRunner {...props} exercise={exercise} />
}

function CodeLabRunner({ lab, exercise, value, onChange, onPass, label }: {
  lab: LessonLab
  exercise: LabExercise
  value: string
  onChange: (value: string) => void
  onPass?: () => void
  label: string
}) {
  const lang = runLanguage(lab)
  const shown = displayLanguage(lab)
  const [phase, setPhase] = useState<RunPhase | 'idle'>('idle')
  const [result, setResult] = useState<{ report: RunReport; message?: string }>()
  const live = useRef(true)
  useEffect(() => {
    live.current = true
    return () => { live.current = false }
  }, [])
  const id = `lab-${exercise.id}`
  async function run() {
    setResult(undefined)
    const report = await runCode(lang, { code: value, name: exercise.function, cases: [...exercise.tests, ...exercise.hiddenTests], typeChecks: exercise.typeChecks }, setPhase)
    if (!live.current) return
    setPhase('idle')
    const passed = report.kind === 'done' && report.outcomes.every(outcome => outcome.pass) && report.typeChecks?.pass !== false
    const checks = report.kind === 'done' && report.typeChecks ? ' and the type checks' : ''
    setResult({ report, message: passed ? `All ${report.outcomes.length} tests${checks} passed.` : undefined })
    if (passed) onPass?.()
  }
  function reset() {
    if (value !== exercise.starter && !window.confirm('Replace your code with the starter? Your current code will be lost.')) return
    onChange(exercise.starter)
    setResult(undefined)
  }
  const busy = phase !== 'idle'
  return <div className="lab-runner code-workspace">
    <div className="code-toolbar">
      <label htmlFor={id}>{label} <span className="muted">· {LANGUAGE_NAME[lab.lang === 'ts' ? 'ts' : 'py']}</span></label>
      <button type="button" className="text-button" onClick={reset} disabled={busy}>Reset to starter</button>
    </div>
    <CodeEditor id={id} lang={shown} value={value} onChange={onChange} describedBy={`${id}-help`} />
    <p id={`${id}-help`} className="helper">Implement <code>{exercise.function}</code>. Tab indents; press Esc, then Tab, to leave the editor.{DOWNLOAD_NOTE[lab.lang === 'ts' ? 'ts' : 'py']}</p>
    {exercise.typeChecks && <details className="type-checks"><summary>Type checks your types must pass</summary><pre><code>{exercise.typeChecks}</code></pre></details>}
    <div className="button-row"><button type="button" className="primary" onClick={() => { void run() }} disabled={busy}><Icon name="bolt" size={16} />{phase === 'idle' ? 'Run tests' : LOADING_LABEL[phase]}</button></div>
    <div className="run-results" role="status" aria-live="polite">
      {result && <RunResults tests={exercise.tests} fn={exercise.function} lang={shown} typescript={lab.lang === 'ts'} report={result.report} message={result.message} typeChecks={exercise.typeChecks} />}
    </div>
  </div>
}

/** Skip-ahead check for a language track. Lessons answered correctly are marked known and leave the plan. */
export function PlacementCheck({ track, place, done }: {
  track: TrackInfo
  place: (answers: (number | undefined)[]) => { percent: number; known: string[] }
  done: () => void
}) {
  const questions = track.placement ?? []
  const [answers, setAnswers] = useState<(number | undefined)[]>([])
  const [result, setResult] = useState<{ percent: number; known: string[] }>()
  const ready = questions.every((_, i) => answers[i] !== undefined)
  return <section className="card placement fg-quiz" aria-labelledby={`placement-${track.id}`}>
    <h3 id={`placement-${track.id}`}>{track.title} placement check</h3>
    <p className="muted">{questions.length} quick questions. Lessons you clearly know are marked Known and skipped by your plan. They stay open to study.</p>
    <ol className="fg-questions">
      {questions.map((item, q) => <li key={q}>
        <fieldset disabled={!!result}>
          <legend>{inline(item.question)}</legend>
          {item.code && <pre className="lab-code" tabIndex={0} aria-label={`Code for question ${q + 1}`}><code>{item.code}</code></pre>}
          {item.choices.map((choice, c) => {
            const mark = result ? c === item.answer ? 'right' : answers[q] === c ? 'wrong' : '' : ''
            return <label key={c} className={`fg-choice ${mark}`}>
              <input type="radio" name={`placement-${track.id}-${q}`} checked={answers[q] === c} onChange={() => setAnswers(prev => { const next = [...prev]; next[q] = c; return next })} />
              <span>{inline(choice)}</span>
              {mark === 'right' && <span className="fg-mark"><Icon name="check" size={16} /><span className="sr-only">Correct answer</span></span>}
              {mark === 'wrong' && <span className="fg-mark"><Icon name="x" size={16} /><span className="sr-only">Your answer, incorrect</span></span>}
            </label>
          })}
        </fieldset>
        {result && <p className="fg-explain">{inline(item.explain)}</p>}
      </li>)}
    </ol>
    {result
      ? <div className="fg-quiz-result" role="status"><strong>{result.percent}%</strong> · {result.known.length} lesson{result.known.length === 1 ? '' : 's'} marked Known<button type="button" className="text-button" onClick={done}>Close</button></div>
      : <div className="button-row"><button type="button" className="primary" disabled={!ready} onClick={() => setResult(place(answers))}>Check answers</button><button type="button" onClick={done}>Cancel</button></div>}
  </section>
}
