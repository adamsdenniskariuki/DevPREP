import { useEffect, useState } from 'react'
import { lessons, tracks } from '../curriculum'
import { learningPaths, pathProgress } from '../learning-paths'
import { LEVEL_XP } from '../gamification'
import Icon from '../components/Icon'
import { ratingLabels } from '../labels'
import type { AppModel } from '../app-model'
import { patternProgress } from '../problems'
import { companyIds, loadCompanies } from '../companies'

export default function ProgressScreen({ app }: { app: AppModel }) {
  const { progress, due, completed, heading, game, weak, browseAll } = app
  useEffect(() => { heading.current?.focus() }, [heading])
  const earned = game.badges.filter(badge => badge.earned).length
  const needs = weak.filter(area => area.needsPractice > 0)
  const companyMocks = companyIds.flatMap(id => (progress.companyMocks?.[id] ?? []).map(result => ({ id, ...result }))).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5)
  const [names, setNames] = useState<Map<string, string>>()
  useEffect(() => {
    if (!companyMocks.length) return
    let live = true
    loadCompanies().then(all => { if (live) setNames(new Map([...all.values()].map(item => [item.id, item.name]))) }, () => undefined)
    return () => { live = false }
  }, [companyMocks.length])
  return <>
<div className="page-heading"><div><div className="eyebrow">PROGRESS</div><h1 ref={heading} tabIndex={-1}>Progress</h1><p>Practice milestones, not a readiness score.</p></div></div>
<div className="summary-grid">
  <section className="card"><span className="eyebrow">LESSONS</span><div className="big-number">{completed}<span> / {lessons.length}</span></div></section>
  <section className="card"><span className="eyebrow">XP · LEVEL {game.level}</span><div className="big-number">{game.xp}</div><progress value={game.levelXp} max={LEVEL_XP} aria-label={`Level ${game.level} progress`} /></section>
  <section className="card"><span className="eyebrow">STREAK</span><div className="big-number">{game.streak.current}<span> days</span></div><p className="helper"><Icon name="snow" size={14} /> {game.streak.freezes} freeze{game.streak.freezes === 1 ? '' : 's'} · best {game.streak.best}</p></section>
  <section className="card"><span className="eyebrow">REVIEWS DUE</span><div className="big-number">{due.length}</div></section>
</div>
<section className="card"><div className="section-heading"><h2>Badges</h2><span className="pill">{earned} / {game.badges.length}</span></div>
  <ul className="badge-grid">{game.badges.map(badge => <li key={badge.id} className={badge.earned ? 'badge earned' : 'badge'}><span className="badge-icon"><Icon name="badge" size={22} /></span><strong>{badge.title}</strong><span>{badge.description}</span><span className="sr-only">{badge.earned ? 'Earned' : 'Not yet earned'}</span></li>)}</ul>
  <p className="helper">Streak freezes: earn one every 7 days in a row (hold up to 2). A missed day uses one automatically.</p>
</section>
<section className="card"><h2>Weak areas</h2>{needs.length ? <ul className="weak-list">{needs.map(area => <li key={area.track}><span>{area.title}</span><span>{area.needsPractice} need practice</span><button className="text-button" onClick={() => browseAll(area.track)}>Open <Icon name="arrow" size={16} /></button></li>)}</ul> : <p className="muted">Nothing rated Needs practice. Least explored: {weak[0]?.title}.</p>}</section>
<section aria-label="Learning path progress"><h2>Paths</h2><div className="path-progress-grid">{learningPaths.map(path => {
  const status = pathProgress(path, progress)
  return <section className="card" key={path.id} aria-label={`${path.title} progress summary`}><div className="section-heading"><h3>{path.title}</h3>{path.id === progress.selectedPath && <span className="pill">Selected</span>}</div><p>{status.completed} / {status.total} path lessons complete</p><progress value={status.completed} max={status.total} aria-label={`${path.title} path progress`} /></section>
})}</div></section>
<section className="card"><h2>Tracks</h2><div className="track-progress-list">{tracks.map(item => {
  const subset = lessons.filter(lesson => lesson.track === item.id)
  const count = subset.filter(lesson => progress.records[lesson.id]).length
  return <div key={item.id}><div className="section-heading"><h3>{item.title}</h3><span>{count} / {subset.length}</span></div><progress value={count} max={subset.length} aria-label={`${item.title} progress`} /></div>
})}</div></section>
<section className="card"><h2>Coding patterns</h2><div className="track-progress-list">{patternProgress(progress).map(row => <div key={row.pattern}><div className="section-heading"><h3>{row.pattern}</h3><span>{row.solved} / {row.total}</span></div><progress value={row.solved} max={row.total} aria-label={`${row.pattern} problems solved`} /></div>)}</div></section>
<section className="card"><h2>Company mock loops</h2>{companyMocks.length ? <ol className="activity-list">{companyMocks.map(item => <li key={`${item.id}-${item.at}`}><span className="activity-check"><Icon name="check" size={16} /></span><div><strong><a href={`#company/${item.id}`}>{names?.get(item.id) ?? item.id}</a></strong><p>{item.percent}% · {item.level === 'sse' ? 'SSE' : 'SE'} · {item.rounds} rounds in {item.minutes} min</p></div><time dateTime={item.at}>{new Date(item.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time></li>)}</ol> : <p className="muted">Finish a mock loop from a <a href="#company">company page</a> to see it here.</p>}</section>
<section className="card"><h2>Recent practice</h2>{progress.activity.length ? <ol className="activity-list">{progress.activity.slice(-10).reverse().map((item, index) => <li key={`${item.at}-${index}`}><span className="activity-check"><Icon name="check" size={16} /></span><div><strong>{lessons.find(lesson => lesson.id === item.lessonId)?.title}</strong><p>{item.mode === 'review' ? 'Review' : 'Lesson'} · {ratingLabels[item.rating]}</p></div><time dateTime={item.at}>{new Date(item.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time></li>)}</ol> : <p className="muted">Your first completed session will appear here.</p>}</section>
  </>
}
