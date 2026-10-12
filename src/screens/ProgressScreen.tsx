import { lessons, tracks } from '../curriculum'
import { learningPaths, pathProgress } from '../learning-paths'
import Icon from '../components/Icon'
import { ratingLabels } from '../labels'
import type { AppModel } from '../app-model'

export default function ProgressScreen({ app }: { app: AppModel }) {
  const { progress, due, completed, heading, backupControls } = app
  return <>
<div className="page-heading"><div><div className="eyebrow">LOOK HOW FAR YOU’VE COME</div><h1 ref={heading} tabIndex={-1}>Progress, not perfection.</h1><p>These are practice milestones, not an interview readiness score.</p><p className="helper">New lessons grow the roadmap, not erase your work. Previously completed lessons and scheduled reviews stay complete; the overall percentage uses the expanded total.</p></div></div>
<div className="summary-grid"><section className="card"><span className="eyebrow">ALL LESSONS EXPLORED</span><div className="big-number">{completed}<span> / {lessons.length}</span></div></section><section className="card"><span className="eyebrow">TOTAL SESSIONS</span><div className="big-number">{Object.values(progress.records).reduce((sum, record) => sum + record.attempts, 0)}</div></section><section className="card"><span className="eyebrow">REVIEWS DUE · ALL LESSONS</span><div className="big-number">{due.length}</div></section></div>
<section aria-label="Learning path progress"><h2>Progress in each path</h2><p className="helper">Shared lesson completions count in both paths, whether or not one is selected. These totals are separate from all {lessons.length} lessons.</p><div className="path-progress-grid">{learningPaths.map(path => {
  const status = pathProgress(path, progress)
  return <section className="card" key={path.id} aria-label={`${path.title} progress summary`}><div className="section-heading"><h3>{path.title}</h3>{path.id === progress.selectedPath && <span className="pill">Selected</span>}</div><p>{status.completed} / {status.total} path lessons complete</p><progress value={status.completed} max={status.total} aria-label={`${path.title} path progress`} /><p className="helper">{status.percent}% of this path’s lessons, not a readiness score.</p></section>
})}</div></section>
<section className="card"><h2>Your tracks</h2><div className="track-progress-list">{tracks.map(item => {
  const subset = lessons.filter(lesson => lesson.track === item.id)
  const count = subset.filter(lesson => progress.records[lesson.id]).length
  return <div key={item.id}><div className="section-heading"><h3>{item.title}</h3><span>{count} / {subset.length}</span></div><progress value={count} max={subset.length} aria-label={`${item.title} progress`} /></div>
})}</div></section>
<section className="card backup-card"><div className="eyebrow">YOU OWN YOUR PROGRESS</div><h2>Local to this browser. Backed up by you.</h2><p>Completion records, unfinished answers, and review dates are stored on this device in this browser’s local storage. Clearing site data, using private browsing, changing browsers, or switching devices can make your progress unavailable. There are no accounts, automatic backups, or cross-device sync.</p><p>Export a JSON backup regularly. Import it on another device to transfer your progress. Import replaces this browser’s progress only after validation and your confirmation. Backups include your unfinished answer; avoid sensitive interview or employer information. Completed answers and checklists are not retained, so export before finishing if you want to keep your draft.</p>{backupControls}<p className="helper">DevPREP sends no answers or progress to a server. GitHub Pages still serves the site and may log normal web requests. Activity history keeps the latest 5,000 sessions; completion totals are retained.</p></section>
<section className="card"><h2>Recent practice</h2>{progress.activity.length ? <ol className="activity-list">{progress.activity.slice(-10).reverse().map((item, index) => <li key={`${item.at}-${index}`}><span className="activity-check"><Icon name="check" size={16} /></span><div><strong>{lessons.find(lesson => lesson.id === item.lessonId)?.title}</strong><p>{item.mode === 'review' ? 'Review' : 'Lesson'} · {ratingLabels[item.rating]}</p></div><time dateTime={item.at}>{new Date(item.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time></li>)}</ol> : <p className="muted">Your first completed session will appear here. Start small.</p>}</section>
  </>
}
