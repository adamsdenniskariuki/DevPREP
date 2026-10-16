import { useEffect, useRef, useState } from 'react'
import type { AppModel } from '../app-model'
import Icon from '../components/Icon'
import { tracks } from '../curriculum'
import type { Track } from '../curriculum-types'
import { loadCases } from '../cases'
import { loadProblems } from '../problems'
import { loadGuides } from '../guides'
import { loadLabs } from '../curriculum'
import { displayDate } from '../format'
import { buildMock, mockScore, MOCK_MINUTES } from '../mocks'
import type { Mock, MockData, MockLevel } from '../mocks'

const DRAFT_KEY = 'devprep.mock.v1'
const MAX_ANSWER = 8_000
interface Draft {
  track: Track
  level: MockLevel
  seed: number
  startedAt: number
  endsAt: number
  finishedAt?: number
  answers: string[]
  checked: boolean[][]
}

function readDraft(): Draft | undefined {
  try {
    const raw = JSON.parse(window.localStorage.getItem(DRAFT_KEY) ?? 'null') as Draft | null
    if (!raw || !tracks.some(item => item.id === raw.track) || (raw.level !== 'se' && raw.level !== 'sse') || !Number.isFinite(raw.seed) || !Array.isArray(raw.answers) || !Array.isArray(raw.checked)) return undefined
    return raw
  } catch { return undefined }
}
function writeDraft(draft: Draft | undefined): boolean {
  try {
    if (draft) window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    else window.localStorage.removeItem(DRAFT_KEY)
    return true
  } catch { return false }
}

const formatTime = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export default function MockScreen({ app }: { app: AppModel }) {
  const [draft, setDraft] = useState<Draft | undefined>(readDraft)
  const [data, setData] = useState<MockData>()
  const [error, setError] = useState('')
  const [saveFailed, setSaveFailed] = useState(false)
  const [saved, setSaved] = useState<{ percent: number; xp: number }>()
  const [now, setNow] = useState(() => Date.now())
  const [level, setLevel] = useState<MockLevel>(app.progress.selectedPath === 'senior' ? 'sse' : 'se')
  const reviewHeading = useRef<HTMLHeadingElement>(null)
  const phase = !draft ? 'pick' : draft.finishedAt === undefined ? 'answer' : 'review'
  useEffect(() => { (phase === 'review' ? reviewHeading : app.heading).current?.focus() }, [app.heading, phase])
  useEffect(() => {
    let live = true
    Promise.all([loadProblems(), loadCases(), loadGuides(), loadLabs()]).then(([problems, cases, guides, labs]) => { if (live) setData({ problems, cases, guides, labs }) }, () => { if (live) setError('Mock content could not be loaded. Reconnect and try again.') })
    return () => { live = false }
  }, [])
  useEffect(() => {
    if (phase !== 'answer') return
    const tick = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(tick)
  }, [phase])

  function update(next: Draft | undefined) {
    setDraft(next)
    setSaveFailed(!writeDraft(next))
  }

  const mock: Mock | undefined = draft && data ? buildMock(draft.track, draft.level, draft.seed, data) : undefined

  if (!draft) {
    const history = [...app.progress.mocks ?? []].reverse().slice(0, 5)
    return <>
      <a className="back-link" href="#practice"><Icon name="back" size={16} /> Practice</a>
      <div className="page-heading"><div><div className="eyebrow">PRACTICE · MOCK INTERVIEWS</div><h1 ref={app.heading} tabIndex={-1}>Mock interviews</h1><p>A timed round from the content you study. Answer first, then score yourself against the rubric.</p></div><span className="pill">{app.progress.mocks?.length ?? 0} done</span></div>
      {error && <p className="alert" role="alert">{error}</p>}
      <fieldset className="field"><legend>Level</legend><div className="chip-group">{(['se', 'sse'] as const).map(item => <label key={item} className="chip"><input type="radio" name="mock-level" checked={level === item} onChange={() => setLevel(item)} />{item === 'se' ? 'SE' : 'SSE (senior)'}</label>)}</div></fieldset>
      <div className="tool-grid">{tracks.map(item => <button key={item.id} type="button" className="tool-card live mock-pick" disabled={!data} onClick={() => {
        const started = Date.now()
        setSaved(undefined)
        update({ track: item.id, level, seed: Math.floor(Math.random() * 1_000_000_000), startedAt: started, endsAt: started + MOCK_MINUTES[item.id] * 60_000, answers: [], checked: [] })
        setNow(started)
      }}><span className="tool-icon"><Icon name="clock" /></span><h2>{item.title}</h2><span className="pill">{MOCK_MINUTES[item.id]} min</span></button>)}</div>
      {saved && <p className="alert success" role="status">Saved {saved.percent}%. +{saved.xp} XP</p>}
      {history.length > 0 && <section className="upcoming"><h2>Recent mocks</h2>{history.map(item => <div className="upcoming-row" key={item.at}><span>{tracks.find(t => t.id === item.track)?.title} · {item.percent}%</span><span>{displayDate(item.at.slice(0, 10))}</span></div>)}</section>}
    </>
  }

  const title = tracks.find(item => item.id === draft.track)?.title ?? ''
  const remaining = draft.endsAt - now
  if (!mock) return <><div className="page-heading"><div><div className="eyebrow">MOCK INTERVIEW</div><h1 ref={app.heading} tabIndex={-1}>{title}</h1></div></div>{error ? <p className="alert" role="alert">{error}</p> : <p role="status">Loading mock…</p>}</>
  const percent = mockScore(mock, draft.checked)

  function discard() {
    if (phase === 'answer' && draft!.answers.some(answer => answer.trim()) && !window.confirm('Discard this mock and its answers?')) return
    update(undefined)
  }

  return <>
    <button type="button" className="back-link text-button" onClick={discard}><Icon name="back" size={16} /> {phase === 'review' ? 'Discard and pick another' : 'Quit mock'}</button>
    <div className="page-heading"><div><div className="eyebrow">MOCK INTERVIEW · {draft.level === 'sse' ? 'SSE' : 'SE'}</div><h1 ref={app.heading} tabIndex={-1}>{title}</h1></div>
      {phase === 'answer' && <span className={`timer${remaining <= 5 * 60_000 ? ' warn' : ''}`} role="timer" aria-label="Time remaining">{remaining > 0 ? formatTime(remaining) : 'Time’s up'}</span>}</div>
    {saveFailed && <p className="alert" role="alert">Couldn't save on this device. Storage may be full or blocked.</p>}
    {phase === 'review' && <h2 ref={reviewHeading} tabIndex={-1} className="section-title">Score yourself</h2>}
    <ol className="mock-questions">{mock.questions.map((question, index) => <li key={index} className="card mock-question">
      <span className="eyebrow">QUESTION {index + 1} · {question.title.toUpperCase()}</span>
      <p className="mock-prompt">{question.prompt}</p>
      {question.code && <pre className="mock-code"><code>{question.code}</code></pre>}
      {phase === 'answer' && question.kind === 'problem' && <a className="text-button" href={`#code/${question.ref}`} target="_blank" rel="noreferrer">Open in code runner <Icon name="arrow" size={14} /></a>}
      {phase === 'answer' && question.kind === 'guide' && <a className="text-button" href={`#guide/${question.ref}`} target="_blank" rel="noreferrer">Read the Field Guide entry <Icon name="arrow" size={14} /></a>}
      {phase === 'answer' && question.kind === 'case' && <a className="text-button" href="#board" target="_blank" rel="noreferrer">Open a whiteboard <Icon name="arrow" size={14} /></a>}
      {phase === 'answer' ? <>
        <label htmlFor={`answer-${index}`}>Your answer</label>
        <textarea id={`answer-${index}`} rows={6} maxLength={MAX_ANSWER} value={draft.answers[index] ?? ''} onChange={event => { const answers = [...draft.answers]; answers[index] = event.target.value; update({ ...draft, answers }) }} />
      </> : <>
        <div className="compare">
          <div><h3>Your answer</h3>{draft.answers[index]?.trim() ? <p className="notes-text">{draft.answers[index]}</p> : <p className="muted">No notes.</p>}</div>
          <div><h3>Model answer</h3><p className="notes-text">{question.answer}</p></div>
        </div>
        <fieldset className="mock-rubric"><legend>Rubric</legend>{question.rubric.map((item, at) => <label key={item} className="check-row"><input type="checkbox" checked={!!draft.checked[index]?.[at]} onChange={event => {
          const checked = mock.questions.map((q, i) => q.rubric.map((_, j) => i === index && j === at ? event.target.checked : !!draft.checked[i]?.[j]))
          update({ ...draft, checked })
          setSaved(undefined)
        }} />{item}</label>)}</fieldset>
      </>}
    </li>)}</ol>
    {phase === 'answer' ? <div className="button-row"><button type="button" className="primary" onClick={() => update({ ...draft, finishedAt: Math.min(Date.now(), draft.endsAt) })}>Finish &amp; review</button></div>
      : <div className="score-row"><span className="score" aria-live="polite">Score: {percent}%</span><button type="button" className="primary" onClick={() => {
        const minutes = Math.round((draft.finishedAt! - draft.startedAt) / 60_000)
        const xp = app.finishMock({ track: draft.track, percent, minutes })
        update(undefined)
        setSaved({ percent, xp })
      }}>Save result</button></div>}
  </>
}
