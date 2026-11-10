import { useEffect, useRef, useState } from 'react'
import type { AppModel } from '../app-model'
import { lessons } from '../curriculum'
import { inline } from '../inline'
import { labTolerance, MATH_PACKAGES, MATH_TOPIC_LABELS, mathLabHref, type MathLab } from '../math-labs'
import { runCode, type RunPhase, type RunReport } from '../runner/runner'
import { markDone, type PlanProgress, type StudyPlan } from '../study-plans'
import DiagramFigure from './Diagram'
import Editor from './Editor'
import Icon from './Icon'
import RunResults from './RunResults'
import '../lab.css'

const LOADING_LABEL: Partial<Record<RunPhase, string>> = { 'loading-python': 'Loading Python…', 'loading-numpy': 'Loading Python and NumPy…', running: 'Running…' }
/** Code typed in a lab lasts until the tab closes, so leaving for the plan and coming back keeps it. */
const drafts = new Map<string, string>()

/** Where a lab sits in the plan: the plan items that link to it. */
function planItemsFor(plan: StudyPlan, lab: MathLab) {
  const href = mathLabHref(lab.id)
  return plan.weeks.flatMap(week => week.days.flatMap((day, d) => day.items.filter(item => item.href === href).map(item => ({ item, week: week.n, day: d + 1 }))))
}

/** One math lab at #plans/<plan>/<lab>: a short reading, then a NumPy exercise checked in the browser. */
export default function MathLabView({ app, plan, lab, labs, entry, save }: {
  app: AppModel
  plan: StudyPlan
  lab: MathLab
  labs: MathLab[]
  entry: PlanProgress
  save: (change: (entry: PlanProgress) => PlanProgress) => void
}) {
  const [code, setCode] = useState(() => drafts.get(lab.id) ?? lab.starter)
  const [phase, setPhase] = useState<RunPhase | 'idle'>('idle')
  const [result, setResult] = useState<{ report: RunReport; message?: string }>()
  const live = useRef(true)
  useEffect(() => {
    live.current = true
    return () => { live.current = false }
  }, [])
  // This view loads lazily, after the plans screen has tried to focus the heading.
  useEffect(() => { app.heading.current?.focus() }, [app.heading])
  const where = planItemsFor(plan, lab)
  const ticked = where.length > 0 && where.every(({ item }) => entry.done[item.id])
  const index = labs.findIndex(item => item.id === lab.id)
  const previous = labs[index - 1]
  const next = labs[index + 1]
  const related = (lab.lessons ?? []).map(id => lessons.find(item => item.id === id)).filter(item => item !== undefined)
  const id = `math-${lab.id}`

  function change(value: string) {
    drafts.set(lab.id, value)
    setCode(value)
  }
  async function run() {
    setResult(undefined)
    const report = await runCode('py', { code, name: lab.function, cases: [...lab.tests, ...lab.hiddenTests], tolerance: labTolerance(lab), packages: MATH_PACKAGES }, setPhase)
    if (!live.current) return
    setPhase('idle')
    const passed = report.kind === 'done' && report.outcomes.every(outcome => outcome.pass)
    const tick = passed && where.length > 0 && !ticked
    if (tick) save(current => markDone(current, where.map(({ item }) => item.id), app.today))
    setResult({ report, message: passed ? `All ${report.outcomes.length} tests passed.${tick ? ' The plan task is ticked.' : ''}` : undefined })
  }
  function reset() {
    if (code !== lab.starter && !window.confirm('Replace your code with the starter? Your current code will be lost.')) return
    change(lab.starter)
    setResult(undefined)
  }
  const busy = phase !== 'idle'
  const first = where[0]

  return <>
    <div className="page-heading"><div>
      <div className="eyebrow">MATH LAB · {MATH_TOPIC_LABELS[lab.topic].toUpperCase()}</div>
      <h1 ref={app.heading} tabIndex={-1}>{lab.title}</h1>
      <p className="helper">{lab.summary}</p>
      <p className="helper"><a href={`#plans/${plan.id}`}>Back to {plan.title}</a>{first ? ` · Week ${first.week}, day ${first.day}` : ''} · about {lab.minutes} min{ticked ? ' · Done' : ''}</p>
    </div></div>

    <section className="card plans-section math-lab" aria-labelledby="math-read">
      <h2 id="math-read">Read</h2>
      {lab.intro.map((para, i) => <p key={i}>{inline(para)}</p>)}
      {lab.formula && <pre className="math-formula" role="math" aria-label={`Formula: ${lab.formula}`}><code>{lab.formula}</code></pre>}
      {lab.diagram && <DiagramFigure diagram={lab.diagram} number={1} />}
      {related.length > 0 && <>
        <h3>Go deeper</h3>
        <ul className="lab-links">{related.map(lesson => <li key={lesson.id}>
          <button type="button" className="text-button" onClick={() => app.start(lesson, app.progress.records[lesson.id] ? 'review' : 'learn')}><Icon name="book" size={16} />Lesson: {lesson.title}</button>
        </li>)}</ul>
      </>}
    </section>

    <section className="card plans-section math-lab" aria-labelledby="math-try">
      <h2 id="math-try">Exercise</h2>
      <p>{inline(lab.prompt)}</p>
      <details className="math-hints"><summary>Hints ({lab.hints.length})</summary><ol>{lab.hints.map(hint => <li key={hint}>{inline(hint)}</li>)}</ol></details>
      <div className="lab-runner code-workspace">
        <div className="code-toolbar">
          <label htmlFor={id}>Your code <span className="muted">· Python with NumPy</span></label>
          <button type="button" className="text-button" onClick={reset} disabled={busy}>Reset to starter</button>
        </div>
        <Editor id={id} lang="py" value={code} onChange={change} describedBy={`${id}-help`} />
        <p id={`${id}-help`} className="helper">Implement <code>{lab.function}</code> and return plain numbers, lists or NumPy arrays. Answers match to about six significant figures. Tab indents; press Esc, then Tab, to leave the editor. The first run downloads Python (about 13 MB) and NumPy (about 3 MB), then works offline.</p>
        <div className="button-row"><button type="button" className="primary" onClick={() => { void run() }} disabled={busy}><Icon name="bolt" size={16} />{phase === 'idle' ? 'Run tests' : LOADING_LABEL[phase] ?? 'Running…'}</button></div>
        <div className="run-results" role="status" aria-live="polite">
          {result && <RunResults tests={lab.tests} fn={lab.function} lang="py" report={result.report} message={result.message} />}
        </div>
      </div>
      <details className="math-hints"><summary>Explanation and a model solution</summary>
        <p>{inline(lab.explanation)}</p>
        <pre className="lab-code" tabIndex={0} aria-label="Model solution"><code>{lab.solution}</code></pre>
      </details>
    </section>

    <nav className="math-lab-nav" aria-label="Math labs">
      {previous ? <a href={mathLabHref(previous.id)}>← Previous lab: {previous.title}</a> : <span />}
      {next ? <a href={mathLabHref(next.id)}>Next lab: {next.title} →</a> : <a href={`#plans/${plan.id}`}>Back to the plan →</a>}
    </nav>
  </>
}
