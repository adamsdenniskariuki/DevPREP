import { lessons } from '../curriculum'
import { displayDate } from '../format'
import Icon from '../components/Icon'
import { ratingLabels } from '../labels'
import type { AppModel } from '../app-model'

export default function ReviewScreen({ app }: { app: AppModel }) {
  const { progress, due, completed, selectedPath, activeLesson, today, navigate, start, heading } = app
  return <>
<div className="page-heading"><div><div className="eyebrow">MAKE IT STICK</div><h1 ref={heading} tabIndex={-1}>Your review queue</h1><p>Recall first. Look at the explanation second. Your confidence sets the next review.</p>{selectedPath && <p className="helper">Reviews always include all completed lessons, even outside your selected path. Switching paths never removes or reschedules them.</p>}</div><span className="pill">{due.length} due today</span></div>
{progress.session?.mode === 'review' && <section className="card resume-strip"><div><h2>Continue your review</h2><p>{activeLesson?.title}</p></div><button className="primary" onClick={() => navigate('study')}>Resume review</button></section>}
{due.length ? <div className="lesson-list">{due.map(lesson => <article className="lesson-row" key={lesson.id}><span className="step-number"><Icon name="repeat" /></span><div className="lesson-row-copy"><span className="eyebrow">DUE {displayDate(progress.records[lesson.id].due)}</span><h2>{lesson.title}</h2><p>Last reflection: {ratingLabels[progress.records[lesson.id].rating]}</p></div><button className="primary" onClick={() => start(lesson, 'review')}>Review now<Icon name="arrow" size={16} /></button></article>)}</div> : <section className="card empty-state"><span className="empty-icon"><Icon name="check" size={28} /></span><h2>{completed ? 'You’re all caught up.' : 'Your first review starts with a lesson.'}</h2><p>{completed ? 'Take a break, explore a new topic, or practice a completed lesson early from the roadmap.' : 'Finish a lesson and reflect on your confidence. We’ll bring it back in 1, 3, or 7 days.'}</p><button onClick={() => navigate('roadmap')}>Explore roadmap<Icon name="arrow" size={16} /></button></section>}
{completed > due.length && <section className="upcoming"><h2>Coming up</h2>{lessons.filter(lesson => progress.records[lesson.id]?.due > today).sort((a, b) => progress.records[a.id].due.localeCompare(progress.records[b.id].due)).map(lesson => <div className="upcoming-row" key={lesson.id}><span>{lesson.title}</span><span>{displayDate(progress.records[lesson.id].due)}</span></div>)}</section>}
<p className="helper">Reviews are scheduled by your local calendar date. There are no notifications or penalties for coming back later.</p>
  </>
}
