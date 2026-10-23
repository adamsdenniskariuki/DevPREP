import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import Whiteboard, { modelBoard } from './Whiteboard'
import type { DesignCase } from '../case-types'
import { CHECKLIST, clock, duration, finish, pause, remaining, resume, spent, tick, ticked, WARN_MS } from '../practice'
import type { PracticeState } from '../practice'

/** The practice clock. It lives in the board record, so it keeps running across reloads. */
export function usePracticeTimer(initial: PracticeState, persist: (state: PracticeState) => void) {
  const [state, setState] = useState(initial)
  const [now, setNow] = useState(() => Date.now())
  const [announce, setAnnounce] = useState('')
  const running = state.runningSince !== undefined
  const left = remaining(state, now)
  const warned = useRef(left <= WARN_MS)
  const over = useRef(left <= 0)
  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [running])
  useEffect(() => {
    if (!running) return
    if (left <= 0 && !over.current) { over.current = warned.current = true; setAnnounce('Time’s up. Finish and review when you’re ready.') }
    else if (left <= WARN_MS && !warned.current) { warned.current = true; setAnnounce('Five minutes left.') }
  })
  function change(next: PracticeState) {
    const at = Date.now()
    setState(next)
    setNow(at)
    persist(next)
  }
  return {
    state, left, running, announce, finished: !!state.finishedAt,
    pause: () => change(pause(state)),
    resume: () => change(resume(state)),
    finish: () => change(finish(state)),
    tick: (index: number, checked: boolean) => change(tick(state, index, checked)),
  }
}

export type PracticeTimer = ReturnType<typeof usePracticeTimer>

export function PracticeBar({ timer, onFinish }: { timer: PracticeTimer; onFinish: () => void }) {
  const { state, left } = timer
  const used = Math.min(1, spent(state) / (state.minutes * 60_000))
  return <section className="card practice-bar" aria-label="Practice timer">
    <div className="practice-clock">
      <span className={`timer${left <= WARN_MS ? ' warn' : ''}`} role="timer" aria-label={left < 0 ? 'Time over' : 'Time remaining'}>{clock(left)}</span>
      <span className="muted">{left < 0 ? 'over' : 'left'} of {state.minutes} min</span>
    </div>
    <div className="practice-meter" aria-hidden="true"><span style={{ width: `${Math.round(used * 100)}%` }} /></div>
    <div className="button-row">
      {timer.running ? <button type="button" onClick={timer.pause}>Pause</button> : <button type="button" onClick={timer.resume}>Resume</button>}
      <button type="button" className="primary" onClick={onFinish}>Finish &amp; review</button>
    </div>
    <p className="sr-only" role="status" aria-live="polite">{timer.announce}</p>
  </section>
}

export function PracticeSummary({ state, heading }: { state: PracticeState; heading: RefObject<HTMLHeadingElement | null> }) {
  const taken = spent(state)
  return <section className="card practice-summary" aria-labelledby="practice-review">
    <h2 id="practice-review" ref={heading} tabIndex={-1}>Review your design</h2>
    <p>Time taken: <strong>{duration(taken)}</strong> of {state.minutes} min{taken > state.minutes * 60_000 ? ' (over time)' : ''}.</p>
    <p className="muted">Compare your board with the reference, then tick what you covered.</p>
  </section>
}

export function Reference({ item, error }: { item: DesignCase | undefined; error: string }) {
  return <section className="practice-reference" aria-labelledby="reference-title">
    <h2 id="reference-title" className="section-title">Reference design</h2>
    {error ? <p className="alert" role="alert">{error}</p>
      : item ? <Whiteboard title={`Reference design for ${item.title}`} board={modelBoard(item.diagram)} />
        : <p role="status">Loading the reference…</p>}
  </section>
}

export function Checklist({ timer }: { timer: PracticeTimer }) {
  return <fieldset className="card practice-checklist">
    <legend>Self-review</legend>
    <p className="muted">Did your design cover these? {ticked(timer.state)} of {CHECKLIST.length} ticked.</p>
    <ul>{CHECKLIST.map((label, index) => <li key={label}><label className="check-row">
      <input type="checkbox" checked={timer.state.checks[index]} onChange={event => timer.tick(index, event.target.checked)} />{label}
    </label></li>)}</ul>
  </fieldset>
}
