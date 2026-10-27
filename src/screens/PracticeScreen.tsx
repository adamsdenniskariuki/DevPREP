import { useEffect } from 'react'
import { lessons } from '../curriculum'
import { displayDate } from '../format'
import Icon from '../components/Icon'
import { ratingLabels } from '../labels'
import type { AppModel } from '../app-model'
import { problemIndex } from '../problems'
import { sqlProblemIndex } from '../sql-problems'
import { caseIndex } from '../cases'
import { companyIds } from '../companies'
import { cardIds, dueCount } from '../flashcards'
import { patternIndex } from '../patterns'
import { patternPageDone } from '../gamification'


export default function PracticeScreen({ app }: { app: AppModel }) {
  const { progress, due, completed, activeLesson, today, navigate, start, heading } = app
  // Lazy screen: focus our own heading once loaded.
  useEffect(() => { heading.current?.focus() }, [heading])
  const hub: { id: string; title: string; blurb: string; tools: { href: string; icon: string; title: string; text: string; stat: string }[] }[] = [
    { id: 'drills', title: 'Drills', blurb: 'Short reps with instant checks.', tools: [
      { href: '#code', icon: 'code', title: 'Coding problems', text: `${problemIndex.length} DSA problems in JavaScript or Python, with tests.`, stat: `${problemIndex.filter(problem => progress.solved?.[problem.id]).length} solved` },
      { href: '#sql', icon: 'grid', title: 'SQL problems', text: `${sqlProblemIndex.length} interview queries on in-browser Postgres.`, stat: `${sqlProblemIndex.filter(problem => progress.sqlSolved?.[problem.id]).length} solved` },
      { href: '#cards', icon: 'repeat', title: 'Flashcards', text: `${cardIds.size} concept cards with spaced repetition.`, stat: `${dueCount(progress, today)} due` },
      { href: '#patterns', icon: 'target', title: 'Patterns', text: `${patternIndex.length} algorithm patterns with pictures, step-throughs and exercises.`, stat: `${patternIndex.filter(page => patternPageDone(progress, page.id)).length} learned` },
    ] },
    { id: 'design', title: 'Design', blurb: 'Timed system design, sketched and scored.', tools: [
      { href: '#design', icon: 'layers', title: 'Design cases', text: `${caseIndex.length} timed case studies with a whiteboard and rubric.`, stat: `${caseIndex.filter(item => progress.designs?.[item.id]).length} scored` },
      { href: '#board', icon: 'compass', title: 'Whiteboard', text: 'Free-form boards for any design, saved on this device.', stat: `${Object.keys(progress.whiteboard?.practised ?? {}).length} cases practised` },
    ] },
    { id: 'interview', title: 'Interview', blurb: 'Rehearse the real loop.', tools: [
      { href: '#company', icon: 'badge', title: 'Company prep', text: `${companyIds.length} company interview loops, with timed practice sets and mock loops.`, stat: `${Object.keys(progress.companies ?? {}).length} practised` },
      { href: '#mock', icon: 'clock', title: 'Mock interviews', text: 'Timed rounds per track, scored with a rubric.', stat: `${progress.mocks?.length ?? 0} done` },
      { href: '#stories', icon: 'book', title: 'Story bank', text: 'STAR stories mapped to behavioral competencies.', stat: `${progress.stories?.length ?? 0} stories` },
      { href: '#plan', icon: 'calendar', title: 'Study plan', text: 'Day-by-day plan to your interview date.', stat: progress.profile?.interviewDate ? 'Dated' : '7 days' },
    ] },
  ]
  const upcoming = lessons.filter(lesson => progress.records[lesson.id]?.due > today).sort((a, b) => progress.records[a.id].due.localeCompare(progress.records[b.id].due))
  return <>
<div className="page-heading"><div><div className="eyebrow">PRACTISE HUB</div><h1 ref={heading} tabIndex={-1}>Practise</h1><p>Clear your reviews first, then pick a drill by goal.</p></div><span className="pill">{due.length} due today</span></div>
{progress.session?.mode === 'review' && <section className="card resume-strip"><div><h2>Continue your review</h2><p>{activeLesson?.title}</p></div><button className="primary" onClick={() => navigate('study')}>Resume review</button></section>}
<section aria-labelledby="review-queue-title"><h2 id="review-queue-title" className="section-title">Review queue</h2>
{due.length ? <div className="lesson-list">{due.map(lesson => <article className="lesson-row" key={lesson.id}><span className="step-number"><Icon name="repeat" /></span><div className="lesson-row-copy"><span className="eyebrow">DUE {displayDate(progress.records[lesson.id].due)}</span><h2>{lesson.title}</h2><p>Last rating: {ratingLabels[progress.records[lesson.id].rating]}</p></div><button className="primary" onClick={() => start(lesson, 'review')}>Review now<Icon name="arrow" size={16} /></button></article>)}</div> : <section className="card empty-state"><span className="empty-icon"><Icon name="check" size={28} /></span><h2>{completed ? 'You’re all caught up.' : 'Your first review starts with a lesson.'}</h2><p>{completed ? 'Explore a new topic, or revisit a lesson early.' : 'Finish a lesson; it comes back in 1, 3 or 7 days.'}</p><button onClick={() => navigate('tracks')}>Browse tracks<Icon name="arrow" size={16} /></button></section>}
{upcoming.length > 0 && <section className="upcoming"><h2>Coming up</h2>{upcoming.map(lesson => <div className="upcoming-row" key={lesson.id}><span>{lesson.title}</span><span>{displayDate(progress.records[lesson.id].due)}</span></div>)}</section>}
</section>
{hub.map(group => <section className="practice-tools" key={group.id} aria-labelledby={`hub-${group.id}`}><h2 id={`hub-${group.id}`} className="section-title">{group.title}</h2><p className="muted">{group.blurb}</p>
<div className="tool-grid">{group.tools.map(tool => <a key={tool.href} className="tool-card live" href={tool.href}><span className="tool-icon"><Icon name={tool.icon} /></span><h3>{tool.title}</h3><p>{tool.text}</p><span className="pill">{tool.stat}</span></a>)}</div></section>)}
  </>
}
