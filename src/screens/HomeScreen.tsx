import { lessons, tracks } from '../curriculum'
import Icon from '../components/Icon'
import WelcomeTour from '../components/WelcomeTour'
import { phaseLabels } from '../labels'
import type { AppModel } from '../app-model'
import { dueCount } from '../flashcards'
import { planStudy } from '../planner'
import { PlanItemAction } from './PlanScreen'

function countdown(days: number | undefined) {
  if (days === undefined) return 'Let’s get interview-ready.'
  if (days > 1) return `${days} days to go.`
  if (days === 1) return 'Interview tomorrow.'
  if (days === 0) return 'Interview day. You’ve got this.'
  return 'Keep your skills sharp.'
}

export default function HomeScreen({ app }: { app: AppModel }) {
  const { progress, due, completed, selectedPath, selectedStatus, nextLesson, todayActivity, learnedToday, reviewedToday, activeLesson, percent, outsidePath, clock, navigate, start, browseAll, heading, setRoadmapScope, game, weak, daysLeft, tourOpen } = app
  const cardsDue = dueCount(progress, app.today)
  const extras = planStudy(progress, app.today).days[0].items.filter(item => item.kind === 'problem' || item.kind === 'sql' || item.kind === 'case' || item.kind === 'mock')
  const focus = weak.filter(area => area.completed < area.total || area.needsPractice > 0).slice(0, 2)
  return <>
<div className="page-heading home-heading"><div><div className="eyebrow">{clock.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div><h1 ref={heading} tabIndex={-1}>{countdown(daysLeft)}</h1><p>{selectedPath ? `${selectedPath.title} path` : 'All tracks'} · {game.streak.current ? `${game.streak.current}-day streak` : 'Start a streak today'} · Level {game.level}</p></div>
  <button className="pill pill-button" onClick={() => navigate('settings')}><Icon name="target" size={16} /> {selectedPath ? selectedPath.shortTitle : 'Set target role'}</button></div>
{tourOpen && <WelcomeTour app={app} />}
<div className="today-layout">
  <div className="today-primary">
    <section className="hero-card">
      <div className="hero-top"><span className="eyebrow">{progress.session ? 'PICK UP WHERE YOU LEFT OFF' : !nextLesson ? selectedPath ? 'PATH COMPLETE' : 'ROADMAP COMPLETE' : learnedToday ? 'TODAY’S LESSON · COMPLETE' : 'UP NEXT'}</span>{(activeLesson ?? nextLesson) && <span className="pill">{(activeLesson ?? nextLesson)!.minutes} min</span>}</div>
      <div className="hero-art" aria-hidden="true"><div className="art-bracket">{'{'}</div><div className="art-lines"><span /><span /><span /></div><div className="art-bracket">{'}'}</div><span className="art-check"><Icon name="check" size={28} /></span></div>
      <div className="hero-copy">
        <div className="track-label">{tracks.find(t => t.id === (activeLesson ?? nextLesson)?.track)?.title ?? 'Keep your skills sharp'}</div>
        <h2>{activeLesson?.title ?? nextLesson?.title ?? (selectedPath ? `${selectedPath.title} path explored.` : 'You’ve built a strong foundation.')}</h2>
        <p>{activeLesson?.summary ?? nextLesson?.summary ?? 'Keep reviewing, or explore the rest of the curriculum.'}</p>
        <button className="primary" onClick={() => progress.session ? navigate('study') : nextLesson ? start(nextLesson) : selectedPath && due.length === 0 ? browseAll() : navigate('practice')}>{progress.session ? 'Resume session' : nextLesson ? learnedToday ? 'Study another lesson' : 'Start today’s lesson' : selectedPath && due.length === 0 ? 'Explore all lessons' : 'Open your reviews'}<Icon name="arrow" size={18} /></button>
        {progress.session && <span className="hero-footnote">{phaseLabels[progress.session.phase]} step · Your draft is waiting</span>}
      </div>
    </section>
    {outsidePath && <div className="callout outside-path"><strong>Your unfinished session is outside this path.</strong><p>{nextLesson ? `Next in your path: ${nextLesson.title}.` : 'Your path is already complete.'}</p><button className="text-button" onClick={() => { setRoadmapScope('path'); navigate('tracks') }}>View selected path</button></div>}
    <section className="card daily-plan"><div className="section-heading"><h2>Today’s plan</h2>{daysLeft !== undefined && daysLeft >= 0 && <span className="muted">{daysLeft} days left</span>}</div>
      <div className="plan-row"><span className={`step-number ${learnedToday ? 'complete' : ''}`}>{learnedToday ? <Icon name="check" size={18} /> : '1'}</span><div><h3>{learnedToday ? 'New idea, explored' : 'Learn one lesson'}</h3><p>{learnedToday ? 'More is optional.' : nextLesson ? nextLesson.title : 'Every lesson done. Revisit any topic.'}</p></div><span className="plan-meta">{learnedToday ? 'Done' : nextLesson ? `${nextLesson.minutes} min` : 'Complete'}</span></div>
      <div className="plan-row"><span className={`step-number ${reviewedToday ? 'complete' : ''}`}>{reviewedToday ? <Icon name="check" size={18} /> : '2'}</span><div><h3>{reviewedToday ? 'Recall, reinforced' : 'Review one idea'}</h3><p>{reviewedToday ? 'Remembering is the real practice.' : due.length ? `${due.length} ${due.length === 1 ? 'lesson' : 'lessons'} due.` : 'Nothing due yet.'}</p></div>{due.length > 0 ? <button className="text-button" onClick={() => start(due[0], 'review')}>Review <Icon name="arrow" size={16} /></button> : <span className="plan-meta">{reviewedToday ? 'Done' : 'All clear'}</span>}</div>
      {focus[0] && <div className="plan-row"><span className="step-number">3</span><div><h3>Strengthen {focus[0].title}</h3><p>{focus[0].needsPractice ? `${focus[0].needsPractice} marked Needs practice.` : `${focus[0].completed} / ${focus[0].total} lessons done.`}</p></div><button className="text-button" onClick={() => browseAll(focus[0].track)}>Open <Icon name="arrow" size={16} /></button></div>}
      <div className="plan-row"><span className="step-number"><Icon name="repeat" size={18} /></span><div><h3>Flashcards</h3><p>{cardsDue ? `${cardsDue} ${cardsDue === 1 ? 'card' : 'cards'} due.` : 'Nothing due. Learn a few new cards.'}</p></div><a className="text-button" href="#cards">Open <Icon name="arrow" size={16} /></a></div>
      {extras.length > 0 && <ul className="plan-extras" aria-label="Also on today's plan">{extras.map((item, index) => <li key={index}><PlanItemAction app={app} item={item} /></li>)}</ul>}
      <a className="text-button" href="#plan">Full study plan <Icon name="arrow" size={16} /></a>
    </section>
  </div>
  <div className="today-secondary">
    <section className="card progress-card"><div className="section-heading"><h2>Momentum</h2><Icon name="chart" /></div><div className="big-number">{selectedStatus?.completed ?? completed}<span> / {selectedStatus?.total ?? lessons.length}</span></div><p>{selectedPath ? `${selectedPath.shortTitle} path lessons` : 'lessons explored'}</p><progress value={selectedStatus?.completed ?? completed} max={selectedStatus?.total ?? lessons.length} aria-label={selectedPath ? 'Selected path progress' : 'Overall progress'} /><div className="progress-caption"><span>{selectedPath ? `${completed} / ${lessons.length} overall` : 'All tracks'}</span><strong>{selectedStatus?.percent ?? percent}%</strong></div>
      <div className="mini-stats"><div><strong><Icon name="flame" size={16} /> {game.streak.current}</strong><span>day streak{game.streak.freezes ? ` · ${game.streak.freezes} freeze${game.streak.freezes > 1 ? 's' : ''}` : ''}</span></div><div><strong><Icon name="bolt" size={16} /> {game.xp}</strong><span>XP · level {game.level}</span></div><div><strong>{todayActivity.length}</strong><span>sessions today</span></div><div><strong>{due.length}</strong><span>reviews due</span></div></div>
      <button className="text-button" onClick={() => navigate('progress')}>See progress <Icon name="arrow" size={16} /></button></section>
  </div>
</div>
<section className="explore-section"><div className="section-heading"><h2>Tracks</h2><button className="text-button" onClick={() => navigate('tracks')}>All tracks <Icon name="arrow" size={16} /></button></div><div className="track-grid">{tracks.map((item, index) => {
  const subset = lessons.filter(lesson => lesson.track === item.id)
  const done = subset.filter(lesson => progress.records[lesson.id]).length
  return <button className="track-card" key={item.id} onClick={() => browseAll(item.id)}><span className="track-index">0{index + 1}</span><h3>{item.title}</h3><p>{item.description}</p><span className="track-card-footer">{done} / {subset.length} lessons <Icon name="arrow" size={16} /></span></button>
})}</div></section>
  </>
}
