import { useEffect, useState } from 'react'
import { itemText, loadPlans, positionFor, readPlans, weekCount, weeksFor, type StudyPlan } from '../study-plans'
import '../plans.css'

/** "Today in your plan" on the Home screen. Loaded only when a study plan has a start date. */
export default function PlanTodayCard({ today }: { today: string }) {
  const [plans, setPlans] = useState<StudyPlan[]>()
  useEffect(() => {
    let live = true
    loadPlans().then(list => { if (live) setPlans(list) }, () => undefined)
    return () => { live = false }
  }, [])
  if (!plans) return null
  const state = readPlans()
  const plan = plans.find(item => state[item.id]?.start)
  if (!plan) return null
  const entry = state[plan.id]
  const position = positionFor(entry.start!, today, weekCount(plan))
  const week = position.status === 'active' ? weeksFor(plan, entry.track).find(item => item.n === position.week) : undefined
  const day = week && position.status === 'active' ? week.days[position.day - 1] : undefined
  return <section className="card plans-home" aria-labelledby="plans-home-title">
    <h2 id="plans-home-title">Today in your plan</h2>
    {position.status === 'upcoming' && <p>{plan.title} starts in {position.daysUntil} {position.daysUntil === 1 ? 'day' : 'days'}.</p>}
    {position.status === 'finished' && <p>You have finished all {weekCount(plan)} weeks of {plan.title}. Keep a weekly mock going.</p>}
    {week && day && position.status === 'active' && <>
      <p><strong>Week {position.week}, day {position.day}:</strong> {day.title}</p>
      <ul>{day.items.map(item => <li key={item.id} className={entry.done[item.id] ? 'done' : undefined}>{entry.done[item.id] && <span className="sr-only">Done: </span>}{itemText(item, entry.lang)}</li>)}</ul>
    </>}
    <a className="text-button" href={`#plans/${plan.id}`}>Open {plan.title}</a>
  </section>
}
