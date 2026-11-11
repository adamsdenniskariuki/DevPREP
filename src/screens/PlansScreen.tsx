import { lazy, Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import type { AppModel } from '../app-model'
import { lessons } from '../curriculum'
import { displayDate } from '../format'
import {
  forLanguage, isDay, itemText, languageLabel, loadPlans, MAX_ERRORS, MAX_FIELD, MAX_NOTES, MAX_SCORES, newEntryId, PLAN_LANGUAGES, PLANS_KEY, phaseOf, planCount, planHref, positionFor, progressFor,
  readPlans, removeEntry, SCORE_AREAS, SCORE_KIND_LABELS, scoreAverage, setCheck, toggleItem, upsert, weekCount, weekItems, weeksFor, withPlan, writePlans,
  type CheckResult, type ErrorEntry, type PlanItem, type PlanLanguage, type PlanTrack, type PlanProgress, type PlanWeek, type PlansState, type ScoreKind, type Scorecard, type StudyPlan,
} from '../study-plans'
import '../plans.css'
import { planSnippet } from '../plan-playground'
import { loadMathLabs, MATH_PLAN_ID, type MathLab } from '../math-labs'

const MathLabView = lazy(() => import('../components/MathLab'))

/** Plan progress from this device, kept in step with other tabs. */
function usePlanState() {
  const [state, setState] = useState<PlansState>(readPlans)
  const latest = useRef(state)
  latest.current = state
  const [error, setError] = useState('')
  useEffect(() => {
    const onStorage = (event: StorageEvent) => { if (event.key === PLANS_KEY || event.key === null) setState(readPlans()) }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
  const update = useCallback((change: (current: PlansState) => PlansState) => {
    const next = change(latest.current)
    latest.current = next
    setState(next)
    setError(writePlans(next) ? '' : 'This browser would not save your plan progress (private mode or storage full). Changes last until you close the tab.')
  }, [])
  return { state, update, error, setError }
}

function ItemCheck({ item, entry, lang, idPrefix, onToggle, app }: { item: PlanItem; entry: PlanProgress; lang: string | undefined; idPrefix: string; onToggle: (id: string) => void; app: AppModel }) {
  const id = `${idPrefix}-${item.id}`
  const text = itemText(item, lang)
  const lesson = item.lesson ? lessons.find(entry => entry.id === item.lesson) : undefined
  const [failed, setFailed] = useState('')
  // The Playground opens a snippet in the plan's language rather than the last one used.
  const openPlayground = () => {
    try { window.location.hash = `#playground/${planSnippet(lang)}` } catch (error) { setFailed(error instanceof Error ? error.message : 'Could not open the Playground.') }
  }
  return <li className={`plans-item${entry.done[item.id] ? ' done' : ''}`}>
    <input type="checkbox" id={id} checked={!!entry.done[item.id]} onChange={() => onToggle(item.id)} />
    <label htmlFor={id}>{text} <span className="muted">{item.minutes} min</span></label>
    {lesson
      ? <button type="button" className="text-button plans-go" aria-label={`Start lesson: ${lesson.title}`} onClick={() => app.start(lesson, app.progress.records[lesson.id] ? 'review' : 'learn')}>Start lesson</button>
      : item.href === '#playground' ? <button type="button" className="text-button plans-go" aria-label={`Open in the ${languageLabel(lang)} Playground: ${text}`} onClick={openPlayground}>Open</button>
      : item.href ? <a className="plans-go" href={planHref(item.href, lang)} aria-label={`Open: ${text}`}>Open</a> : null}
    {failed && <p className="alert plans-item-alert" role="alert">{failed}</p>}
  </li>
}

function WeekDays({ week, ...rest }: { week: PlanWeek; entry: PlanProgress; lang: string | undefined; onToggle: (id: string) => void; app: AppModel }) {
  return <ol className="plans-days">
    {week.days.map((day, index) => <li key={index}>
      <h3>Day {index + 1}: {day.title}</h3>
      <ul className="plans-items">{day.items.map(item => <ItemCheck key={item.id} item={item} idPrefix="item" {...rest} />)}</ul>
    </li>)}
  </ol>
}

const blankError = { problem: '', pattern: '', why: '', fix: '' }

function ErrorLog({ entry, today, save }: { entry: PlanProgress; today: string; save: (change: (entry: PlanProgress) => PlanProgress) => void }) {
  const [draft, setDraft] = useState(blankError)
  const [editing, setEditing] = useState<string>()
  const [message, setMessage] = useState('')
  const set = (key: keyof typeof blankError) => (value: string) => setDraft(current => ({ ...current, [key]: value }))
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!draft.problem.trim()) return setMessage('Add the problem you missed.')
    try {
      const old = editing ? entry.errors.find(item => item.id === editing) : undefined
      const item: ErrorEntry = { id: old?.id ?? newEntryId('err', entry.errors), at: old?.at ?? today, problem: draft.problem.trim(), pattern: draft.pattern.trim(), why: draft.why.trim(), fix: draft.fix.trim() }
      const errors = upsert(entry.errors, item, MAX_ERRORS)
      save(current => ({ ...current, errors }))
      setDraft(blankError)
      setEditing(undefined)
      setMessage(old ? 'Entry updated.' : 'Entry added.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not add the entry.')
    }
  }
  function edit(item: ErrorEntry) {
    setEditing(item.id)
    setDraft({ problem: item.problem, pattern: item.pattern, why: item.why, fix: item.fix })
    setMessage('')
  }
  const fields: [keyof typeof blankError, string, string][] = [
    ['problem', 'Problem', 'e.g. Merge meeting rooms'], ['pattern', 'Pattern it needed', 'e.g. Intervals: sort by start'],
    ['why', 'Why I missed it', 'e.g. Forgot to sort first'], ['fix', 'What I will do next time', 'e.g. Ask “does order matter?” before coding'],
  ]
  return <section className="card plans-section" aria-labelledby="plans-errors">
    <h2 id="plans-errors">Error log</h2>
    <p className="muted">Log every miss with why it happened and the fix. Reread it in the weekly review.</p>
    <form className="plans-form" onSubmit={submit} aria-label={editing ? 'Edit error-log entry' : 'Add error-log entry'}>
      {fields.map(([key, label, hint]) => <label key={key} className="plans-field">{label}{key === 'problem' ? ' (required)' : ''}
        <input value={draft[key]} maxLength={MAX_FIELD} placeholder={hint} onChange={event => set(key)(event.target.value)} /></label>)}
      <div className="button-row">
        <button type="submit" className="primary">{editing ? 'Save entry' : 'Add entry'}</button>
        {editing && <button type="button" onClick={() => { setEditing(undefined); setDraft(blankError); setMessage('') }}>Cancel</button>}
      </div>
      <p className="muted" role="status">{message}</p>
    </form>
    {entry.errors.length === 0 ? <p className="muted">No entries yet.</p> : <ul className="plans-log">
      {entry.errors.map(item => <li key={item.id} className="plans-log-entry">
        <h3>{item.problem}</h3>
        <p className="muted"><time dateTime={item.at}>{displayDate(item.at)}</time>{item.pattern ? ` · ${item.pattern}` : ''}</p>
        {item.why && <p><strong>Why:</strong> {item.why}</p>}
        {item.fix && <p><strong>Next time:</strong> {item.fix}</p>}
        <div className="button-row">
          <button type="button" className="text-button" aria-label={`Edit: ${item.problem}`} onClick={() => edit(item)}>Edit</button>
          <button type="button" className="text-button" aria-label={`Delete: ${item.problem}`} onClick={() => { if (window.confirm(`Delete “${item.problem}” from the error log?`)) { save(current => ({ ...current, errors: removeEntry(current.errors, item.id) })); setMessage('Entry deleted.') } }}>Delete</button>
        </div>
      </li>)}
    </ul>}
  </section>
}

interface ScoreDraft { kind: ScoreKind; title: string; scores: Scorecard['scores']; notes: string }
const blankScore = (): ScoreDraft => ({ kind: 'dsa', title: '', scores: [2, 2, 2, 2], notes: '' })
const SCORE_PLACEHOLDERS: Record<ScoreKind, string> = { dsa: 'e.g. Course schedule', design: 'e.g. Document Q&A copilot', case: 'e.g. AI for a support inbox', codebase: 'e.g. Checkout: adding an item twice' }

function Scorecards({ entry, today, save }: { entry: PlanProgress; today: string; save: (change: (entry: PlanProgress) => PlanProgress) => void }) {
  const [draft, setDraft] = useState<ScoreDraft>(blankScore)
  const [editing, setEditing] = useState<string>()
  const [message, setMessage] = useState('')
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!draft.title.trim()) return setMessage('Name the mock, e.g. the problem or system.')
    try {
      const old = editing ? entry.scores.find(item => item.id === editing) : undefined
      const card: Scorecard = { id: old?.id ?? newEntryId('score', entry.scores), at: old?.at ?? today, kind: draft.kind, title: draft.title.trim(), scores: draft.scores, notes: draft.notes.trim() }
      const scores = upsert(entry.scores, card, MAX_SCORES)
      save(current => ({ ...current, scores }))
      setDraft(blankScore())
      setEditing(undefined)
      setMessage(old ? 'Scorecard updated.' : 'Scorecard added.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not add the scorecard.')
    }
  }
  return <section className="card plans-section" aria-labelledby="plans-scores">
    <h2 id="plans-scores">Mock scorecards</h2>
    <p className="muted">After each mock, score every area from 1 (not yet) to 4 (strong). Aim for an average of 3 or more. <a href="#mock">Run a mock interview</a></p>
    <form className="plans-form" onSubmit={submit} aria-label={editing ? 'Edit scorecard' : 'Add scorecard'}>
      <fieldset className="plans-radios">
        <legend>Kind of mock</legend>
        {(Object.keys(SCORE_AREAS) as ScoreKind[]).map(kind => <label key={kind}><input type="radio" name="score-kind" value={kind} checked={draft.kind === kind} onChange={() => setDraft(current => ({ ...current, kind }))} /> {SCORE_KIND_LABELS[kind]}</label>)}
      </fieldset>
      <label className="plans-field">Mock (required)<input value={draft.title} maxLength={MAX_FIELD} placeholder={SCORE_PLACEHOLDERS[draft.kind]} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} /></label>
      <div className="plans-score-grid">
        {SCORE_AREAS[draft.kind].map((area, index) => <label key={area} className="plans-field">{area}
          <select value={draft.scores[index]} onChange={event => setDraft(current => {
            const scores = [...current.scores] as Scorecard['scores']
            scores[index] = Number(event.target.value)
            return { ...current, scores }
          })}>{[1, 2, 3, 4].map(score => <option key={score} value={score}>{score}</option>)}</select></label>)}
      </div>
      <label className="plans-field">Notes<textarea className="plans-notes" value={draft.notes} maxLength={MAX_NOTES} onChange={event => setDraft(current => ({ ...current, notes: event.target.value }))} /></label>
      <div className="button-row">
        <button type="submit" className="primary">{editing ? 'Save scorecard' : 'Add scorecard'}</button>
        {editing && <button type="button" onClick={() => { setEditing(undefined); setDraft(blankScore()); setMessage('') }}>Cancel</button>}
      </div>
      <p className="muted" role="status">{message}</p>
    </form>
    {entry.scores.length === 0 ? <p className="muted">No scorecards yet.</p> : <ul className="plans-log">
      {entry.scores.map(card => <li key={card.id} className="plans-log-entry">
        <h3>{card.title} <span className="pill">{SCORE_KIND_LABELS[card.kind]} · average {scoreAverage(card).toFixed(1)}</span></h3>
        <p className="muted"><time dateTime={card.at}>{displayDate(card.at)}</time> · {SCORE_AREAS[card.kind].map((area, index) => `${area} ${card.scores[index]}`).join(', ')}</p>
        {card.notes && <p className="plans-pre">{card.notes}</p>}
        <div className="button-row">
          <button type="button" className="text-button" aria-label={`Edit: ${card.title}`} onClick={() => { setEditing(card.id); setDraft({ kind: card.kind, title: card.title, scores: card.scores, notes: card.notes }); setMessage('') }}>Edit</button>
          <button type="button" className="text-button" aria-label={`Delete: ${card.title}`} onClick={() => { if (window.confirm(`Delete the scorecard “${card.title}”?`)) { save(current => ({ ...current, scores: removeEntry(current.scores, card.id) })); setMessage('Scorecard deleted.') } }}>Delete</button>
        </div>
      </li>)}
    </ul>}
  </section>
}

const CHECK_LABELS: [CheckResult | '', string][] = [['', 'Not yet'], ['pass', 'Passed'], ['fail', 'Not passed']]

function PlanView({ app, plan, entry, save }: { app: AppModel; plan: StudyPlan; entry: PlanProgress; save: (change: (entry: PlanProgress) => PlanProgress) => void }) {
  const { today } = app
  const weeks = weeksFor(plan, entry.track)
  const total = weekCount(plan)
  const position = entry.start ? positionFor(entry.start, today, total) : undefined
  const counts = planCount(plan, entry)
  const track = plan.tracks.find(item => item.id === entry.track) ?? plan.tracks[0] as PlanTrack | undefined
  const languages = PLAN_LANGUAGES.filter(item => plan.languages.includes(item.id))
  // A plan offered in one language always uses it, whatever the saved choice says.
  const lang: PlanLanguage = languages.find(item => item.id === entry.lang)?.id ?? languages[0]?.id ?? PLAN_LANGUAGES[0].id
  const toggle = (id: string) => save(current => toggleItem(current, id, today))
  const shared = { entry, lang, onToggle: toggle, app }
  const currentWeek = position?.status === 'active' ? position.week : undefined
  const todayWeek = currentWeek ? weeks.find(week => week.n === currentWeek) : undefined
  const todayDay = todayWeek && position?.status === 'active' ? todayWeek.days[position.day - 1] : undefined
  const switchable = plan.weeks.filter(week => week.track).map(week => week.n)
  const switchRange = switchable.length ? `weeks ${Math.min(...switchable)}–${Math.max(...switchable)}` : 'the later weeks'

  return <>
    <section className="card plans-section" aria-labelledby="plans-setup">
      <h2 id="plans-setup">Your setup</h2>
      <div className="plans-setup">
        <label className="plans-field" htmlFor="plans-start">Start date
          <span className="plans-inline"><input id="plans-start" type="date" value={entry.start ?? ''} onChange={event => { const value = event.target.value; if (!value || isDay(value)) save(current => { const next = { ...current }; if (value) next.start = value; else delete next.start; return next }) }} />
            {!entry.start && <button type="button" className="primary" onClick={() => save(current => ({ ...current, start: today }))}>Start today</button>}</span></label>
        {languages.length > 1 && <label className="plans-field" htmlFor="plans-lang">Interview language
          <select id="plans-lang" value={lang} onChange={event => save(current => ({ ...current, lang: event.target.value as PlanLanguage }))}>
            {languages.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select></label>}
      </div>
      {track && <fieldset className="plans-radios plans-tracks">
        <legend>Track for {switchRange}</legend>
        {plan.tracks.map(item => <label key={item.id} className="plans-track">
          <input type="radio" name="plans-track" value={item.id} checked={track.id === item.id} onChange={() => save(current => ({ ...current, track: item.id }))} />
          <span><strong>{item.title}</strong><span className="muted"> {item.summary}</span></span>
        </label>)}
      </fieldset>}
      <p className="plans-count"><span>{counts.done} of {counts.total} tasks done</span>{track && <span className="muted">{track.title} track</span>}</p>
      <progress max={counts.total} value={counts.done} aria-label={`${plan.title} progress`} />
    </section>

    <section className="card plans-section plans-today" aria-labelledby="plans-today">
      <h2 id="plans-today">Today</h2>
      {!position && <p>Pick a start date, or press <strong>Start today</strong>, to see each day’s tasks here. You can browse every week below first.</p>}
      {position?.status === 'upcoming' && <p>Your plan starts on {displayDate(entry.start!)}, in {position.daysUntil} {position.daysUntil === 1 ? 'day' : 'days'}. Week 1 is below if you want a head start.</p>}
      {position?.status === 'finished' && <p>You have reached the end of the {total} weeks. Revisit your error log and lowest scorecard areas, and keep one mock a week going until the interview.</p>}
      {todayWeek && todayDay && position?.status === 'active' && <>
        <p><strong>Week {position.week}, day {position.day}:</strong> {todayDay.title} <span className="muted">· {todayWeek.title}</span></p>
        <ul className="plans-items">{todayDay.items.map(item => <ItemCheck key={item.id} item={item} idPrefix="today" {...shared} />)}</ul>
      </>}
    </section>

    <section className="card plans-section" aria-labelledby="plans-rhythm">
      <h2 id="plans-rhythm">Weekly rhythm</h2>
      <p className="muted">About {plan.hoursPerWeek} hours a week. Day 1 of week 1 is your start date.</p>
      <ul className="plans-rhythm">{plan.rhythm.map(item => <li key={item.when}><strong>{item.when}</strong> <span className="pill">{item.time}</span> {item.text}</li>)}</ul>
      <h3>Rules</h3>
      <ul>{plan.rules.map(rule => <li key={rule}>{rule}</li>)}</ul>
      <h3 id="plans-idioms">{languageLabel(lang)} idioms</h3>
      <ul aria-labelledby="plans-idioms">{(forLanguage(plan.tips, lang) ?? []).map(tip => <li key={tip}>{tip}</li>)}</ul>
      {forLanguage(plan.refresher, lang) && <p><a href={forLanguage(plan.refresher, lang)}>Brush up on {languageLabel(lang)} in its track</a>{lang === 'typescript' && <>, then check yourself with the <a href="#skilltest/typescript">timed TypeScript skill test</a></>}</p>}
    </section>

    {plan.phases.map((phase, index) => {
      const previous = plan.phases[index - 1]
      const gate = previous && entry.checks[previous.id] !== 'pass'
      const phaseWeeks = weeks.filter(week => phaseOf(plan, week.n)?.id === phase.id)
      return <section key={phase.id} className="plans-phase" aria-labelledby={`phase-${phase.id}`}>
        <h2 id={`phase-${phase.id}`}>Phase {index + 1}: {phase.title} <span className="muted">weeks {phase.weeks[0]}–{phase.weeks[1]}</span></h2>
        {gate && <p className="notice plans-gate">{entry.checks[previous.id] === 'fail'
          ? `You marked the phase ${index} check as not passed. Spend a few sessions on the misses in your error log, then try it again. You can still work ahead.`
          : `Phase ${index} check not passed yet. It is a soft gate: you can work ahead, but take the check first if you can.`}</p>}
        {phaseWeeks.map(week => {
          const items = weekItems(week)
          const done = items.filter(item => entry.done[item.id]).length
          return <details key={`${week.n}-${week.track ?? ''}`} className="card plans-week" open={week.n === (currentWeek ?? 1)}>
            <summary><span className="plans-week-title">Week {week.n}: {week.title}</span><span className="muted">{done}/{items.length}{week.track && track ? ` · ${track.title}` : ''}{week.n === currentWeek ? ' · This week' : ''}</span></summary>
            <p>{week.focus}</p>
            {forLanguage(week.tip, lang) && <p className="plans-tip"><strong>{languageLabel(lang)} tip:</strong> {forLanguage(week.tip, lang)}</p>}
            <WeekDays week={week} {...shared} />
          </details>
        })}
        <fieldset className="card plans-radios plans-check">
          <legend>Phase {index + 1} check</legend>
          <p>{phase.check}</p>
          {CHECK_LABELS.map(([value, label]) => <label key={label}><input type="radio" name={`check-${phase.id}`} checked={(entry.checks[phase.id] ?? '') === value} onChange={() => save(current => setCheck(current, phase.id, value || undefined))} /> {label}</label>)}
        </fieldset>
      </section>
    })}

    <ErrorLog entry={entry} today={today} save={save} />
    <Scorecards entry={entry} today={today} save={save} />
  </>
}

/** Study plans: the list at #plans and one plan at #plans/<id>. Plan content loads lazily; progress stays on this device. */
export default function PlansScreen({ app, planId, labId }: { app: AppModel; planId?: string; labId?: string }) {
  const [plans, setPlans] = useState<StudyPlan[]>()
  const [failed, setFailed] = useState(false)
  const [labs, setLabs] = useState<MathLab[]>()
  const wantsLabs = !!labId && planId === MATH_PLAN_ID
  useEffect(() => {
    if (!wantsLabs || labs) return
    let live = true
    loadMathLabs().then(list => { if (live) setLabs(list) }, () => { if (live) setFailed(true) })
    return () => { live = false }
  }, [wantsLabs, labs])
  const { state, update, error } = usePlanState()
  useEffect(() => {
    let live = true
    loadPlans().then(list => { if (live) setPlans(list) }, () => { if (live) setFailed(true) })
    return () => { live = false }
  }, [])
  // Lazy screen: focus our own heading once the content is in.
  const ready = !!plans && (!wantsLabs || !!labs)
  useEffect(() => { if (ready) app.heading.current?.focus() }, [app.heading, ready, planId, labId])

  if (failed) return <p className="alert" role="alert">Study plans could not load. Check your connection and reload.</p>
  if (!plans || !ready) return <p role="status">{plans ? 'Loading the lab…' : 'Loading study plans…'}</p>
  const plan = planId ? plans.find(item => item.id === planId) : undefined
  const alert = error && <p className="alert" role="alert">{error}</p>

  if (!plan) {
    if (planId) return <><div className="page-heading"><div><div className="eyebrow">STUDY PLANS</div><h1 ref={app.heading} tabIndex={-1}>Plan not found</h1></div></div><p>That study plan does not exist. <a href="#plans">See all study plans</a></p></>
    return <>
      <div className="page-heading"><div><div className="eyebrow">STUDY PLANS</div><h1 ref={app.heading} tabIndex={-1}>Study plans</h1>
        <p className="helper">Fixed, week-by-week schedules. Each day links straight to the lessons, problems and design cases to work on. Your ticks, error log and scorecards stay on this device and go into backups.</p></div></div>
      {alert}
      <ul className="plans-list">{plans.map(item => {
        const entry = state[item.id]
        const counts = planCount(item, entry)
        return <li key={item.id} className="card plans-card">
          <h2><a href={`#plans/${item.id}`}>{item.title}</a></h2>
          <p>{item.summary}</p>
          <p className="muted">{weekCount(item)} weeks · about {item.hoursPerWeek} hours a week{item.tracks.length ? ` · ${item.tracks.map(trackItem => trackItem.title).join(' or ')} track` : ''}{item.languages.length === 1 ? ` · ${languageLabel(item.languages[0])}` : ''}</p>
          {entry?.start && <><p className="plans-count"><span>{counts.done} of {counts.total} tasks done</span><span className="muted">Started {displayDate(entry.start)}</span></p><progress max={counts.total} value={counts.done} aria-label={`${item.title} progress`} /></>}
        </li>
      })}</ul>
      <section className="card plans-own" aria-labelledby="plans-own">
        <h2 id="plans-own">Prefer a plan that adapts?</h2>
        <p>The Plan page builds a rolling schedule from your interview date, role path and target company. <a href="#plan">Build your own plan</a></p>
      </section>
    </>
  }

  const entry = progressFor(state, plan.id)
  const save = (change: (entry: PlanProgress) => PlanProgress) => update(current => withPlan(current, plan.id, change))
  if (labId) {
    const lab = labs?.find(item => item.id === labId)
    if (!lab || !labs) return <><div className="page-heading"><div><div className="eyebrow">MATH LAB</div><h1 ref={app.heading} tabIndex={-1}>Lab not found</h1></div></div><p>That lab does not exist. <a href={`#plans/${plan.id}`}>Back to {plan.title}</a></p></>
    return <>{alert}<Suspense fallback={<p role="status">Loading the lab…</p>}><MathLabView key={lab.id} app={app} plan={plan} lab={lab} labs={labs} entry={entry} save={save} /></Suspense></>
  }
  return <>
    <div className="page-heading"><div><div className="eyebrow">STUDY PLAN</div><h1 ref={app.heading} tabIndex={-1}>{plan.title}</h1>
      <p className="helper">{plan.summary}</p>
      <p className="helper"><a href="#plans">All study plans</a> · <a href="#plan">Build your own plan</a></p></div></div>
    {alert}
    <PlanView app={app} plan={plan} entry={entry} save={save} />
  </>
}
