import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { AppModel } from '../app-model'
import Icon from '../components/Icon'
import Whiteboard, { modelBoard } from '../components/Whiteboard'
import { lessons } from '../curriculum'
import { caseIndex, loadCases } from '../cases'
import type { CaseSummary, DesignCase, StepKey } from '../case-types'
import { DESIGN_FRAMEWORK } from '../design-framework'
import { clearDesignDraft, emptyBoard, MAX_NOTE_LENGTH, readDesignDraft, writeDesignDraft } from '../design-drafts'
import type { Board, DesignTimer } from '../design-drafts'
import { rubricPercent, scoredItems } from '../design-score'
import type { RubricMark } from '../design-score'
import { createBoard, findBoards } from '../boards'
import type { BoardRecord } from '../boards'
import { displayDate } from '../format'
import { attemptText, newPractice, PRACTICE_PRESETS } from '../practice'
import type { PracticeMinutes } from '../practice'

const LEVELS = [{ id: 'se', label: 'SE core' }, { id: 'sse', label: 'SSE depth' }] as const
const MARKS: { value: RubricMark; label: string }[] = [{ value: 0, label: 'Missed' }, { value: 1, label: 'Partly' }, { value: 2, label: 'Covered' }]
const WARN_MS = 5 * 60_000

const formatTime = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export default function DesignScreen({ app, caseId }: { app: AppModel; caseId?: string }) {
  const summary = caseIndex.find(item => item.id === caseId)
  // Lazy screen: focus our own heading once mounted.
  useEffect(() => { app.heading.current?.focus() }, [app.heading, summary?.id])
  return summary ? <CasePage key={summary.id} app={app} summary={summary} /> : <CaseList app={app} />
}

function BestPill({ app, id }: { app: AppModel; id: string }) {
  const best = app.progress.designs?.[id]?.best
  return best === undefined ? null : <span className="pill solved"><Icon name="check" size={14} />Best {best}%</span>
}

function CaseList({ app }: { app: AppModel }) {
  const scored = caseIndex.filter(item => app.progress.designs?.[item.id]).length
  return <>
    <a className="back-link" href="#practice"><Icon name="back" size={16} /> Practice</a>
    <div className="page-heading"><div><div className="eyebrow">PRACTICE · SYSTEM DESIGN</div><h1 ref={app.heading} tabIndex={-1}>Case studies</h1><p>Timed 45-minute designs with a whiteboard, model answer and rubric.</p></div><span className="pill">{scored} of {caseIndex.length} scored</span></div>
    <details className="card framework-card">
      <summary><Icon name="layers" size={18} /> The 8-step framework</summary>
      <ol className="framework-list">{DESIGN_FRAMEWORK.map(step => <li key={step.key}><strong>{step.title}</strong> <span className="muted">~{step.minutes} min</span><ul>{step.questions.map(question => <li key={question}>{question}</li>)}</ul></li>)}</ol>
    </details>
    <a className="tool-card live board-link" href="#board"><span className="tool-icon"><Icon name="grid" /></span><span><strong>Whiteboards</strong><span className="muted">Sketch any design with shapes, arrows and stencils.</span></span></a>
    {LEVELS.map(level => <section key={level.id} className="code-group" aria-labelledby={`cases-${level.id}`}>
      <h2 className="section-title" id={`cases-${level.id}`}>{level.label}</h2>
      <ul className="card code-list">{caseIndex.filter(item => item.level === level.id).map(item => <li key={item.id} className="code-row">
        <span className="case-row-text"><a href={`#design/${item.id}`}>{item.title}</a><span className="muted">{item.summary}</span></span>
        <span className="code-row-meta"><span className="pill"><Icon name="clock" size={14} />{item.minutes} min</span><BestPill app={app} id={item.id} /></span>
      </li>)}</ul>
    </section>)}
  </>
}

function CasePage({ app, summary }: { app: AppModel; summary: CaseSummary }) {
  const [item, setItem] = useState<DesignCase>()
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    loadCases().then(all => { if (live) setItem(all.get(summary.id)) }, () => { if (live) setError('This case study could not be loaded. Reconnect and try again.') })
    return () => { live = false }
  }, [summary.id])
  return <>
    <a className="back-link" href="#design"><Icon name="back" size={16} /> All case studies</a>
    <div className="page-heading"><div><div className="eyebrow">SYSTEM DESIGN · {summary.level === 'sse' ? 'SSE DEPTH' : 'SE CORE'}</div><h1 ref={app.heading} tabIndex={-1}>{summary.title}</h1></div><BestPill app={app} id={summary.id} /></div>
    {error ? <div className="alert" role="alert">{error}</div> : item ? <CaseWorkspace app={app} item={item} /> : <p role="status">Loading case study…</p>}
  </>
}

function useTimer(id: string, minutes: number) {
  const full = minutes * 60_000
  const [timer, setTimer] = useState<DesignTimer>(() => readDesignDraft(id).timer ?? {})
  const [now, setNow] = useState(() => Date.now())
  const [announce, setAnnounce] = useState('')
  const warned = useRef(false)
  const running = timer.endsAt !== undefined
  const remaining = running ? Math.max(0, timer.endsAt! - now) : timer.remaining ?? full
  useEffect(() => {
    if (!running) return
    const tick = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(tick)
  }, [running])
  useEffect(() => {
    if (!running) return
    if (remaining <= 0) { setAnnounce("Time's up. Wrap up and review your answer."); save({ remaining: 0 }) }
    else if (remaining <= WARN_MS && !warned.current) { warned.current = true; setAnnounce('Five minutes left.') }
  })
  function save(next: DesignTimer) {
    setTimer(next)
    setNow(Date.now())
    writeDesignDraft(id, { timer: next.endsAt === undefined && next.remaining === undefined ? undefined : next })
  }
  return {
    remaining, running, announce, started: running || timer.remaining !== undefined,
    start: () => { warned.current = remaining <= WARN_MS; setAnnounce(''); save({ endsAt: Date.now() + (remaining || full) }) },
    pause: () => save({ remaining }),
    reset: () => { warned.current = false; setAnnounce(''); save({}) },
  }
}

function CaseWorkspace({ app, item }: { app: AppModel; item: DesignCase }) {
  const [notes, setNotes] = useState<Partial<Record<StepKey, string>>>(() => readDesignDraft(item.id).notes ?? {})
  const [board, setBoard] = useState<Board>(() => readDesignDraft(item.id).board ?? emptyBoard())
  const [saveFailed, setSaveFailed] = useState(false)
  const [review, setReview] = useState(false)
  const timer = useTimer(item.id, item.minutes)
  const reviewHeading = useRef<HTMLHeadingElement>(null)
  const related = item.lessons.map(id => lessons.find(lesson => lesson.id === id)).filter(lesson => lesson !== undefined)

  useEffect(() => { if (review) reviewHeading.current?.focus() }, [review])

  function editNote(key: StepKey, value: string) {
    const next = { ...notes, [key]: value }
    setNotes(next)
    setSaveFailed(!writeDesignDraft(item.id, { notes: next }))
  }

  function finish() {
    if (timer.running) timer.pause()
    setReview(true)
  }

  function startOver() {
    if (!window.confirm('Clear your notes, whiteboard and timer for this case?')) return
    clearDesignDraft(item.id)
    setNotes({})
    setBoard(emptyBoard())
    timer.reset()
    setReview(false)
  }

  return <>
    <section className="card case-prompt" aria-labelledby="case-prompt">
      <h2 id="case-prompt" className="sr-only">Prompt</h2>
      <p>{item.prompt}</p>
      <div className="timer-row">
        <span className={`timer${timer.remaining <= WARN_MS && timer.started ? ' warn' : ''}`} role="timer" aria-label="Time remaining">{formatTime(timer.remaining)}</span>
        {timer.running ? <button type="button" onClick={timer.pause}>Pause</button> : <button type="button" className="primary" onClick={timer.start} disabled={timer.started && timer.remaining <= 0}>{timer.started ? 'Resume' : 'Start timer'}</button>}
        {timer.started && <button type="button" className="text-button" onClick={timer.reset}>Reset</button>}
        <p className="sr-only" role="status" aria-live="polite">{timer.announce}</p>
      </div>
      {related.length > 0 && <p className="muted case-related">Related lessons: {related.map((lesson, index) => <span key={lesson.id}>{index ? ', ' : ''}{lesson.title}</span>)}</p>}
    </section>
    <PracticeStarter app={app} item={item} />

    {!review ? <>
      <h2 className="section-title">Your answer</h2>
      <div className="case-steps">{DESIGN_FRAMEWORK.map(step => <details key={step.key} className="card case-step" open={step.key === 'requirements' || !!notes[step.key]}>
        <summary><strong>{step.title}</strong><span className="muted">~{step.minutes} min</span>{notes[step.key]?.trim() && <Icon name="check" size={16} />}</summary>
        <ul className="muted">{step.questions.map(question => <li key={question}>{question}</li>)}</ul>
        <label className="sr-only" htmlFor={`note-${step.key}`}>{step.title} notes</label>
        <textarea id={`note-${step.key}`} rows={4} maxLength={MAX_NOTE_LENGTH} value={notes[step.key] ?? ''} onChange={event => editNote(step.key, event.target.value)} />
      </details>)}</div>
      <h2 className="section-title">Whiteboard</h2>
      <Whiteboard title="Your design" board={board} onChange={next => { setBoard(next); setSaveFailed(!writeDesignDraft(item.id, { board: next })) }} />
      {saveFailed && <p className="alert" role="alert">Couldn't save on this device. Storage may be full or blocked.</p>}
      <div className="button-row case-actions"><button type="button" className="primary" onClick={finish}>Finish &amp; review</button><button type="button" className="text-button" onClick={startOver}>Start over</button></div>
    </> : <Review app={app} item={item} notes={notes} heading={reviewHeading} onBack={() => setReview(false)} />}
  </>
}

function Review({ app, item, notes, heading, onBack }: { app: AppModel; item: DesignCase; notes: Partial<Record<StepKey, string>>; heading: RefObject<HTMLHeadingElement | null>; onBack: () => void }) {
  const includeSse = item.level === 'sse' || app.progress.selectedPath === 'senior'
  const [marks, setMarks] = useState<(RubricMark | undefined)[]>(() => item.rubric.map(() => undefined))
  const [saved, setSaved] = useState<{ percent: number; xp: number }>()
  const percent = rubricPercent(item.rubric, marks, includeSse)
  const scored = new Set(scoredItems(item.rubric, includeSse))
  const model = modelBoard(item.diagram)

  function save() {
    if (percent === undefined) return
    setSaved({ percent, xp: app.scoreDesign(item.id, percent) })
  }

  return <section aria-labelledby="review-heading">
    <h2 id="review-heading" ref={heading} tabIndex={-1} className="section-title">Review against the model answer</h2>
    <div className="case-steps">{DESIGN_FRAMEWORK.map(step => <details key={step.key} className="card case-step" open>
      <summary><strong>{step.title}</strong></summary>
      <div className="compare">
        <div><h3>Your notes</h3>{notes[step.key]?.trim() ? <p className="notes-text">{notes[step.key]}</p> : <p className="muted">No notes.</p>}</div>
        <div><h3>Model answer</h3><ul>{item.steps[step.key].map(point => <li key={point}>{point}</li>)}</ul></div>
      </div>
    </details>)}</div>
    <h2 className="section-title">Model diagram</h2>
    <Whiteboard title={`Model design for ${item.title}`} board={model} />
    <h2 className="section-title">Rubric</h2>
    <p className="muted">Be honest: mark what your answer actually covered.{!includeSse && ' SSE items are optional stretch goals at SE level.'}</p>
    <ol className="card rubric">{item.rubric.map((rubric, index) => <li key={rubric.text} className="rubric-item">
      <fieldset>
        <legend>{rubric.text}{rubric.sse && <span className="pill">SSE{scored.has(index) ? '' : ' · stretch'}</span>}</legend>
        <div className="chip-group">{MARKS.map(mark => <label key={mark.value} className="chip"><input type="radio" name={`rubric-${index}`} checked={marks[index] === mark.value} onChange={() => { setMarks(current => current.map((value, i) => i === index ? mark.value : value)); setSaved(undefined) }} />{mark.label}</label>)}</div>
      </fieldset>
    </li>)}</ol>
    <div className="score-row">
      <span className="score" aria-live="polite">{percent === undefined ? `Mark all ${scored.size} scored items` : `Score: ${percent}%`}</span>
      <button type="button" className="primary" disabled={percent === undefined} onClick={save}>Save score</button>
      <button type="button" className="text-button" onClick={onBack}>Back to my answer</button>
    </div>
    {saved && <p className="alert success" role="status">Saved {saved.percent}%.{saved.xp > 0 ? ` +${saved.xp} XP` : ' Your best score is unchanged.'}</p>}
  </section>
}

/** Starts a timed practice on an Excalidraw board and lists past attempts for this case. */
function PracticeStarter({ app, item }: { app: AppModel; item: DesignCase }) {
  const [attempts, setAttempts] = useState<BoardRecord[]>()
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    findBoards('practice', { caseId: item.id }).then(found => { if (live) setAttempts(found.sort((a, b) => b.createdAt.localeCompare(a.createdAt))) }, problem => { if (live) setError(problem instanceof Error ? problem.message : 'Practice boards could not load.') })
    return () => { live = false }
  }, [item.id])

  async function start(minutes: PracticeMinutes) {
    try {
      const board = await createBoard({ kind: 'practice', caseId: item.id, title: `${item.title} practice`, practice: newPractice(minutes) })
      app.createdBoard()
      window.location.hash = `board/${board.id}`
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'The practice board could not be made.') }
  }

  return <section className="card practice-start" aria-labelledby="practice-start">
    <h2 id="practice-start">Whiteboard practice</h2>
    <p className="muted">Draw your design against the clock. When you finish, compare it with the reference and review it.</p>
    <div className="button-row">{PRACTICE_PRESETS.map(minutes => <button key={minutes} type="button" onClick={() => { void start(minutes) }}><Icon name="clock" size={16} />Start {minutes} min</button>)}</div>
    {error && <p className="alert" role="alert">{error}</p>}
    {attempts && attempts.length > 0 && <>
      <h3>Past attempts</h3>
      <ul className="practice-attempts">{attempts.map((board, index) => <li key={board.id}>
        <a href={`#board/${board.id}`}>Attempt {attempts.length - index}</a>
        <span className="muted">{displayDate(board.createdAt.slice(0, 10))} · {board.practice ? attemptText(board.practice) : 'No timer'}</span>
      </li>)}</ul>
    </>}
  </section>
}