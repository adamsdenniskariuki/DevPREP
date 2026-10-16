import Icon from './Icon'
import { formatArgs, formatValue, TIMEOUT_MS, type CaseOutcome, type TypeDiagnostic } from '../runner/core'
import { TS_TIMEOUT_MS, type RunReport } from '../runner/runner'
import type { CodeLanguage, ProblemTest } from '../problem-types'

function describeActual(outcome: CaseOutcome, lang: CodeLanguage) {
  return outcome.actual === undefined ? (lang === 'py' ? 'None' : 'undefined') : formatValue(JSON.parse(outcome.actual), lang)
}

/** Test results for one run: visible cases in detail, hidden cases as a count, then console output. */
export default function RunResults({ tests, fn, lang, typescript = false, report, message, typeChecks }: { tests: ProblemTest[]; fn: string; lang: CodeLanguage; typescript?: boolean; report: RunReport; message?: string; typeChecks?: string }) {
  if (report.kind === 'timeout') return <div className="run-summary fail"><strong>Stopped after {(typescript ? TS_TIMEOUT_MS : TIMEOUT_MS[lang]) / 1000} seconds.</strong> Check for an infinite loop or a slower-than-needed approach.</div>
  if (report.kind === 'load-error') return <div className="run-summary fail"><strong>{typescript ? 'TypeScript' : lang === 'py' ? 'Python' : 'The runner'} could not start.</strong> {report.error}</div>
  if (report.kind === 'error') return <><div className="run-summary fail"><strong>Your code didn’t run.</strong><pre>{report.error}</pre></div>{report.output && <Output text={report.output} />}</>
  const diagnostics = report.diagnostics ?? []
  const visible = report.outcomes.slice(0, tests.length)
  const hidden = report.outcomes.slice(tests.length)
  const passed = report.outcomes.filter(outcome => outcome.pass).length
  const checksFailed = report.typeChecks?.pass === false
  return <>
    <div className={message ? 'run-summary pass' : 'run-summary fail'}><strong>{message ?? (checksFailed && passed === report.outcomes.length ? `All ${passed} tests passed, but the type checks failed.` : `${passed} of ${report.outcomes.length} tests passed.`)}</strong></div>
    <ul className="test-results">
      {visible.map((outcome, index) => <li key={index} className={outcome.pass ? 'pass' : 'fail'}>
        <span className="test-status"><Icon name={outcome.pass ? 'check' : 'x'} size={16} />{outcome.pass ? 'Passed' : 'Failed'}</span>
        <code className="test-call">{fn}({formatArgs(tests[index].args, lang)})</code>
        {!outcome.pass && <dl>
          <div><dt>Expected</dt><dd><code>{formatValue(tests[index].expected, lang)}</code></dd></div>
          {outcome.error ? <div><dt>Error</dt><dd><pre>{outcome.error}</pre></dd></div> : <div><dt>Got</dt><dd><code>{describeActual(outcome, lang)}</code></dd></div>}
        </dl>}
      </li>)}
      {hidden.length > 0 && <li className={hidden.every(outcome => outcome.pass) ? 'pass' : 'fail'}>
        <span className="test-status"><Icon name={hidden.every(outcome => outcome.pass) ? 'check' : 'x'} size={16} />Hidden tests</span>
        <span>{hidden.filter(outcome => outcome.pass).length} of {hidden.length} passed{hidden.some(outcome => outcome.error) ? ' · some raised errors' : ''}</span>
      </li>}
    {report.typeChecks && <li className={report.typeChecks.pass ? 'pass' : 'fail'}>
        <span className="test-status"><Icon name={report.typeChecks.pass ? 'check' : 'x'} size={16} />Type checks</span>
        {report.typeChecks.pass ? <span>All passed</span> : <ul className="type-check-failures">{report.typeChecks.errors.slice(0, 10).map((error, index) => <li key={index}>
          {checkSource(typeChecks, error.line) && <code className="test-call">{checkSource(typeChecks, error.line)}</code>} {error.message} <span className="muted">TS{error.code}</span>
        </li>)}</ul>}
      </li>}
    </ul>
    {diagnostics.length > 0 && <TypeErrors diagnostics={diagnostics} />}
    {report.output && <Output text={report.output} />}
  </>
}

function checkSource(typeChecks: string | undefined, line: number) {
  return typeChecks?.split('\n')[line - 1]?.trim()
}

function TypeErrors({ diagnostics }: { diagnostics: TypeDiagnostic[] }) {
  return <details className="run-output type-errors" open>
    <summary>{diagnostics.length === 1 ? '1 type error' : `${diagnostics.length} type errors`} · the code still ran</summary>
    <ul>{diagnostics.slice(0, 20).map((diagnostic, index) => <li key={index}><code>Line {diagnostic.line}:{diagnostic.column}</code> {diagnostic.message} <span className="muted">TS{diagnostic.code}</span></li>)}</ul>
  </details>
}

function Output({ text }: { text: string }) {
  return <details className="run-output" open><summary>Console output</summary><pre>{text}</pre></details>
}