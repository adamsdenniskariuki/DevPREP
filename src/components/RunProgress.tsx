import { useEffect, useState } from 'react'
import type { RunPhase } from '../runner/runner'
import '../run-progress.css'

const LOADING_STEP: Record<Exclude<RunPhase, 'running'>, string> = {
  'loading-python': 'Loading Python (first run downloads it; cached after)…',
  'loading-numpy': 'Loading Python and NumPy (first run downloads them; cached after)…',
  'loading-typescript': 'Loading TypeScript (first run downloads it; cached after)…',
  'loading-sql': 'Loading SQL (first run downloads Postgres; cached after)…',
}

/** Short run-button labels while a run is busy. */
export const BUSY_LABEL: Record<RunPhase, string> = {
  'loading-python': 'Loading Python…',
  'loading-numpy': 'Loading Python and NumPy…',
  'loading-typescript': 'Loading TypeScript…',
  'loading-sql': 'Starting Postgres…',
  running: 'Running…',
}

/** The step shown under the run button. With no `total` the run has no tests (the Playground). */
export function runStep(phase: RunPhase, total?: number): string {
  if (phase !== 'running') return LOADING_STEP[phase]
  if (total === undefined) return 'Running your code…'
  return `Running ${total} ${total === 1 ? 'test' : 'tests'}…`
}

/**
 * Progress for a code run: the current step, a bar, the seconds spent in this step and the time limit.
 * The bar fills test by test when the runner reports finished cases; otherwise (loading, or a run with
 * no tests) it is indeterminate. Phase changes are announced politely; the ticking seconds are not.
 */
export default function RunProgress({ phase, total, done = 0, limitMs, name = 'Test run progress' }: {
  phase: RunPhase | 'idle'
  /** Tests in the run; omit for a run with no tests. */
  total?: number
  /** Tests finished so far. */
  done?: number
  /** How long the running step may take before it is stopped. */
  limitMs: number
  /** Accessible name for the progress bar. */
  name?: string
}) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (phase === 'idle') return
    const started = Date.now()
    setElapsed(0)
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 500)
    return () => clearInterval(timer)
  }, [phase])
  const step = phase === 'idle' ? '' : runStep(phase, total)
  const determinate = phase === 'running' && total !== undefined && total > 0
  const finished = determinate ? Math.min(Math.max(done, 0), total) : 0
  return <>
    <p className="sr-only" aria-live="polite">{step}</p>
    {phase !== 'idle' && <div className="run-progress">
      <div className="run-progress-text">
        <span className="run-progress-step">{step}</span>
        <span className="run-progress-meta">
          {determinate && <>Test {Math.min(finished + 1, total)} of {total} · </>}
          {elapsed} s{phase === 'running' && <> · stops after {limitMs / 1000} s</>}
        </span>
      </div>
      <div className="run-progress-track" role="progressbar" aria-label={name}
        aria-valuemin={determinate ? 0 : undefined} aria-valuemax={determinate ? total : undefined} aria-valuenow={determinate ? finished : undefined}
        aria-valuetext={determinate ? `${finished} of ${total} tests done` : step}>
        <div className={determinate ? 'run-progress-fill' : 'run-progress-fill indeterminate'} style={determinate ? { width: `${(finished / total) * 100}%` } : undefined} />
      </div>
    </div>}
  </>
}
