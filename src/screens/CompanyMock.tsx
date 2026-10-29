import { useEffect, useRef, useState } from 'react'
import type { AppModel } from '../app-model'
import Icon from '../components/Icon'
import { companyIds, loadCompanies } from '../companies'
import type { Company } from '../company-types'
import { buildCompanyMock, ROUND_LABEL } from '../company-mock'
import type { CompanyMock as Loop } from '../company-mock'
import { loadCases } from '../cases'
import { loadProblems } from '../problems'
import { displayDate } from '../format'
import { mockScore } from '../mocks'
import type { MockLevel } from '../mocks'
import type { DesignCase } from '../case-types'
import type { Problem } from '../problem-types'
import { useBusy, useSaveCheck } from '../relaunch-guard'

export const COMPANY_DRAFT_KEY = 'devprep.company-mock.v1'
const MAX_ANSWER = 8_000
interface Draft {
  company: string
  level: MockLevel
  seed: number
  startedAt: number
  round: number
  roundEndsAt: number
  finishedAt?: number
  answers: string[]
  checked: boolean[][]
}

function readDraft(): Draft | undefined {
  try {
    const raw = JSON.parse(window.localStorage.getItem(COMPANY_DRAFT_KEY) ?? 'null') as Draft | null
    if (!raw || !companyIds.includes(raw.company) || (raw.level !== 'se' && raw.level !== 'sse') || !Number.isFinite(raw.seed) || !Number.isInteger(raw.round) || raw.round < 0
      || !Number.isFinite(raw.startedAt) || !Number.isFinite(raw.roundEndsAt) || !Array.isArray(raw.answers) || !Array.isArray(raw.checked)) return undefined
    return raw
  } catch { return undefined }
}
function writeDraft(draft: Draft | undefined): boolean {
  try {
    if (draft) window.localStorage.setItem(COMPANY_DRAFT_KEY, JSON.stringify(draft))
    else window.localStorage.removeItem(COMPANY_DRAFT_KEY)
    return true
  } catch { return false }
}

const formatTime = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

interface Data { company: Company; problems: Map<string, Problem>; cases: Map<string, DesignCase> }

/** A timed company mock loop: one round at a time, each with its own timer, then rubric self-scoring. */
export default function CompanyMock({ app, companyId }: { app: AppModel; companyId: string }) {
  const [stored, setStored] = useState<Draft | undefined>(readDraft)
  const [data, setData] = useState<Data>()
  const [error, setError] = useState('')
  const [saveFailed, setSaveFailed] = useState(false)
  const [saved, setSaved] = useState<{ percent: number; xp: number }>()
  const [now, setNow] = useState(() => Date.now())
  const [level, setLevel] = useState<MockLevel>(app.progress.selectedPath === 'senior' ? 'sse' : 'se')
  const reviewHeading = useRef<HTMLHeadingElement>(null)
  const roundHeading = useRef<HTMLHeadingElement>(null)
  const draft = stored?.company === companyId ? stored : undefined
  const phase = !draft ? 'intro' : draft.finishedAt === undefined ? 'answer' : 'review'
  useSaveCheck(() => stored && !writeDraft(stored) ? 'Your mock answers could not be saved.' : undefined)
  useBusy(phase === 'answer' && 'A timed mock interview')
  useEffect(() => {
    let live = true
    Promise.all([loadCompanies(), loadProblems(), loadCases()]).then(([companies, problems, cases]) => {
      const company = companies.get(companyId)
      if (!live) return
      if (company) setData({ company, problems, cases })
      else setError('This company could not be found.')
    }, () => { if (live) setError('Mock content could not be loaded. Reconnect and try again.') })
    return () => { live = false }
  }, [companyId])
  useEffect(() => { (phase === 'review' ? reviewHeading : app.heading).current?.focus() }, [app.heading, phase, !!data])
  useEffect(() => {
    if (phase !== 'answer') return
    setNow(Date.now())
    const tick = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(tick)
  }, [phase])

  function update(next: Draft | undefined) {
    setStored(next)
    setSaveFailed(!writeDraft(next))
  }

  if (error) return <><a className="back-link" href="#company"><Icon name="back" size={16} /> All companies</a><p className="alert" role="alert">{error}</p></>
  if (!data) return <p role="status">Loading mock loop…</p>
  const { company } = data
  const loop: Loop | undefined = draft ? buildCompanyMock(company, draft.level, draft.seed, data) : undefined
  const back = <a className="back-link" href={`#company/${company.id}`}><Icon name="back" size={16} /> {company.name}</a>

  if (!draft || !loop) {
    const preview = buildCompanyMock(company, level, 0, data)
    const history = [...app.progress.companyMocks?.[company.id] ?? []].reverse().slice(0, 5)
    const otherDraft = stored && stored.company !== companyId
    return <>
      {back}
      <div className="page-heading"><div><div className="eyebrow">COMPANY PREP · MOCK LOOP</div><h1 ref={app.heading} tabIndex={-1}>{company.name} mock loop</h1><p>{company.mock.note}</p></div><span className="pill"><Icon name="clock" size={14} />{preview.minutes} min</span></div>
      <p className="muted">Practice only: questions come from DevPREP problems, design cases and {company.name}’s published values, never real interview questions.</p>
      <ol className="mock-rounds">{preview.rounds.map((round, index) => <li key={index} className="card mock-round-card"><span className="eyebrow">ROUND {index + 1}</span><strong>{ROUND_LABEL[round.kind]}</strong><span className="pill">{round.minutes} min</span></li>)}</ol>
      <fieldset className="field"><legend>Level</legend><div className="chip-group">{(['se', 'sse'] as const).map(item => <label key={item} className="chip"><input type="radio" name="company-mock-level" checked={level === item} onChange={() => setLevel(item)} />{item === 'se' ? 'SE' : 'SSE (senior)'}</label>)}</div></fieldset>
      {saveFailed && <p className="alert" role="alert">Couldn't save on this device. Storage may be full or blocked.</p>}
      <div className="button-row"><button type="button" className="primary" onClick={() => {
        if (otherDraft && stored!.answers.some(answer => answer?.trim()) && !window.confirm('You have a mock loop open for another company. Replace it?')) return
        const started = Date.now()
        setSaved(undefined)
        update({ company: company.id, level, seed: Math.floor(Math.random() * 1_000_000_000), startedAt: started, round: 0, roundEndsAt: started + preview.rounds[0].minutes * 60_000, answers: [], checked: [] })
        setNow(started)
      }}><Icon name="clock" size={16} />Start mock loop</button></div>
      {saved && <p className="alert success" role="status">Saved {saved.percent}%. +{saved.xp} XP</p>}
      {history.length > 0 && <section className="upcoming"><h2>Recent {company.name} mocks</h2>{history.map(item => <div className="upcoming-row" key={item.at}><span>{item.percent}% · {item.level === 'sse' ? 'SSE' : 'SE'} · {item.minutes} min</span><span>{displayDate(item.at.slice(0, 10))}</span></div>)}</section>}
    </>
  }

  const percent = mockScore(loop, draft.checked)
  const current = Math.min(draft.round, loop.rounds.length - 1)
  const round = loop.rounds[current]
  const remaining = draft.roundEndsAt - now
  const last = current === loop.rounds.length - 1

  function discard() {
    if (phase === 'answer' && draft!.answers.some(answer => answer?.trim()) && !window.confirm('Discard this mock loop and its answers?')) return
    update(undefined)
  }
  function next() {
    const at = Date.now()
    if (last) update({ ...draft!, finishedAt: at })
    else {
      update({ ...draft!, round: current + 1, roundEndsAt: at + loop!.rounds[current + 1].minutes * 60_000 })
      setNow(at)
      roundHeading.current?.focus()
    }
  }

  const heading = <div className="page-heading"><div><div className="eyebrow">{company.name.toUpperCase()} MOCK LOOP · {draft.level === 'sse' ? 'SSE' : 'SE'}</div><h1 ref={app.heading} tabIndex={-1}>{company.name} mock loop</h1></div>
    {phase === 'answer' && <span className={`timer${remaining <= 5 * 60_000 ? ' warn' : ''}`} role="timer" aria-label={`Round ${current + 1} time remaining`}>{remaining > 0 ? formatTime(remaining) : 'Time’s up'}</span>}</div>

  if (phase === 'answer') {
    const question = round.question
    return <>
      <button type="button" className="back-link text-button" onClick={discard}><Icon name="back" size={16} /> Quit mock loop</button>
      {heading}
      {saveFailed && <p className="alert" role="alert">Couldn't save on this device. Storage may be full or blocked.</p>}
      <ol className="mock-progress" aria-label="Rounds">{loop.rounds.map((item, index) => <li key={index} className={index === current ? 'current' : index < current ? 'done' : ''} aria-current={index === current ? 'step' : undefined}>{index + 1}. {ROUND_LABEL[item.kind]}</li>)}</ol>
      <div className="card mock-question">
        <h2 ref={roundHeading} tabIndex={-1} className="section-title">Round {current + 1} of {loop.rounds.length}: {ROUND_LABEL[round.kind]} · {round.minutes} min</h2>
        <span className="eyebrow">{question.title.toUpperCase()}</span>
        <p className="mock-prompt">{question.prompt}</p>
        {question.kind === 'problem' && <a className="text-button" href={`#code/${question.ref}`} target="_blank" rel="noreferrer">Open in code runner <Icon name="arrow" size={14} /></a>}
        {question.kind === 'case' && <a className="text-button" href="#board" target="_blank" rel="noreferrer">Open a whiteboard <Icon name="arrow" size={14} /></a>}
        <label htmlFor={`round-answer-${current}`}>Your answer</label>
        <textarea id={`round-answer-${current}`} rows={8} maxLength={MAX_ANSWER} value={draft.answers[current] ?? ''} onChange={event => { const answers = [...draft.answers]; answers[current] = event.target.value; update({ ...draft, answers }) }} />
      </div>
      <div className="button-row"><button type="button" className="primary" onClick={next}>{last ? <>Finish &amp; review</> : <>Next round <Icon name="arrow" size={16} /></>}</button></div>
    </>
  }

  return <>
    <button type="button" className="back-link text-button" onClick={discard}><Icon name="back" size={16} /> Discard mock loop</button>
    {heading}
    {saveFailed && <p className="alert" role="alert">Couldn't save on this device. Storage may be full or blocked.</p>}
    <h2 ref={reviewHeading} tabIndex={-1} className="section-title">Score yourself</h2>
    <ol className="mock-questions">{loop.rounds.map((item, index) => <li key={index} className="card mock-question">
      <span className="eyebrow">ROUND {index + 1} · {ROUND_LABEL[item.kind].toUpperCase()} · {item.question.title.toUpperCase()}</span>
      <p className="mock-prompt">{item.question.prompt}</p>
      <div className="compare">
        <div><h3>Your answer</h3>{draft.answers[index]?.trim() ? <p className="notes-text">{draft.answers[index]}</p> : <p className="muted">No notes.</p>}</div>
        <div><h3>Model answer</h3><p className="notes-text">{item.question.answer}</p></div>
      </div>
      <fieldset className="mock-rubric"><legend>Rubric, round {index + 1}</legend>{item.question.rubric.map((line, at) => <label key={line} className="check-row"><input type="checkbox" checked={!!draft.checked[index]?.[at]} onChange={event => {
        const checked = loop.questions.map((q, i) => q.rubric.map((_, j) => i === index && j === at ? event.target.checked : !!draft.checked[i]?.[j]))
        update({ ...draft, checked })
      }} />{line}</label>)}</fieldset>
    </li>)}</ol>
    <div className="score-row"><span className="score" aria-live="polite">Score: {percent}%</span><button type="button" className="primary" onClick={() => {
      const minutes = Math.round((draft.finishedAt! - draft.startedAt) / 60_000)
      const xp = app.finishCompanyMock(company.id, { level: draft.level, percent, minutes, rounds: loop.rounds.length })
      update(undefined)
      setSaved({ percent, xp })
    }}>Save result</button></div>
  </>
}
