import { useEffect, useRef, useState } from 'react'
import Editor from './Editor'
import Icon from './Icon'
import type { SqlExercise, SqlLabTest } from '../curriculum-types'
import type { RunPhase, SqlReport } from '../runner/runner'
import { runSqlCode } from '../runner/runner'
import { formatCell, SQL_TIMEOUT_MS, type SqlCaseOutcome } from '../runner/sql-core'
import '../lab.css'

const SHOWN_ROWS = 12

export function ResultTable({ caption, columns, rows }: { caption: string; columns: string[]; rows: unknown[][] }) {
  return <div className="sql-table-wrap" tabIndex={0} role="region" aria-label={caption}>
    <table className="sql-table">
      <caption>{caption}</caption>
      <thead><tr>{columns.map((name, index) => <th key={index} scope="col">{name}</th>)}</tr></thead>
      <tbody>
        {rows.slice(0, SHOWN_ROWS).map((row, r) => <tr key={r}>{row.map((cell, c) => <td key={c} className={cell === null ? 'sql-null' : undefined}>{formatCell(cell)}</td>)}</tr>)}
        {rows.length === 0 && <tr><td colSpan={Math.max(1, columns.length)} className="muted">(no rows)</td></tr>}
      </tbody>
    </table>
    {rows.length > SHOWN_ROWS && <p className="muted">…and {rows.length - SHOWN_ROWS} more rows</p>}
  </div>
}

function CaseResult({ test, outcome, ordered }: { test: SqlLabTest; outcome: SqlCaseOutcome; ordered?: boolean }) {
  return <li className={outcome.pass ? 'pass' : 'fail'}>
    <span className="test-status"><Icon name={outcome.pass ? 'check' : 'x'} size={16} />{outcome.pass ? 'Passed' : 'Failed'}</span>
    <span className="test-call">{test.name}</span>
    {outcome.error && <pre className="sql-error">{outcome.error}</pre>}
    {!outcome.pass && outcome.reason && <p className="sql-reason">{outcome.reason}</p>}
    <details className="sql-compare" open={!outcome.pass}>
      <summary>{outcome.pass ? 'Show result' : 'Compare results'}</summary>
      <div className="sql-tables">
        <ResultTable caption={`Expected${ordered ? ' (in this order)' : ''}`} columns={test.expected.columns} rows={test.expected.rows} />
        {outcome.actual && <ResultTable caption="Your result" columns={outcome.actual.columns} rows={outcome.actual.rows} />}
      </div>
    </details>
  </li>
}

export function SqlResults({ exercise, report, message }: { exercise: SqlExercise; report: SqlReport; message?: string }) {
  if (report.kind === 'timeout') return <div className="run-summary fail"><strong>Stopped after {SQL_TIMEOUT_MS / 1000} seconds.</strong> Check for a recursive CTE without a stopping condition or a huge cross join.</div>
  if (report.kind === 'load-error') return <div className="run-summary fail"><strong>Postgres could not start.</strong> {report.error}</div>
  if (report.kind === 'error') return <div className="run-summary fail"><strong>Your SQL didn’t run.</strong><pre>{report.error}</pre></div>
  const visible = report.outcomes.slice(0, exercise.tests.length)
  const hidden = report.outcomes.slice(exercise.tests.length)
  const passed = report.outcomes.filter(outcome => outcome.pass).length
  return <>
    <div className={message ? 'run-summary pass' : 'run-summary fail'}><strong>{message ?? `${passed} of ${report.outcomes.length} tests passed.`}</strong></div>
    <ul className="test-results sql-results">
      {visible.map((outcome, index) => <CaseResult key={index} test={exercise.tests[index]} outcome={outcome} ordered={exercise.ordered} />)}
      {hidden.length > 0 && <li className={hidden.every(outcome => outcome.pass) ? 'pass' : 'fail'}>
        <span className="test-status"><Icon name={hidden.every(outcome => outcome.pass) ? 'check' : 'x'} size={16} />Hidden tests</span>
        <span>{hidden.filter(outcome => outcome.pass).length} of {hidden.length} passed{hidden.some(outcome => outcome.error) ? ' · some raised errors' : ''}</span>
      </li>}
    </ul>
  </>
}

/** Editor plus Postgres test runner for one SQL exercise. Mirrors LabRunner for code labs. */
export default function SqlLabRunner({ exercise, value, onChange, onPass, label }: {
  exercise: SqlExercise
  value: string
  onChange: (value: string) => void
  /** Called when every test passes; may return XP gained to show in the summary. */
  onPass?: () => number | void
  label: string
}) {
  const [phase, setPhase] = useState<RunPhase | 'idle'>('idle')
  const [result, setResult] = useState<{ report: SqlReport; message?: string }>()
  const live = useRef(true)
  useEffect(() => {
    live.current = true
    return () => { live.current = false }
  }, [])
  const id = `lab-${exercise.id}`
  async function run() {
    setResult(undefined)
    const report = await runSqlCode({ code: value, schema: exercise.schema, check: exercise.check, ordered: exercise.ordered, cases: [...exercise.tests, ...exercise.hiddenTests] }, setPhase)
    if (!live.current) return
    setPhase('idle')
    const passed = report.kind === 'done' && report.outcomes.every(outcome => outcome.pass)
    const gained = passed ? onPass?.() : undefined
    setResult({ report, message: passed ? `All ${report.outcomes.length} tests passed${gained ? ` · +${gained} XP` : ''}.` : undefined })
  }
  function reset() {
    if (value !== exercise.starter && !window.confirm('Replace your SQL with the starter? Your current SQL will be lost.')) return
    onChange(exercise.starter)
    setResult(undefined)
  }
  const busy = phase !== 'idle'
  return <div className="lab-runner code-workspace">
    <div className="code-toolbar">
      <label htmlFor={id}>{label} <span className="muted">· SQL (Postgres)</span></label>
      <button type="button" className="text-button" onClick={reset} disabled={busy}>Reset to starter</button>
    </div>
    <Editor id={id} lang="sql" value={value} onChange={onChange} describedBy={`${id}-help`} />
    <p id={`${id}-help`} className="helper">Each test starts from a fresh database with the tables below{exercise.check ? '; a check query then reads the result' : ''}. Tab indents; press Esc, then Tab, to leave the editor. Postgres’s first run downloads about 6 MB compressed, then works offline.</p>
    <details className="sql-schema"><summary>Tables and test data</summary><pre><code>{exercise.schema}</code></pre>{exercise.tests.filter(test => test.seed.trim()).map(test => <div key={test.name}><p className="muted">Test data: {test.name}</p><pre><code>{test.seed}</code></pre></div>)}</details>
    <div className="button-row"><button type="button" className="primary" onClick={() => { void run() }} disabled={busy}><Icon name="bolt" size={16} />{phase === 'idle' ? 'Run tests' : phase === 'loading-sql' ? 'Starting Postgres…' : 'Running…'}</button></div>
    <div className="run-results" role="status" aria-live="polite">
      {result && <SqlResults exercise={exercise} report={result.report} message={result.message} />}
    </div>
  </div>
}
