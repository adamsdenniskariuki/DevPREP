import { useEffect, useRef, useState } from 'react'
import type { AppModel } from '../app-model'
import Icon from '../components/Icon'
import CodeEditor from '../components/CodeEditor'
import { lessons } from '../curriculum'
import { clearDraft, readDraft, writeDraft } from '../code-drafts'
import { loadProblems, problemIndex, problemPatterns } from '../problems'
import type { CodeLanguage, Problem, ProblemSummary } from '../problem-types'
import { formatArgs, formatValue, TIMEOUT_MS, type CaseOutcome } from '../runner/core'
import { runCode, type RunPhase, type RunReport } from '../runner/runner'

const LANGS: { id: CodeLanguage; label: string }[] = [{ id: 'js', label: 'JavaScript' }, { id: 'py', label: 'Python' }]
const DIFFICULTY: Record<ProblemSummary['difficulty'], string> = { 'warm-up': 'Warm-up', core: 'Core', stretch: 'Stretch' }

/** Renders plain prompt text: blank lines split paragraphs, "- " lines become a list. */
function TextBlocks({ text }: { text: string }) {
  return <>{text.split(/\n\s*\n/).map((block, index) => {
    const lines = block.split('\n').map(line => line.trim()).filter(Boolean)
    return lines.every(line => line.startsWith('- '))
      ? <ul key={index}>{lines.map(line => <li key={line}>{line.slice(2)}</li>)}</ul>
      : <p key={index}>{lines.join(' ')}</p>
  })}</>
}

function SolvedMarks({ solved }: { solved: Partial<Record<CodeLanguage, string>> | undefined }) {
  if (!solved) return null
  return <span className="solved-marks">{LANGS.filter(lang => solved[lang.id]).map(lang => <span key={lang.id} className="pill solved"><Icon name="check" size={14} />{lang.id === 'js' ? 'JS' : 'Python'}</span>)}</span>
}

export default function CodeScreen({ app, problemId }: { app: AppModel; problemId?: string }) {
  const summary = problemIndex.find(problem => problem.id === problemId)
  // This screen is lazy, so it may mount after App's route-change focus has already run.
  useEffect(() => { app.heading.current?.focus() }, [app.heading, summary?.id])
  return summary ? <ProblemPage key={summary.id} app={app} summary={summary} /> : <ProblemList app={app} />
}

function ProblemList({ app }: { app: AppModel }) {
  const { progress, heading } = app
  const [level, setLevel] = useState<'all' | 'se' | 'sse'>('all')
  const shown = problemIndex.filter(problem => level === 'all' || problem.level === level)
  const solvedCount = problemIndex.filter(problem => progress.solved?.[problem.id]).length
  return <>
    <div className="page-heading"><div><div className="eyebrow">PRACTICE · CODE</div><h1 ref={heading} tabIndex={-1}>Code runner</h1><p>Original problems in JavaScript or Python. Tests run on your device.</p></div><span className="pill">{solvedCount} of {problemIndex.length} solved</span></div>
    <fieldset className="field">
      <legend>Level</legend>
      <div className="chip-group">
        {([['all', 'All'], ['se', 'SE'], ['sse', 'SSE stretch']] as const).map(([id, label]) => <label key={id} className="chip"><input type="radio" name="code-level" checked={level === id} onChange={() => setLevel(id)} />{label}</label>)}
      </div>
    </fieldset>
    {problemPatterns().map(pattern => {
      const items = shown.filter(problem => problem.pattern === pattern)
      if (!items.length) return null
      return <section key={pattern} className="code-group" aria-labelledby={`pattern-${pattern}`}>
        <h2 className="section-title" id={`pattern-${pattern}`}>{pattern}</h2>
        <ul className="card code-list">
          {items.map(problem => <li key={problem.id} className="code-row">
            <a href={`#code/${problem.id}`}>{problem.title}</a>
            <span className="code-row-meta">
              <span className="pill">{DIFFICULTY[problem.difficulty]}</span>
              {problem.level === 'sse' && <span className="pill">SSE</span>}
              <SolvedMarks solved={progress.solved?.[problem.id]} />
            </span>
          </li>)}
        </ul>
      </section>
    })}
  </>
}

function ProblemPage({ app, summary }: { app: AppModel; summary: ProblemSummary }) {
  const [problem, setProblem] = useState<Problem>()
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    loadProblems().then(all => { if (live) setProblem(all.get(summary.id)) }, () => { if (live) setError('This problem could not be loaded. Reconnect and try again.') })
    return () => { live = false }
  }, [summary.id])
  return <>
    <a className="back-link" href="#code"><Icon name="back" size={16} /> All problems</a>
    <div className="page-heading"><div><div className="eyebrow">{summary.pattern.toUpperCase()} · {DIFFICULTY[summary.difficulty].toUpperCase()}{summary.level === 'sse' ? ' · SSE' : ''}</div><h1 ref={app.heading} tabIndex={-1}>{summary.title}</h1></div><SolvedMarks solved={app.progress.solved?.[summary.id]} /></div>
    {error ? <div className="alert" role="alert">{error}</div> : problem ? <Workspace app={app} problem={problem} /> : <p role="status">Loading problem…</p>}
  </>
}

function Workspace({ app, problem }: { app: AppModel; problem: Problem }) {
  const [lang, setLang] = useState<CodeLanguage>(() => readDraft(problem.id).lang ?? 'js')
  const [code, setCode] = useState<Record<CodeLanguage, string>>(() => {
    const draft = readDraft(problem.id)
    return { js: draft.js ?? problem.starter.js, py: draft.py ?? problem.starter.py }
  })
  const [phase, setPhase] = useState<RunPhase | 'idle'>('idle')
  const [result, setResult] = useState<{ lang: CodeLanguage; report: RunReport; message?: string }>()
  const [hints, setHints] = useState(0)
  const [saveFailed, setSaveFailed] = useState(false)
  const live = useRef(true)
  useEffect(() => () => { live.current = false }, [])
  const lesson = lessons.find(item => item.id === problem.lessonId)
  const fn = problem.function[lang]

  function chooseLang(next: CodeLanguage) {
    setLang(next)
    setSaveFailed(!writeDraft(problem.id, { lang: next }))
  }

  function edit(value: string) {
    setCode(current => ({ ...current, [lang]: value }))
    setSaveFailed(!writeDraft(problem.id, { lang, [lang]: value }))
  }

  function reset() {
    if (code[lang] !== problem.starter[lang] && !window.confirm('Replace your code with the starter? Your current code will be lost.')) return
    setCode(current => ({ ...current, [lang]: problem.starter[lang] }))
    setSaveFailed(!clearDraft(problem.id, lang))
  }

  async function run() {
    const runLang = lang
    setResult(undefined)
    const report = await runCode(runLang, { code: code[runLang], name: problem.function[runLang], cases: [...problem.tests, ...problem.hiddenTests] }, setPhase)
    if (!live.current) return
    setPhase('idle')
    let message: string | undefined
    if (report.kind === 'done' && report.outcomes.every(outcome => outcome.pass)) {
      const gained = app.solveProblem(problem.id, runLang)
      message = `All ${report.outcomes.length} tests passed${gained ? ` · +${gained} XP` : ''}.`
    }
    setResult({ lang: runLang, report, message })
  }

  const busy = phase !== 'idle'
  return <div className="code-workspace">
    <section className="card code-brief" aria-labelledby="brief-title">
      <h2 id="brief-title" className="sr-only">Problem</h2>
      <TextBlocks text={problem.prompt} />
      <h3>Examples</h3>
      <ul className="example-list">
        {problem.tests.map((test, index) => <li key={index}><code>{fn}({formatArgs(test.args, lang)})</code> <span aria-hidden="true">→</span><span className="sr-only">returns</span> <code>{formatValue(test.expected, lang)}</code></li>)}
      </ul>
      {lesson && <p className="helper">Related lesson: <button className="text-button" onClick={() => app.start(lesson, app.progress.records[lesson.id] ? 'review' : 'learn')}>{lesson.title}</button></p>}
      <section className="code-hints" aria-labelledby="hints-title">
        <h3 id="hints-title">Hints</h3>
        {hints > 0 && <ol>{problem.hints.slice(0, hints).map(hint => <li key={hint}>{hint}</li>)}</ol>}
        {hints < problem.hints.length && <button onClick={() => setHints(hints + 1)}>Show hint {hints + 1} of {problem.hints.length}</button>}
      </section>
      <details className="code-solution">
        <summary>Solution and complexity</summary>
        <p>{problem.solution.explanation}</p>
        <pre><code>{problem.solution[lang]}</code></pre>
        <dl className="complexity">
          <div><dt>Time</dt><dd>{problem.complexity.time}</dd></div>
          <div><dt>Space</dt><dd>{problem.complexity.space}</dd></div>
        </dl>
        <p className="helper">{problem.complexity.notes}</p>
        <h3>Follow-ups</h3>
        <ul>{problem.followUps.map(item => <li key={item}>{item}</li>)}</ul>
      </details>
    </section>

    <section className="card code-panel" aria-labelledby="editor-title">
      <div className="code-toolbar">
        <h2 id="editor-title" className="sr-only">Your solution</h2>
        <div className="segmented" role="radiogroup" aria-label="Language">
          {LANGS.map(item => <label key={item.id} className="chip"><input type="radio" name="code-lang" checked={lang === item.id} onChange={() => chooseLang(item.id)} disabled={busy} />{item.label}</label>)}
        </div>
        <button className="text-button" onClick={reset} disabled={busy}>Reset to starter</button>
      </div>
      <label htmlFor="code-editor" className="sr-only">{lang === 'js' ? 'JavaScript' : 'Python'} code</label>
      <CodeEditor id="code-editor" lang={lang} value={code[lang]} onChange={edit} describedBy="editor-help" />
      <p id="editor-help" className="helper">Tab indents. Press Esc, then Tab, to leave the editor.{lang === 'py' ? ' Python’s first run downloads about 13 MB, then works offline.' : ''}{saveFailed ? ' Drafts can’t be saved in this browser.' : ''}</p>
      <div className="button-row">
        <button className="primary" onClick={() => { void run() }} disabled={busy}><Icon name="bolt" size={16} />{phase === 'loading-python' ? 'Loading Python…' : phase === 'running' ? 'Running…' : 'Run tests'}</button>
      </div>
      <div className="run-results" role="status" aria-live="polite">
        {result && <Results problem={problem} lang={result.lang} report={result.report} message={result.message} />}
      </div>
    </section>
  </div>
}

function describeActual(outcome: CaseOutcome, lang: CodeLanguage) {
  return outcome.actual === undefined ? (lang === 'py' ? 'None' : 'undefined') : formatValue(JSON.parse(outcome.actual), lang)
}

function Results({ problem, lang, report, message }: { problem: Problem; lang: CodeLanguage; report: RunReport; message?: string }) {
  if (report.kind === 'timeout') return <div className="run-summary fail"><strong>Stopped after {TIMEOUT_MS[lang] / 1000} seconds.</strong> Check for an infinite loop or a slower-than-needed approach.</div>
  if (report.kind === 'load-error') return <div className="run-summary fail"><strong>Python could not start.</strong> {report.error}</div>
  if (report.kind === 'error') return <><div className="run-summary fail"><strong>Your code didn’t run.</strong><pre>{report.error}</pre></div>{report.output && <Output text={report.output} />}</>
  const visible = report.outcomes.slice(0, problem.tests.length)
  const hidden = report.outcomes.slice(problem.tests.length)
  const passed = report.outcomes.filter(outcome => outcome.pass).length
  const fn = problem.function[lang]
  return <>
    <div className={message ? 'run-summary pass' : 'run-summary fail'}><strong>{message ?? `${passed} of ${report.outcomes.length} tests passed.`}</strong></div>
    <ul className="test-results">
      {visible.map((outcome, index) => <li key={index} className={outcome.pass ? 'pass' : 'fail'}>
        <span className="test-status"><Icon name={outcome.pass ? 'check' : 'x'} size={16} />{outcome.pass ? 'Passed' : 'Failed'}</span>
        <code className="test-call">{fn}({formatArgs(problem.tests[index].args, lang)})</code>
        {!outcome.pass && <dl>
          <div><dt>Expected</dt><dd><code>{formatValue(problem.tests[index].expected, lang)}</code></dd></div>
          {outcome.error ? <div><dt>Error</dt><dd><pre>{outcome.error}</pre></dd></div> : <div><dt>Got</dt><dd><code>{describeActual(outcome, lang)}</code></dd></div>}
        </dl>}
      </li>)}
      <li className={hidden.every(outcome => outcome.pass) ? 'pass' : 'fail'}>
        <span className="test-status"><Icon name={hidden.every(outcome => outcome.pass) ? 'check' : 'x'} size={16} />Hidden tests</span>
        <span>{hidden.filter(outcome => outcome.pass).length} of {hidden.length} passed{hidden.some(outcome => outcome.error) ? ' · some raised errors' : ''}</span>
      </li>
    </ul>
    {report.output && <Output text={report.output} />}
  </>
}

function Output({ text }: { text: string }) {
  return <details className="run-output" open><summary>Console output</summary><pre>{text}</pre></details>
}
