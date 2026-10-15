import { useEffect } from 'react'
import type { AppModel } from '../app-model'
import Icon from '../components/Icon'
import { lessons } from '../curriculum'
import { planStudy } from '../planner'
import type { PlanItem } from '../planner'
import { displayDate } from '../format'

const ICONS: Record<PlanItem['kind'], string> = { lesson: 'book', cards: 'repeat', problem: 'code', case: 'layers', guide: 'compass', mock: 'clock', rest: 'check' }

export function PlanItemAction({ app, item }: { app: AppModel; item: PlanItem }) {
  const label = <><Icon name={ICONS[item.kind]} size={16} /><span>{item.title}</span>{item.minutes > 0 && <span className="muted">{item.minutes} min</span>}</>
  if (item.kind === 'lesson') {
    const lesson = lessons.find(entry => entry.id === item.ref)!
    return <button type="button" className="plan-item" onClick={() => app.start(lesson, app.progress.records[lesson.id] ? 'review' : 'learn')}>{label}</button>
  }
  const href = item.kind === 'cards' ? '#cards' : item.kind === 'problem' ? `#code/${item.ref}` : item.kind === 'case' ? `#design/${item.ref}` : item.kind === 'guide' ? `#guide/${item.ref}` : item.kind === 'mock' ? '#mock' : undefined
  return href ? <a className="plan-item" href={href}>{label}</a> : <span className="plan-item">{label}</span>
}

export default function PlanScreen({ app }: { app: AppModel }) {
  const { progress, today, changeProfile, heading } = app
  useEffect(() => { heading.current?.focus() }, [heading])
  const plan = planStudy(progress, today)
  const lessonCount = plan.days.flatMap(day => day.items).filter(item => item.kind === 'lesson').length
  return <>
    <div className="page-heading"><div><div className="eyebrow">STUDY PLAN</div><h1 ref={heading} tabIndex={-1}>{plan.dated ? `Plan to ${displayDate(plan.end)}` : 'Your next 7 days'}</h1><p>{lessonCount} lessons scheduled{plan.unscheduled ? `, ${plan.unscheduled} more after this` : ''}. It updates as you study.</p></div></div>
    <section className="card plan-settings">
      <label className="field" htmlFor="plan-date">Interview date
        <span className="inline-field"><input id="plan-date" type="date" min={today} value={progress.profile?.interviewDate ?? ''} onChange={event => changeProfile({ interviewDate: event.target.value || undefined })} />
          {progress.profile?.interviewDate && <button type="button" className="text-button" onClick={() => changeProfile({ interviewDate: undefined })}>Clear</button>}</span></label>
      <p className="muted">Role path and focus tracks come first. <a href="#settings">Change in Settings</a></p>
    </section>
    <ol className="plan-days">{plan.days.map(day => <li key={day.day} className={`card plan-day${day.day === today ? ' today' : ''}`}>
      <h2>{day.day === today ? 'Today' : displayDate(day.day)}<span className="muted">{day.items.reduce((sum, item) => sum + item.minutes, 0)} min</span></h2>
      <ul>{day.items.map((item, index) => <li key={index}><PlanItemAction app={app} item={item} /></li>)}</ul>
    </li>)}</ol>
  </>
}
