import { lessons, tracks } from '../curriculum'
import Icon from '../components/Icon'
import { phaseLabels } from '../labels'
import type { AppModel } from '../app-model'

export default function TodayScreen({ app }: { app: AppModel }) {
  const { progress, due, completed, selectedPath, selectedStatus, nextLesson, todayActivity, learnedToday, reviewedToday, activeLesson, percent, outsidePath, clock, navigate, start, browseAll, heading, setRoadmapScope } = app
  return <>
<div className="page-heading"><div><div className="eyebrow">{clock.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div><h1 ref={heading} tabIndex={-1}>A little better, every day.</h1><p>No cramming. Just focused practice that adds up.</p></div><span className="pill"><Icon name="sun" size={16} /> Your daily practice</span></div>
<div className="today-layout">
  <div className="today-primary">
    <section className="hero-card">
      <div className="hero-top"><span className="eyebrow">{progress.session ? 'PICK UP WHERE YOU LEFT OFF' : !nextLesson ? selectedPath ? 'PATH COMPLETE' : 'ROADMAP COMPLETE' : learnedToday ? 'TODAY’S LESSON · COMPLETE' : 'YOUR NEXT SMALL WIN'}</span>{(activeLesson ?? nextLesson) && <span className="pill">{(activeLesson ?? nextLesson)!.minutes} min</span>}</div>
      <div className="hero-art" aria-hidden="true"><div className="art-bracket">{'{'}</div><div className="art-lines"><span /><span /><span /></div><div className="art-bracket">{'}'}</div><span className="art-check"><Icon name="check" size={28} /></span></div>
      <div className="hero-copy">
        <div className="track-label">{tracks.find(t => t.id === (activeLesson ?? nextLesson)?.track)?.title ?? 'Keep your skills sharp'}</div>
        <h2>{activeLesson?.title ?? nextLesson?.title ?? (selectedPath ? `${selectedPath.title} path explored.` : 'You’ve built a strong foundation.')}</h2>
        <p>{activeLesson?.summary ?? nextLesson?.summary ?? (selectedPath ? 'Every lesson in this path is complete. Keep reviewing or explore supplemental lessons; this is not a readiness guarantee.' : 'Revisit the ideas you have learned. Explaining them again is where confidence grows.')}</p>
        <button className="primary" onClick={() => progress.session ? navigate('study') : nextLesson ? start(nextLesson) : selectedPath && due.length === 0 ? browseAll() : navigate('review')}>{progress.session ? 'Resume session' : nextLesson ? learnedToday ? 'Study another lesson' : 'Start today’s lesson' : selectedPath && due.length === 0 ? 'Explore all lessons' : 'Open your reviews'}<Icon name="arrow" size={18} /></button>
        <span className="hero-footnote">{progress.session ? `${phaseLabels[progress.session.phase]} step · Your draft is waiting` : selectedPath ? `${selectedPath.shortTitle} path · Pause whenever you need` : 'Work in focused blocks · Pause whenever you need'}</span>
      </div>
    </section>
    {outsidePath && <div className="callout outside-path"><strong>Your unfinished session is outside this path.</strong><p>Resume it without losing your notebook. {nextLesson ? `Next in your selected path: ${nextLesson.title}.` : 'Your selected path is already complete.'}</p><button className="text-button" onClick={() => { setRoadmapScope('path'); navigate('roadmap') }}>View selected path</button></div>}
    <section className="card daily-plan"><div className="section-heading"><h2>Today’s plan</h2><span className="muted">A sustainable pace</span></div>
      <div className="plan-row"><span className={`step-number ${learnedToday ? 'complete' : ''}`}>{learnedToday ? <Icon name="check" size={18} /> : '1'}</span><div><h3>{learnedToday ? 'New idea, explored' : 'One lesson, at your pace'}</h3><p>{learnedToday ? 'Your lesson is complete. More is optional.' : nextLesson ? nextLesson.title : selectedPath ? 'All path lessons completed. Supplemental lessons remain open.' : 'All lessons completed. Revisit any topic.'}</p></div><span className="plan-meta">{learnedToday ? 'Done' : nextLesson ? `${nextLesson.minutes} min` : 'Complete'}</span></div>
      <div className="plan-row"><span className={`step-number ${reviewedToday ? 'complete' : ''}`}>{reviewedToday ? <Icon name="check" size={18} /> : '2'}</span><div><h3>{reviewedToday ? 'Recall, reinforced' : 'Bring one idea back'}</h3><p>{reviewedToday ? 'You made time to practice remembering.' : due.length ? `${due.length} ${due.length === 1 ? 'lesson is' : 'lessons are'} ready for another look.` : 'Nothing due. Reviews appear after your first lesson.'}</p></div>{due.length > 0 ? <button className="text-button" onClick={() => start(due[0], 'review')}>Review <Icon name="arrow" size={16} /></button> : <span className="plan-meta">{reviewedToday ? 'Done' : 'All clear'}</span>}</div>
    </section>
  </div>
  <div className="today-secondary">
    <section className="card progress-card"><div className="section-heading"><h2>{selectedPath ? 'Your path momentum' : 'Your momentum'}</h2><Icon name="chart" /></div><div className="big-number">{selectedStatus?.completed ?? completed}<span> / {selectedStatus?.total ?? lessons.length}</span></div><p>{selectedPath ? `${selectedPath.shortTitle} path lessons explored` : 'lessons explored'}</p><progress value={selectedStatus?.completed ?? completed} max={selectedStatus?.total ?? lessons.length} aria-label={selectedPath ? 'Selected path progress' : 'Overall progress'} /><div className="progress-caption"><span>{selectedPath ? `${completed} / ${lessons.length} across all curriculum` : 'A foundation, not a finish line'}</span><strong>{selectedStatus?.percent ?? percent}%</strong></div><div className="mini-stats"><div><strong>{todayActivity.length}</strong><span>sessions today</span></div><div><strong>{due.length}</strong><span>reviews due, all lessons</span></div></div><button className="text-button" onClick={() => navigate('progress')}>See your progress <Icon name="arrow" size={16} /></button></section>
    <section className="note-card"><span className="eyebrow">THE DEVPREP WAY</span><h2>Understand it.<br />Try it. Explain it.</h2><p>Getting stuck is part of the work. Use a hint, compare your approach, and come back a little stronger.</p><span className="note-line" /></section>
  </div>
</div>
<section className="explore-section"><div className="section-heading"><h2>Four tracks. One stronger you.</h2><button className="text-button" onClick={() => navigate('roadmap')}>Explore roadmap <Icon name="arrow" size={16} /></button></div><div className="track-grid">{tracks.map((item, index) => <button className="track-card" key={item.id} onClick={() => browseAll(item.id)}><span className="track-index">0{index + 1}</span><h3>{item.title}</h3><p>{item.description}</p><span className="track-card-footer">{lessons.filter(lesson => lesson.track === item.id).length} lessons <Icon name="arrow" size={16} /></span></button>)}</div></section>
<p className="privacy-footer">Your work stays in this browser. No accounts, no sync, no pressure. <button className="text-button" onClick={() => navigate('progress')}>Make a backup</button></p>
  </>
}
