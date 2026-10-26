import { useEffect, useState } from 'react'
import type { AppModel } from '../app-model'
import Icon from './Icon'
import { lessons } from '../curriculum'
import { loadCompanies } from '../companies'
import type { PlanCompany, PlanItem } from '../planner'

const ICONS: Record<PlanItem['kind'], string> = { lesson: 'book', cards: 'repeat', problem: 'code', sql: 'code', case: 'layers', guide: 'compass', pattern: 'target', mock: 'clock', values: 'badge', 'company-mock': 'clock', rest: 'check' }

export function PlanItemAction({ app, item }: { app: AppModel; item: PlanItem }) {
  const label = <><Icon name={ICONS[item.kind]} size={16} /><span>{item.title}</span>{item.minutes > 0 && <span className="muted">{item.minutes} min</span>}</>
  if (item.kind === 'lesson') {
    const lesson = lessons.find(entry => entry.id === item.ref)!
    return <button type="button" className="plan-item" onClick={() => app.start(lesson, app.progress.records[lesson.id] ? 'review' : 'learn')}>{label}</button>
  }
  const href = item.kind === 'cards' ? '#cards' : item.kind === 'problem' ? `#code/${item.ref}` : item.kind === 'sql' ? `#sql/${item.ref}` : item.kind === 'case' ? `#design/${item.ref}` : item.kind === 'guide' ? `#guide/${item.ref}` : item.kind === 'pattern' ? `#patterns/${item.ref}`
    : item.kind === 'mock' ? '#mock' : item.kind === 'values' ? `#company/${item.ref}` : item.kind === 'company-mock' ? `#mock/${item.ref}` : undefined
  return href ? <a className="plan-item" href={href}>{label}</a> : <span className="plan-item">{label}</span>
}

/** The saved target company, loaded lazily for the planner. Undefined until loaded, or when none is set. */
export function usePlanCompany(id: string | undefined): PlanCompany | undefined {
  const [company, setCompany] = useState<PlanCompany>()
  useEffect(() => {
    if (!id) return setCompany(undefined)
    let live = true
    loadCompanies().then(all => { if (live) setCompany(all.get(id)) }, () => { if (live) setCompany(undefined) })
    return () => { live = false }
  }, [id])
  return company?.id === id ? company : undefined
}
