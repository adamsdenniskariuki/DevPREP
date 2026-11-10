import { useEffect, useState } from 'react'
import { itemText, loadPlans, positionFor, readPlans, weekCount, weeksFor, type PlanProgress, type StudyPlan } from '../study-plans'
import '../plans.css'

function PlanToday({ plan, entry, today, heading }: { plan: StudyPlan; entry: PlanProgress; today: string; heading: boolean }) {
  const position = positionFor(entry.start!, today, weekCount(plan))
  const week = position.status === 'active' ? weeksFor(plan, entry.track).find(item => item.n === position.week) : undefined
  const day = week && position.status === 'active' ? week.days[position.day - 1] : undefined
  return <div className="plans-home-plan">
    {heading && <h3>{plan.title}</h3>}
    {position.status === 'upcoming' && <p>{plan.title} starts in {position.daysUntil} {position.daysUntil === 1 ? 'day' : 'days'}.</p>}
    {position.status === 'finished' && <p>You have finished all {weekCount(plan)} weeks of {plan.title}. Keep a weekly mock going.</p>}
    {week && day && position.status === 'active' && <>
      <p><strong>Week {position.week}, day {position.day}:</strong> {day.title}</p>
      <ul>{day.items.map(item => <li key={item.id} className={entry.done[item.id] ? 'done' : undefined}>{entry.done[item.id] && <span className="sr-only">Done: </span>}{itemText(item, entry.lang)}</li>)}</ul>
    </>}
    <a className="text-button" href={`#plans/${plan.id}`}>Open {plan.title}</a>
  </div>
}

/** "Today in your plan" on the Home screen, one block per started plan. Loaded only when a study plan has a start date. */
export default function PlanTodayCard({ today }: { today: string }) {
  const [plans, setPlans] = useState<StudyPlan[]>()
  useEffect(() => {
    let live = true
    loadPlans().then(list => { if (live) setPlans(list) }, () => undefined)
    return () => { live = false }
  }, [])
  if (!plans) return null
  const state = readPlans()
  const started = plans.filter(item => state[item.id]?.start)
  if (!started.length) return null
  return <section className="card plans-home" aria-labelledby="plans-home-title">
    <h2 id="plans-home-title">Today in your plan{started.length > 1 ? 's' : ''}</h2>
    {started.map(plan => <PlanToday key={plan.id} plan={plan} entry={state[plan.id]} today={today} heading={started.length > 1} />)}
  </section>
}