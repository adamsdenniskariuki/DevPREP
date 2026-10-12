import { lessons } from '../curriculum'
import { displayDate } from '../format'
import Icon from '../components/Icon'
import { ratingLabels } from '../labels'
import type { AppModel } from '../app-model'
import { problemIndex } from '../problems'

const upcomingTools = [
  { icon: 'repeat', title: 'Flashcards', text: 'Quick spaced-repetition recall for key concepts.' },
  { icon: 'clock', title: 'Mock interviews', text: 'Timed rounds per track with a scoring rubric.' },
  { icon: 'layers', title: 'Whiteboard', text: 'Sketch system designs against the clock.' },
]

export default function PracticeScreen({ app }: { app: AppModel }) {
  const { progress, due, completed, activeLesson, today, navigate, start, heading } = app
  const upcoming = lessons.filter(lesson => progress.records[lesson.id]?.due > today).sort((a, b) => progress.records[a.id].due.localeCompare(progress.records[b.id].due))
  return <>
<div className="page-heading"><div><div className="eyebrow">PRACTICE</div><h1 ref={heading} tabIndex={-1}>Practice</h1><p>Recall first, then check. Your confidence sets the next review.</p></div><span className="pill">{due.length} due today</span></div>
{progress.session?.mode === 'review' && <section className="card resume-strip"><div><h2>Continue your review</h2><p>{activeLesson?.title}</p></div><button className="primary" onClick={() => navigate('study')}>Resume review</button></section>}
<section aria-labelledby="review-queue-title"><h2 id="review-queue-title" className="section-title">Review queue</h2>
{due.length ? <div className="lesson-list">{due.map(lesson => <article className="lesson-row" key={lesson.id}><span className="step-number"><Icon name="repeat" /></span><div className="lesson-row-copy"><span className="eyebrow">DUE {displayDate(progress.records[lesson.id].due)}</span><h2>{lesson.title}</h2><p>Last rating: {ratingLabels[progress.records[lesson.id].rating]}</p></div><button className="primary" onClick={() => start(lesson, 'review')}>Review now<Icon name="arrow" size={16} /></button></article>)}</div> : <section className="card empty-state"><span className="empty-icon"><Icon name="check" size={28} /></span><h2>{completed ? 'You’re all caught up.' : 'Your first review starts with a lesson.'}</h2><p>{completed ? 'Explore a new topic, or revisit a lesson early.' : 'Finish a lesson; it comes back in 1, 3 or 7 days.'}</p><button onClick={() => navigate('tracks')}>Browse tracks<Icon name="arrow" size={16} /></button></section>}
{upcoming.length > 0 && <section className="upcoming"><h2>Coming up</h2>{upcoming.map(lesson => <div className="upcoming-row" key={lesson.id}><span>{lesson.title}</span><span>{displayDate(progress.records[lesson.id].due)}</span></div>)}</section>}
</section>
<section className="practice-tools" aria-labelledby="practice-tools-title"><h2 id="practice-tools-title" className="section-title">More ways to practise</h2><div className="tool-grid"><a className="tool-card live" href="#code"><span className="tool-icon"><Icon name="code" /></span><h3>Code runner</h3><p>{problemIndex.length} DSA problems in JavaScript or Python, with tests.</p><span className="pill">{problemIndex.filter(problem => progress.solved?.[problem.id]).length} solved</span></a>{upcomingTools.map(tool => <div className="tool-card" key={tool.title}><span className="tool-icon"><Icon name={tool.icon} /></span><h3>{tool.title}</h3><p>{tool.text}</p><span className="pill soon">Coming soon</span></div>)}</div></section>
  </>
}
