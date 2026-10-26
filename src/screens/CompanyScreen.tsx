import { useEffect, useState } from 'react'
import Icon from '../components/Icon'
import type { AppModel } from '../app-model'
import { companyIds, loadCompanies } from '../companies'
import type { Company } from '../company-types'
import { describeFocus, describeLoop, layoutFocus, layoutLoop } from '../company-layout'
import { pickProblems, readLocal, setNote, writeLocal, MAX_NOTE } from '../company-notes'
import type { ActiveRun, CompanyLocal } from '../company-notes'
import { problemIndex } from '../problems'
import { patternIndex } from '../patterns'
import { caseIndex } from '../cases'
import { clock, duration } from '../practice'
import '../diagram.css'
import '../field-guide.css'
import '../company.css'

const REPORTED_NOTE = 'Commonly reported by candidates in public write-ups; an editorial estimate, not an official list.'
const monthYear = (asOf: string) => new Date(`${asOf}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
const problemTitle = (id: string) => problemIndex.find(problem => problem.id === id)?.title ?? id
const patternTitle = (id: string) => patternIndex.find(page => page.id === id)?.title ?? id

export default function CompanyScreen({ app, companyId }: { app: AppModel; companyId?: string }) {
  const [companies, setCompanies] = useState<Map<string, Company>>()
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    loadCompanies().then(all => { if (live) setCompanies(all) }, () => { if (live) setError('Company prep could not be loaded. Reconnect and try again.') })
    return () => { live = false }
  }, [])
  // Lazy screen: focus our own heading once the content is in.
  useEffect(() => { app.heading.current?.focus() }, [app.heading, companyId, !!companies])
  if (error) return <div className="alert" role="alert">{error}</div>
  if (!companies) return <p role="status">Loading company prep…</p>
  const company = companyId ? companies.get(companyId) : undefined
  return company ? <CompanyPage key={company.id} app={app} company={company} /> : <CompanyList app={app} companies={companies} />
}

function CompanyList({ app, companies }: { app: AppModel; companies: Map<string, Company> }) {
  const list = companyIds.map(id => companies.get(id)).filter((item): item is Company => !!item)
  const practised = list.filter(item => app.progress.companies?.[item.id]).length
  return <>
    <a className="back-link" href="#practice"><Icon name="back" size={16} /> Practice</a>
    <div className="page-heading"><div><div className="eyebrow">PRACTICE · COMPANY PREP</div><h1 ref={app.heading} tabIndex={-1}>Company prep</h1><p>How big tech firms interview, what candidates report they focus on, and a timed practice set built from DevPREP problems.</p></div><span className="pill">{practised} of {list.length} practised</span></div>
    <p className="muted company-disclaimer">Processes are paraphrased from each company’s careers pages and change often. Practice sets use DevPREP’s own problems, never real interview questions.</p>
    <ul className="company-grid">{list.map(item => {
      const runs = app.progress.companies?.[item.id]?.length ?? 0
      return <li key={item.id}><a className="card company-card" href={`#company/${item.id}`}>
        <h2>{item.name}</h2><p>{item.summary}</p>
        <span className="code-row-meta"><span className="pill"><Icon name="clock" size={14} />{item.practice.minutes} min · {item.practice.count} problems</span>{runs > 0 && <span className="pill solved"><Icon name="check" size={14} />{runs} {runs === 1 ? 'run' : 'runs'}</span>}</span>
      </a></li>
    })}</ul>
  </>
}

function CompanyPage({ app, company }: { app: AppModel; company: Company }) {
  const [local, setLocal] = useState<CompanyLocal>(() => readLocal())
  const [saveError, setSaveError] = useState('')
  function save(next: CompanyLocal) {
    setLocal(next)
    setSaveError(writeLocal(next) ? '' : 'Notes could not be saved on this device. Copy them somewhere safe.')
  }
  const runs = app.progress.companies?.[company.id] ?? []
  return <>
    <a className="back-link" href="#company"><Icon name="back" size={16} /> All companies</a>
    <div className="page-heading"><div><div className="eyebrow">COMPANY PREP · AS OF {monthYear(company.asOf).toUpperCase()}</div><h1 ref={app.heading} tabIndex={-1}>{company.name}</h1><p>{company.summary}</p></div>{runs.length > 0 && <span className="pill solved"><Icon name="check" size={14} />{runs.length} {runs.length === 1 ? 'run' : 'runs'}</span>}</div>

    <section className="card company-section" aria-labelledby="co-process">
      <h2 id="co-process">Interview process</h2>
      <p>{company.process.note}</p>
      <LoopFigure company={company} />
      <ol className="company-stages">{company.process.stages.map(stage => <li key={stage.name}><strong>{stage.name}</strong> <span className={`pill basis-${stage.basis}`}>{stage.basis === 'official' ? 'Official' : 'Reported'}</span><p>{stage.detail}</p></li>)}</ol>
    </section>

    <section className="card company-section" aria-labelledby="co-focus">
      <h2 id="co-focus">Commonly reported focus areas</h2>
      <p className="muted">{REPORTED_NOTE}</p>
      <FocusFigure company={company} />
      <ul className="company-focus">{company.focus.map(item => <li key={item.label}><strong>{item.label}</strong>: {item.patterns.map((id, n) => <span key={id}>{n > 0 && ', '}<a href={`#patterns/${id}`}>{patternTitle(id)}</a></span>)}</li>)}</ul>
    </section>

    <Practice app={app} company={company} local={local} save={save} />

    <section className="card company-section" aria-labelledby="co-design">
      <h2 id="co-design">System design themes</h2>
      <p>{company.design.note}</p>
      <ul className="company-links">{company.design.cases.map(id => {
        const item = caseIndex.find(entry => entry.id === id)
        return <li key={id}><a href={`#design/${id}`}>{item?.title ?? id}</a> <span className="muted">· {item?.minutes ?? 45} min with whiteboard practice</span></li>
      })}</ul>
    </section>

    <section className="card company-section" aria-labelledby="co-values">
      <h2 id="co-values">Behavioural: {company.values.title}</h2>
      <p>{company.values.summary} <a href={company.values.url} target="_blank" rel="noreferrer">Read the official page<span className="sr-only"> (opens in a new tab)</span></a></p>
      <dl className="company-values">{company.values.items.map(item => <div key={item.name}><dt>{item.name}</dt><dd>{item.gist}</dd></div>)}</dl>
      <h3>Practice prompts</h3>
      <p className="muted">Answer with STAR: situation, task, action, result. Notes stay on this device and are not in backups. Polish your best ones in the <a href="#stories">story bank</a>.</p>
      {saveError && <p className="alert" role="alert">{saveError}</p>}
      <ol className="company-prompts">{company.values.prompts.map(prompt => <li key={prompt.id}>
        <label htmlFor={`star-${prompt.id}`}>{prompt.text}</label>
        <textarea id={`star-${prompt.id}`} rows={4} maxLength={MAX_NOTE} placeholder="Situation… Task… Action… Result…" value={local.notes[company.id]?.[prompt.id] ?? ''} onChange={event => save(setNote(local, company.id, prompt.id, event.target.value))} />
      </li>)}</ol>
    </section>

    <section className="card company-section" aria-labelledby="co-sources">
      <h2 id="co-sources">Sources</h2>
      <ul className="fg-sources">{company.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}<span className="sr-only"> (opens in a new tab)</span></a> <span className="muted">· {source.kind === 'official' ? 'Official' : 'Reported'}, checked {monthYear(company.asOf)}</span></li>)}</ul>
      <p className="muted">Paraphrased in our own words. Anything not on an official page is marked as reported. Check with your recruiter: formats vary by role and level.</p>
    </section>
  </>
}

function solvedSince(app: AppModel, id: string, since: number) {
  return Object.values(app.progress.solved?.[id] ?? {}).some(at => Date.parse(at as string) >= since)
}

function Practice({ app, company, local, save }: { app: AppModel; company: Company; local: CompanyLocal; save: (next: CompanyLocal) => void }) {
  const run = local.run?.companyId === company.id ? local.run : undefined
  const [now, setNow] = useState(() => Date.now())
  const [result, setResult] = useState('')
  useEffect(() => {
    if (!run) return
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [run])
  const runs = app.progress.companies?.[company.id] ?? []
  const solved = (id: string) => !!app.progress.solved?.[id]
  const done = (current: ActiveRun, id: string) => current.done.includes(id) || solvedSince(app, id, current.startedAt)
  const otherRun = local.run && local.run.companyId !== company.id
  const last = runs.at(-1)

  function start() {
    if (otherRun && !window.confirm('You have a timed run open for another company. Replace it?')) return
    setResult('')
    save({ ...local, run: { companyId: company.id, problems: pickProblems(company, solved, runs.length), minutes: company.practice.minutes, startedAt: Date.now(), done: [] } })
  }
  function toggle(id: string, checked: boolean) {
    if (!run) return
    save({ ...local, run: { ...run, done: checked ? [...run.done, id] : run.done.filter(item => item !== id) } })
  }
  function finish() {
    if (!run) return
    const seconds = Math.min(86_400, Math.max(0, Math.round((Date.now() - run.startedAt) / 1000)))
    const count = run.problems.filter(id => done(run, id)).length
    const xp = app.finishCompanyRun(company.id, { seconds, done: count, total: run.problems.length })
    save({ ...local, run: undefined })
    setResult(`Run saved: ${count} of ${run.problems.length} done in ${duration(seconds * 1000)}${xp ? ` · +${xp} XP` : ''}.`)
  }
  function cancel() {
    if (window.confirm('Discard this timed run? Nothing will be saved.')) save({ ...local, run: undefined })
  }

  const left = run ? run.minutes * 60_000 - (now - run.startedAt) : 0
  return <section className="card company-section" aria-labelledby="co-practice">
    <h2 id="co-practice">Practice set</h2>
    <p>{company.practice.count} problems in {company.practice.minutes} minutes, picked from this set. Solve them in the code runner; a pass during the run counts as done, or tick it yourself.</p>
    {result && <p className="notice" role="status">{result}</p>}
    {run ? <div className="company-run" aria-label="Timed run">
      <div className="practice-clock"><span className={`timer${left <= 5 * 60_000 ? ' warn' : ''}`} role="timer" aria-label={left < 0 ? 'Time over' : 'Time remaining'}>{clock(left)}</span><span className="muted">{left < 0 ? 'over' : 'left'} of {run.minutes} min</span></div>
      <ul className="company-run-list">{run.problems.map(id => <li key={id}>
        <input type="checkbox" id={`run-${id}`} checked={done(run, id)} disabled={solvedSince(app, id, run.startedAt)} onChange={event => toggle(id, event.target.checked)} />
        <label htmlFor={`run-${id}`}>Done: {problemTitle(id)}</label>
        <a href={`#code/${id}`}>Open {problemTitle(id)}</a>
      </li>)}</ul>
      <div className="button-row"><button type="button" className="primary" onClick={finish}>Finish run</button><button type="button" onClick={cancel}>Discard</button></div>
    </div> : <div className="button-row"><button type="button" className="primary" onClick={start}><Icon name="clock" size={16} />Start {company.practice.minutes}-minute practice</button></div>}
    {last && <p className="muted">Last run: {last.done} of {last.total} done in {duration(last.seconds * 1000)}. {runs.length} {runs.length === 1 ? 'run' : 'runs'} so far.</p>}
    <h3>The full set</h3>
    <ul className="card code-list company-set">{company.practice.problems.map(id => <li key={id} className="code-row">
      <a href={`#code/${id}`}>{problemTitle(id)}</a>
      <span className="code-row-meta">{solved(id) ? <span className="pill solved"><Icon name="check" size={14} />Solved</span> : <span className="pill">To do</span>}</span>
    </li>)}</ul>
    <p>Patterns to revise first: {company.practice.patterns.map((id, n) => <span key={id}>{n > 0 && ', '}<a href={`#patterns/${id}`}>{patternTitle(id)}</a></span>)}.</p>
  </section>
}

function LoopFigure({ company }: { company: Company }) {
  const layout = layoutLoop(company)
  const title = `${company.name} interview loop`
  return <figure className="dg-figure company-figure" aria-label={`Figure 1: ${title}`}>
    <p className="dg-title"><span className="dg-number">Figure 1</span> {title}</p>
    <div className="dg-scroll">
      <svg viewBox={`0 0 ${layout.width} ${layout.height}`} className="dg-svg company-svg" role="img" aria-labelledby={`loop-title loop-desc`}>
        <title id="loop-title">{title}</title>
        <desc id="loop-desc">{describeLoop(company).join(' ')}</desc>
        <rect width={layout.width} height={layout.height} rx="10" className="dg-bg" />
        <line x1={layout.railX} x2={layout.railX} y1={layout.stages[0].top + 12} y2={layout.stages.at(-1)!.top + 12} className="dg-axis" />
        {layout.stages.map((stage, index) => <g key={stage.name} className="co-stage">
          <circle cx={layout.railX} cy={stage.top + 12} r="11" className="co-marker" />
          <text x={layout.railX} y={stage.top + 16.5} textAnchor="middle" className="dg-label">{index + 1}</text>
          <text x={layout.textX} y={stage.top + 11} className="dg-label">{stage.name}</text>
          <text x={layout.textX} y={stage.top + 27} className="dg-tag">{stage.tag}</text>
          {stage.lines.map((line, n) => <text key={n} x={layout.textX} y={stage.top + 45 + n * layout.lineHeight} className="dg-text">{line}</text>)}
        </g>)}
      </svg>
    </div>
    <figcaption>Stages run top to bottom. “Official” stages come from the company’s own pages; “reported” ones come from candidate reports.</figcaption>
    <details className="dg-description"><summary>Text description</summary><ol>{describeLoop(company).map(line => <li key={line}>{line}</li>)}</ol></details>
  </figure>
}

function FocusFigure({ company }: { company: Company }) {
  const layout = layoutFocus(company)
  const title = `${company.name} focus areas by reported emphasis`
  return <figure className="dg-figure company-figure" aria-label={`Figure 2: ${title}`}>
    <p className="dg-title"><span className="dg-number">Figure 2</span> {title}</p>
    <div className="dg-scroll">
      <svg viewBox={`0 0 ${layout.width} ${layout.height}`} className="dg-svg company-svg" role="img" aria-labelledby="focus-title focus-desc">
        <title id="focus-title">{title}</title>
        <desc id="focus-desc">{describeFocus(company).join(' ')}</desc>
        <rect width={layout.width} height={layout.height} rx="10" className="dg-bg" />
        {layout.rows.map(row => <g key={row.label} className="co-focus-row">
          <text x="14" y={row.top + 12} className="dg-label">{row.label}</text>
          <rect x="14" y={row.top + 18} width={layout.track} height="14" rx="4" className="co-track" />
          <rect x="14" y={row.top + 18} width={row.width} height="14" rx="4" className="co-fill" />
          <text x={22 + layout.track} y={row.top + 30} className="dg-sub">{row.level}</text>
        </g>)}
      </svg>
    </div>
    <figcaption>Longer bars mean candidates mention the area more often. This is our estimate from public reports, not company guidance.</figcaption>
    <details className="dg-description"><summary>Text description</summary><ul>{describeFocus(company).map(line => <li key={line}>{line}</li>)}</ul></details>
  </figure>
}
