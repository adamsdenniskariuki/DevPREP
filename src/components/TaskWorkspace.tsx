import type { RefObject } from 'react'
import Icon from './Icon'
import Editor from './Editor'
import RunProgress, { BUSY_LABEL } from './RunProgress'
import type { EditorProps } from '../editor-prefs'
import type { ProjectReport, RunPhase } from '../runner/runner'
import { formatProjectDiagnostic } from '../runner/project'
import '../task-workspace.css'

interface Props {
  id: string
  lang: EditorProps['lang']
  /** File the learner edits, e.g. App.tsx. */
  file: string
  testFile: string
  code: string
  onChange: (value: string) => void
  tests: string
  phase: RunPhase | 'idle'
  done: number
  total?: number
  limitMs: number
  report?: ProjectReport
  /** Element the runner renders the live preview into. */
  preview: RefObject<HTMLDivElement | null>
  onRun: () => void
  onReset?: () => void
  helper?: string
  headingLevel?: 2 | 3
  /** Names the region when several workspaces share a file name on one page. */
  label?: string
}

/**
 * One runnable file with read-only tests: editor, Run, progress, results and a live preview pane.
 * Shared by module exercises (the React module) and the coding tasks of the timed skill tests.
 */
export default function TaskWorkspace({ id, lang, file, testFile, code, onChange, tests, phase, done, total, limitMs, report, preview, onRun, onReset, helper = '', headingLevel = 2, label }: Props) {
  const busy = phase !== 'idle'
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  const Sub = headingLevel === 2 ? 'h3' : 'h4'
  return <section className="card task-workspace" aria-labelledby={label ? undefined : `${id}-heading`} aria-label={label}>
    <div className="task-editor-pane">
      <div className="code-toolbar">
        <Heading id={`${id}-heading`} className="task-small-heading"><code>{file}</code></Heading>
        {onReset && <button className="text-button" onClick={onReset} disabled={busy}>Reset code</button>}
      </div>
      <label htmlFor={id} className="sr-only">{file}</label>
      <Editor id={id} lang={lang} value={code} describedBy={`${id}-help`} onChange={onChange} />
      <p id={`${id}-help`} className="helper">Tab indents. Press Esc, then Tab, to leave the editor. The first run downloads the compiler and runtime, then works offline.{helper}</p>
      <div className="button-row">
        <button className="primary" onClick={onRun} disabled={busy} aria-busy={busy}><Icon name="bolt" size={16} />{busy ? BUSY_LABEL[phase as RunPhase] : 'Run tests'}</button>
      </div>
      <RunProgress phase={phase} done={done} total={total} limitMs={limitMs} />
      <div className="run-results" role="status" aria-live="polite">{report && <TaskResults report={report} />}</div>
      <details className="task-tests">
        <summary>The tests (<code>{testFile}</code>, read-only)</summary>
        <pre className="task-code" tabIndex={0} aria-label={testFile}><code>{tests}</code></pre>
      </details>
    </div>
    <div className="task-preview-pane">
      <Sub className="task-small-heading">Live preview</Sub>
      <div ref={preview} className="task-preview">{!report && !busy && <p className="muted">Run the tests to see your component here.</p>}</div>
    </div>
  </section>
}

export const reportPassed = (report: ProjectReport) => report.kind === 'done' && report.outcomes.length > 0 && report.outcomes.every(outcome => outcome.pass)

function TaskResults({ report }: { report: ProjectReport }) {
  if (report.kind === 'timeout') return <div className="run-summary fail"><strong>Stopped after {report.limitMs / 1000} seconds.</strong> Check for a loop that never ends, or an effect that updates state on every render.</div>
  if (report.kind === 'load-error') return <div className="run-summary fail"><strong>The runner could not start.</strong> {report.error}</div>
  const diagnostics = report.diagnostics ?? []
  const diagnosticList = diagnostics.length > 0 && <details className="run-output type-errors" open>
    <summary>{diagnostics.length === 1 ? '1 error' : `${diagnostics.length} errors`}</summary>
    <ul>{diagnostics.slice(0, 20).map((diagnostic, index) => <li key={index}><code>{formatProjectDiagnostic(diagnostic)}</code></li>)}</ul>
  </details>
  const output = report.output && <details className="run-output"><summary>Console output</summary><pre tabIndex={0}>{report.output}</pre></details>
  if (report.kind === 'error') return <><div className="run-summary fail"><strong>The tests didn’t run.</strong><pre>{report.error}</pre></div>{diagnosticList}{output}</>
  const passed = report.outcomes.filter(outcome => outcome.pass).length
  const all = reportPassed(report)
  return <>
    <div className={all ? 'run-summary pass' : 'run-summary fail'}><strong>{report.outcomes.length === 0 ? 'No tests were found.' : all ? `All ${passed} tests passed.` : `${passed} of ${report.outcomes.length} tests passed.`}</strong></div>
    <ul className="test-results">
      {report.outcomes.map(outcome => <li key={outcome.name} className={outcome.pass ? 'pass' : 'fail'}>
        <span className="test-status"><Icon name={outcome.pass ? 'check' : 'x'} size={16} />{outcome.pass ? 'Passed' : 'Failed'}</span>
        <span className="test-call">{outcome.name}</span>
        {!outcome.pass && outcome.error && <pre className="task-error">{outcome.error}</pre>}
      </li>)}
    </ul>
    {diagnosticList}
    {output}
  </>
}
