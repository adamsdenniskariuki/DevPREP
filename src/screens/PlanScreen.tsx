import { useEffect, useState } from 'react'
import type { AppModel } from '../app-model'
import { planStudy } from '../planner'
import { displayDate } from '../format'
import { companyIds, loadCompanies } from '../companies'
import { PlanItemAction, usePlanCompany } from '../components/PlanItem'

export default function PlanScreen({ app }: { app: AppModel }) {
  const { progress, today, changeProfile, heading } = app
  useEffect(() => { heading.current?.focus() }, [heading])
  const [names, setNames] = useState<Map<string, string>>()
  useEffect(() => {
    let live = true
    loadCompanies().then(all => { if (live) setNames(new Map([...all.values()].map(item => [item.id, item.name]))) }, () => undefined)
    return () => { live = false }
  }, [])
  const target = progress.profile?.targetCompany
  const company = usePlanCompany(target)
  const plan = planStudy(progress, today, company)
  const lessonCount = plan.days.flatMap(day => day.items).filter(item => item.kind === 'lesson').length
  return <>
    <div className="page-heading"><div><div className="eyebrow">STUDY PLAN</div><h1 ref={heading} tabIndex={-1}>{plan.dated ? `Plan to ${displayDate(plan.end)}` : 'Your next 7 days'}</h1><p>{lessonCount} lessons scheduled{plan.unscheduled ? `, ${plan.unscheduled} more after this` : ''}. It updates as you study.</p></div></div>
    <section className="card plan-settings">
      <label className="field" htmlFor="plan-date">Interview date
        <span className="inline-field"><input id="plan-date" type="date" min={today} value={progress.profile?.interviewDate ?? ''} onChange={event => changeProfile({ interviewDate: event.target.value || undefined })} />
          {progress.profile?.interviewDate && <button type="button" className="text-button" onClick={() => changeProfile({ interviewDate: undefined })}>Clear</button>}</span></label>
      <label className="field" htmlFor="plan-company">Target company (optional)
        <select id="plan-company" value={target ?? ''} onChange={event => changeProfile({ targetCompany: event.target.value || undefined })}>
          <option value="">None</option>
          {companyIds.map(id => <option key={id} value={id}>{names?.get(id) ?? id}</option>)}
        </select></label>
      <p className="muted">Role path and focus tracks come first. {company ? <>The plan adds the <a href={`#company/${company.id}`}>{company.name}</a> practice set, values prompts and a mock loop {plan.dated ? 'a few days before the interview' : 'at the end of the week'}. </> : null}<a href="#settings">Change in Settings</a></p>
    </section>
    <ol className="plan-days">{plan.days.map(day => <li key={day.day} className={`card plan-day${day.day === today ? ' today' : ''}`}>
      <h2>{day.day === today ? 'Today' : displayDate(day.day)}<span className="muted">{day.items.reduce((sum, item) => sum + item.minutes, 0)} min</span></h2>
      <ul>{day.items.map((item, index) => <li key={index}><PlanItemAction app={app} item={item} /></li>)}</ul>
    </li>)}</ol>
  </>
}