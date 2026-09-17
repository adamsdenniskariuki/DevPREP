import { useEffect, useRef, useState } from 'react'
import { lessons, tracks } from './curriculum'
import type { Lesson, Track } from './curriculum'
import { beginSession, completeSession, dueLessons, emptyProgress, localDay, MAX_BACKUP_BYTES, MAX_DRAFT_LENGTH, parseBackup, serializeBackup, STORAGE_KEY } from './progress'
import type { Mode, Phase, Rating, StudySession } from './progress'
import { useProgress } from './useProgress'
import LessonReader from './LessonReader'
import ExtraPractice from './ExtraPractice'
import { displayDate } from './format'
import { getLearningPath, learningPaths, nextLessonFor, pathLessonIds, pathProgress, selectPath } from './learning-paths'
import type { LearningPath, PathId } from './learning-paths'
import PathPicker from './PathPicker'
import PathRoadmap from './PathRoadmap'
import PathPrompt from './PathPrompt'
import LessonList from './LessonList'
import AccentPicker from './AccentPicker'
import { useAccent } from './useAccent'

type Route = 'today' | 'roadmap' | 'review' | 'progress' | 'study'
const navigation = [
  { id: 'today', label: 'Today', icon: 'sun' },
  { id: 'roadmap', label: 'Roadmap', icon: 'map' },
  { id: 'review', label: 'Review', icon: 'repeat' },
  { id: 'progress', label: 'Progress', icon: 'chart' },
] as const
const phaseLabels: Record<Phase, string> = { lesson: 'Learn', practice: 'Practice', assess: 'Reflect' }
const ratingLabels: Record<Rating, string> = { again: 'Needs practice', okay: 'Getting there', confident: 'Confident' }

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>,
    map: <><path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16" /></>,
    repeat: <><path d="M20 8a8 8 0 0 0-14-2L3 9m0-6v6h6M4 16a8 8 0 0 0 14 2l3-3m0 6v-6h-6" /></>,
    chart: <><path d="M4 3v17h17M8 15v-4m5 4V7m5 8V4" /></>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    book: <><path d="M12 5C9 3 5 3 2 4v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-3-1-7-1-10 1Zm0 0v15" /></>,
    code: <><path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-14-2 18" /></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.book}</svg>
}

function routeFromHash(): Route | 'unknown' {
  const value = window.location.hash.slice(1) || 'today'
  return ['today', 'roadmap', 'review', 'progress', 'study'].includes(value) ? value as Route : 'unknown'
}

function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function App() {
  const store = useProgress()
  const accent = useAccent()
  const { progress } = store
  const [route, setRoute] = useState(routeFromHash)
  const [track, setTrack] = useState<Track | 'all'>('all')
  const [roadmapScope, setRoadmapScope] = useState<'path' | 'all'>(progress.selectedPath ? 'path' : 'all')
  const [notice, setNotice] = useState('')
  const [backupError, setBackupError] = useState('')
  const [pendingImport, setPendingImport] = useState<ReturnType<typeof parseBackup> | null>(null)
  const [clock, setClock] = useState(() => new Date())
  const importInput = useRef<HTMLInputElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const importDialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const change = () => setRoute(routeFromHash())
    const timer = window.setInterval(() => setClock(new Date()), 60_000)
    window.addEventListener('hashchange', change)
    return () => { window.removeEventListener('hashchange', change); window.clearInterval(timer) }
  }, [])
  useEffect(() => { heading.current?.focus() }, [route])
  useEffect(() => {
    setRoadmapScope(progress.selectedPath ? 'path' : 'all')
    setTrack('all')
  }, [progress.selectedPath])
  useEffect(() => {
    if (pendingImport) importDialog.current?.showModal()
    else importDialog.current?.close()
  }, [pendingImport])

  const today = localDay(clock)
  const due = dueLessons(progress, clock)
  const completed = Object.keys(progress.records).length
  const selectedPath = getLearningPath(progress.selectedPath)
  const selectedIds = selectedPath ? pathLessonIds(selectedPath) : []
  const selectedStatus = selectedPath ? pathProgress(selectedPath, progress) : undefined
  const nextLesson = nextLessonFor(progress)
  const todayActivity = progress.activity.filter(item => localDay(new Date(item.at)) === today)
  const learnedToday = todayActivity.some(item => item.mode === 'learn')
  const reviewedToday = todayActivity.some(item => item.mode === 'review')
  const activeLesson = lessons.find(item => item.id === progress.session?.lessonId)
  const percent = Math.round(completed / lessons.length * 100)
  const outsidePath = selectedPath && activeLesson && !selectedIds.includes(activeLesson.id)

  function navigate(next: Route) {
    window.location.hash = next
    setRoute(next)
  }

  function changePath(id: PathId | undefined) {
    store.update(value => selectPath(value, id))
    setNotice(`${getLearningPath(id)?.title ?? 'All curriculum'} selected. Your completed lessons, unfinished session, and all reviews are unchanged.`)
  }

  function browseAll(nextTrack: Track | 'all' = 'all') {
    setRoadmapScope('all')
    setTrack(nextTrack)
    navigate('roadmap')
  }

  function start(lesson: Lesson, mode: Mode = 'learn') {
    if (progress.session?.lessonId === lesson.id) { navigate('study'); return }
    if (progress.session && !window.confirm('Replace your unfinished session? Its draft and checklist will be discarded. Completed lessons and reviews will stay.')) return
    store.update(value => beginSession(value, lesson.id, mode))
    setNotice('')
    navigate('study')
  }

  function editSession(patch: Partial<StudySession>) {
    store.update(value => value.session ? { ...value, session: { ...value.session, ...patch } } : value)
  }

  function finish(rating: Rating) {
    const title = activeLesson?.title
    const next = completeSession(progress, rating)
    store.update(() => next)
    setNotice(`${title} completed. Next review: ${displayDate(next.records[progress.session!.lessonId].due)}.`)
    navigate('today')
  }

  function exportBackup() {
    try {
      download(serializeBackup(progress), `devprep-backup-${today}.json`)
      setNotice('Backup downloaded. Keep it somewhere safe; it includes your written answers.')
      setBackupError('')
    } catch (error) {
      setBackupError(`The backup could not be downloaded. ${error instanceof Error ? error.message : 'Please allow downloads in your browser and try again.'}`)
    }
  }

  async function importBackup(file: File | undefined) {
    if (!file) return
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('Backup must be 1 MB or smaller.')
      const parsed = parseBackup(await file.text())
      setPendingImport(parsed)
      setBackupError('')
    } catch (error) {
      setBackupError(`${error instanceof Error ? error.message : 'Unable to read this file.'} Existing progress was not changed.`)
    } finally {
      if (importInput.current) importInput.current.value = ''
    }
  }

  function recoveryExport() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw === null) throw new Error('No saved data is available in this browser.')
      download(raw, `devprep-recovery-${today}.json`)
    } catch (error) {
      setBackupError(error instanceof Error ? error.message : 'Could not read the stored data.')
    }
  }

  const backupControls = <div className="button-row">
    {!store.recovery && <button onClick={exportBackup}>Export backup <span aria-hidden="true">↓</span></button>}
    <button onClick={() => importInput.current?.click()}>Import backup <span aria-hidden="true">↑</span></button>
  </div>
  const accentProblem = <div className="accent-problem"><strong>Accent preference needs attention.</strong><p>{accent.error} Study progress is separate and has not been changed by the accent preference.</p><button onClick={accent.retry}>Save current accent</button></div>

  return <div className="app-shell">
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus() }}>Skip to content</a>
    <aside className="sidebar">
      <a className="brand" href="#today" aria-label="DevPREP home"><span className="brand-mark"><Icon name="code" size={24} /></span><span>Dev<span className="brand-accent">PREP</span></span></a>
      <p className="brand-tagline">Build skill. Find your stride.</p>
      <div className="nav-label">YOUR WORKSPACE</div>
      <nav aria-label="Main navigation">
        {navigation.map(item => <a key={item.id} href={`#${item.id}`} className={route === item.id || (route === 'study' && item.id === 'today') ? 'nav-item active' : 'nav-item'} aria-current={route === item.id ? 'page' : undefined}>
          <Icon name={item.icon} /><span>{item.label}</span>{item.id === 'review' && due.length > 0 && <span className="nav-badge">{due.length}</span>}
        </a>)}
      </nav>
      <div className="sidebar-journey">
        <div className="eyebrow">ONE SESSION AT A TIME</div>
        <p>Small steps.<br /><strong>Lasting progress.</strong></p>
        <progress aria-label={selectedPath ? 'Selected path completed' : 'Curriculum completed'} value={selectedStatus?.completed ?? completed} max={selectedStatus?.total ?? lessons.length} />
        <span>{selectedStatus?.completed ?? completed} of {selectedStatus?.total ?? lessons.length} {selectedPath ? `${selectedPath.shortTitle} path lessons` : 'lessons'} explored</span>
        {selectedPath && <span className="overall-caption">{completed} / {lessons.length} across all curriculum</span>}
      </div>
      <div className="sidebar-bottom"><span className="local-dot" /> Local-first. Just for you.<button className="text-button" onClick={() => navigate('progress')}>Backup & storage</button></div>
    </aside>

    <div className="main-shell">
      <header className="topbar"><a className="mobile-brand" href="#today">Dev<span>PREP</span></a><span className="breadcrumb">Your interview journey <span>/</span> {route === 'study' ? 'Study session' : navigation.find(item => item.id === route)?.label ?? 'Page not found'}</span><div className="topbar-right"><span className="local-label">{store.unsaved ? 'Not saved' : store.recovery || store.conflict ? 'Storage needs attention' : 'Study progress saved on this browser'}</span><AccentPicker accent={accent.accent} onChange={accent.choose} /><button className="theme-button" aria-label="Toggle color theme" onClick={() => {
        const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
        document.documentElement.dataset.theme = theme
        const url = new URL(window.location.href)
        url.searchParams.set('scoutTheme', theme)
        window.history.replaceState(null, '', url)
      }}><Icon name="sun" size={18} /></button></div></header>
      <main id="main-content" tabIndex={-1}>
        {store.error && <div className="alert" role="alert"><strong>{store.recovery ? 'Your saved progress needs attention.' : 'Progress could not be saved safely.'}</strong><p>{store.error} {store.unsaved && 'Your latest work is only in memory. Export it before closing this page.'}</p><div className="button-row">
          {!store.recovery && !store.conflict && <button onClick={store.retry}>Retry saving</button>}
          {!store.recovery && <button onClick={exportBackup}>Export current work</button>}
          <button onClick={() => { if (!store.unsaved || window.confirm('Reload and discard unsaved changes? Export a backup first to keep them.')) window.location.reload() }}>Reload saved version</button>
        </div>{accent.error && accentProblem}</div>}
        {!store.error && accent.error && <div className="alert" role="alert">{accentProblem}</div>}
        {notice && <div className="notice" role="status">{notice}<button className="text-button" aria-label="Dismiss notification" onClick={() => setNotice('')}>Dismiss</button></div>}
        {backupError && <div className="alert" role="alert">{backupError}</div>}

        {store.recovery ? <section className="card recovery"><div className="eyebrow">SAFE RECOVERY</div><h1 ref={heading} tabIndex={-1}>Let’s protect your progress.</h1><p>Existing browser data could not be loaded. We have not replaced it. Download the original data before starting over, or restore a valid DevPREP backup.</p><button onClick={recoveryExport}>Download original data</button>{backupControls}<button className="text-button" onClick={() => {
          if (window.confirm('Permanently replace unreadable browser data with a fresh start? Download the original data first.')) store.replace(emptyProgress())
        }}>Replace with a fresh start</button></section>
          : <>
            <PathPicker selected={progress.selectedPath} onChange={changePath} />
            {route === 'today' && <>
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
            </>}

            {route === 'roadmap' && <>
              <div className="page-heading"><div><div className="eyebrow">BUILD YOUR FOUNDATION</div><h1 ref={heading} tabIndex={-1}>Your learning roadmap</h1><p>Follow each track’s prerequisite order, or choose what you need. Every lesson is open.</p><p className="helper">Times estimate a full study session, including practice. Split longer lessons across focused blocks; your reading position and notebook are saved.</p></div></div>
              {selectedPath && <div className="filter-row" aria-label="Roadmap scope"><button aria-pressed={roadmapScope === 'path'} onClick={() => setRoadmapScope('path')}>Selected path</button><button aria-pressed={roadmapScope === 'all'} onClick={() => setRoadmapScope('all')}>All curriculum</button></div>}
              {selectedPath && roadmapScope === 'path' ? <PathRoadmap path={selectedPath} progress={progress} start={start} browseAll={() => browseAll()} /> : <>
                {selectedPath && <p className="helper">Browsing all curriculum. Your selected path still guides Today. ML and other supplemental lessons count toward overall progress, not your path total.</p>}
                <div className="filter-row" aria-label="Filter by track"><button aria-pressed={track === 'all'} onClick={() => setTrack('all')}>All tracks</button>{tracks.map(item => <button key={item.id} aria-pressed={track === item.id} onClick={() => setTrack(item.id)}>{item.title}</button>)}</div>
                {tracks.filter(item => track === 'all' || item.id === track).map(item => <section className="roadmap-track" key={item.id}><div className="section-heading"><div><h2>{item.title}</h2><p>{item.description}</p></div><span className="pill">{lessons.filter(lesson => lesson.track === item.id && progress.records[lesson.id]).length} / {lessons.filter(lesson => lesson.track === item.id).length} complete</span></div><LessonList items={lessons.filter(lesson => lesson.track === item.id)} progress={progress} start={start} /></section>)}
              </>}
            </>}

            {route === 'review' && <>
              <div className="page-heading"><div><div className="eyebrow">MAKE IT STICK</div><h1 ref={heading} tabIndex={-1}>Your review queue</h1><p>Recall first. Look at the explanation second. Your confidence sets the next review.</p>{selectedPath && <p className="helper">Reviews always include all completed lessons, even outside your selected path. Switching paths never removes or reschedules them.</p>}</div><span className="pill">{due.length} due today</span></div>
              {progress.session?.mode === 'review' && <section className="card resume-strip"><div><h2>Continue your review</h2><p>{activeLesson?.title}</p></div><button className="primary" onClick={() => navigate('study')}>Resume review</button></section>}
              {due.length ? <div className="lesson-list">{due.map(lesson => <article className="lesson-row" key={lesson.id}><span className="step-number"><Icon name="repeat" /></span><div className="lesson-row-copy"><span className="eyebrow">DUE {displayDate(progress.records[lesson.id].due)}</span><h2>{lesson.title}</h2><p>Last reflection: {ratingLabels[progress.records[lesson.id].rating]}</p></div><button className="primary" onClick={() => start(lesson, 'review')}>Review now<Icon name="arrow" size={16} /></button></article>)}</div> : <section className="card empty-state"><span className="empty-icon"><Icon name="check" size={28} /></span><h2>{completed ? 'You’re all caught up.' : 'Your first review starts with a lesson.'}</h2><p>{completed ? 'Take a break, explore a new topic, or practice a completed lesson early from the roadmap.' : 'Finish a lesson and reflect on your confidence. We’ll bring it back in 1, 3, or 7 days.'}</p><button onClick={() => navigate('roadmap')}>Explore roadmap<Icon name="arrow" size={16} /></button></section>}
              {completed > due.length && <section className="upcoming"><h2>Coming up</h2>{lessons.filter(lesson => progress.records[lesson.id]?.due > today).sort((a, b) => progress.records[a.id].due.localeCompare(progress.records[b.id].due)).map(lesson => <div className="upcoming-row" key={lesson.id}><span>{lesson.title}</span><span>{displayDate(progress.records[lesson.id].due)}</span></div>)}</section>}
              <p className="helper">Reviews are scheduled by your local calendar date. There are no notifications or penalties for coming back later.</p>
            </>}

            {route === 'progress' && <>
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
            </>}

            {route === 'study' && (progress.session && activeLesson ? <Study key={activeLesson.id} lesson={activeLesson} session={progress.session} edit={editSession} finish={finish} heading={heading} path={selectedPath} openLesson={lesson => start(lesson, progress.records[lesson.id] ? 'review' : 'learn')} /> : <section className="card empty-state"><h1 ref={heading} tabIndex={-1}>A fresh page.</h1><p>No unfinished session. Pick a lesson to begin.</p><button className="primary" onClick={() => navigate('today')}>Go to Today</button></section>)}
            {route === 'unknown' && <section className="card empty-state"><h1 ref={heading} tabIndex={-1}>This page isn’t on the roadmap.</h1><button onClick={() => navigate('today')}>Back to Today</button></section>}
          </>}
      </main>
    </div>
    <input ref={importInput} type="file" accept=".json,application/json" className="sr-only" aria-label="Import progress JSON" onChange={event => { void importBackup(event.target.files?.[0]) }} />
    <dialog ref={importDialog} className="import-dialog" aria-labelledby="import-title" onCancel={() => setPendingImport(null)}>
      <h2 id="import-title">Replace this browser’s progress?</h2><p>This backup contains {pendingImport ? Object.keys(pendingImport.records).length : 0} completed lessons{pendingImport?.session ? ' and an unfinished session' : ''}. It will replace, not merge with, your current progress.</p><p>Learning path after import: {getLearningPath(pendingImport?.selectedPath)?.title ?? 'All curriculum (no path selected)'}. The backup replaces this choice too.</p><p>Export your current progress first if you want to keep both versions.</p><div className="button-row"><button autoFocus onClick={() => setPendingImport(null)}>Cancel import</button><button className="primary" onClick={() => {
        if (pendingImport && store.replace(pendingImport)) {
          setPendingImport(null)
          setNotice('Backup restored. Your lessons, reviews, and unfinished session are ready.')
          navigate('today')
        } else setPendingImport(null)
      }}>Replace progress</button></div>
    </dialog>
  </div>
}

function Study({ lesson, session, edit, finish, heading, openLesson, path }: {
  lesson: Lesson
  session: StudySession
  edit: (patch: Partial<StudySession>) => void
  finish: (rating: Rating) => void
  heading: React.RefObject<HTMLHeadingElement | null>
  openLesson: (lesson: Lesson) => void
  path: LearningPath | undefined
}) {
  const stepHeading = useRef<HTMLHeadingElement>(null)
  const [practiceStage, setPracticeStage] = useState<'warmup' | 'core' | 'stretch'>('core')
  const phase = path?.phases.find(item => item.lessonIds.includes(lesson.id))
  const prompt = path?.prompts.find(item => item.lessonId === lesson.id)
  useEffect(() => { stepHeading.current?.focus() }, [session.phase])
  function advance(phase: Phase) {
    edit({ phase, ...(phase === 'assess' ? { solutionRevealed: true } : {}) })
  }
  return <div className={`study-page phase-${session.phase}`}>
    <div className="page-heading"><div><div className="eyebrow">{session.mode === 'review' ? 'RETRIEVAL PRACTICE' : tracks.find(track => track.id === lesson.track)?.title} · ABOUT {lesson.minutes} MIN</div><h1 ref={heading} tabIndex={-1}>{lesson.title}</h1><p>{session.mode === 'review' ? 'Try it from memory. Revisit the lesson whenever you need to.' : lesson.summary}</p><p className="helper">Full-session estimate. Pause between sections; warm-up and stretch practice are optional.</p></div><a className="button" href="#today">Pause session</a></div>
    {path && <div className="path-study-context"><strong>{phase ? `${path.shortTitle}: ${phase.title}` : 'Supplemental lesson outside your selected path'}</strong><p>{phase?.objective ?? 'Your work still counts toward overall progress and its reviews stay in the global queue. It does not add to this path’s lesson count.'}</p></div>}
    <nav className="study-steps" aria-label="Study steps">{(['lesson', 'practice', 'assess'] as const).map((phase, index) => <button key={phase} aria-current={session.phase === phase ? 'step' : undefined} disabled={phase === 'assess' && !session.draft.trim()} onClick={() => advance(phase)}><span>{index + 1}</span>{phaseLabels[phase]}</button>)}</nav>
    <div className="study-columns">
      <article className="card lesson-content">
        <div className="eyebrow">UNDERSTAND THE REASONING</div><h2 ref={session.phase === 'lesson' ? stepHeading : undefined} tabIndex={-1} className="sr-only">Read the lesson</h2>
        <LessonReader lesson={lesson} sectionId={session.readingSection} select={readingSection => edit({ readingSection })} openLesson={openLesson} />
        {session.phase === 'lesson' && <button className="primary" onClick={() => advance('practice')}>Continue to practice <Icon name="arrow" size={18} /></button>}
      </article>
      <section className="card practice-content">
        {session.phase === 'lesson' ? <><div className="eyebrow">UP NEXT</div><span className="practice-icon"><Icon name="code" size={28} /></span><h2>Turn the idea into a skill.</h2><p className="preserve-lines">{lesson.task}</p><div className="callout">Read the lesson, then try the task in your own words. This is a thinking space, not a code runner.</div></> : session.phase === 'practice' ? <>
          <div className="eyebrow">YOUR TURN</div><h2 ref={stepHeading} tabIndex={-1}>Work through the problem</h2>
          <div className="practice-levels" role="group" aria-label="Practice difficulty">{(['warmup', 'core', 'stretch'] as const).map(stage => <button key={stage} aria-pressed={practiceStage === stage} onClick={() => setPracticeStage(stage)}>{stage === 'warmup' ? 'Warm-up' : stage === 'core' ? 'Core task' : 'Stretch'}</button>)}</div>
          {practiceStage === 'core' ? <><p className="preserve-lines">{lesson.task}</p>
          {lesson.starter && <details><summary>Suggested starting point</summary><pre><code>{lesson.starter}</code></pre></details>}</> : <ExtraPractice key={practiceStage} exercise={lesson.extraPractice.find(exercise => exercise.id === practiceStage)!} />}
          {prompt && <PathPrompt prompt={prompt} />}
          <label className="answer-label" htmlFor="practice-answer">Your approach & answer</label><p className="helper" id="answer-help">Write pseudocode, a design sketch, or talking points. Explain why your approach works. Nothing is executed or automatically graded. This notebook is shared across all three difficulties; label any optional work. Reflection assesses the core task.</p>
          <textarea id="practice-answer" aria-describedby="answer-help answer-count" value={session.draft} maxLength={MAX_DRAFT_LENGTH} placeholder="Start with what you know. What would you try, and why?" onChange={event => edit({ draft: event.target.value })} spellCheck={false} />
          <div id="answer-count" className="answer-count">{session.draft.length.toLocaleString()} / {MAX_DRAFT_LENGTH.toLocaleString()} characters</div>
          {practiceStage === 'core' && <><div className="hint-area">{session.hintsRevealed < lesson.hints.length && <button onClick={() => edit({ hintsRevealed: session.hintsRevealed + 1 })}>Need a hint? ({session.hintsRevealed}/{lesson.hints.length})</button>}{lesson.hints.slice(0, session.hintsRevealed).map((hint, index) => <div className="callout" key={hint}><strong>Hint {index + 1}</strong><p>{hint}</p></div>)}</div>
          {session.solutionRevealed ? <details open><summary>Worked solution</summary><pre>{lesson.solution}</pre></details> : <button className="text-button" onClick={() => edit({ solutionRevealed: true })}>Reveal worked solution</button>}</>}
          <div className="study-action"><p className="helper">{session.draft.trim() ? 'Ready? Compare your approach and reflect.' : 'Write an attempt before moving to reflection. Getting stuck counts: explain where and why.'}</p><button className="primary" disabled={!session.draft.trim()} onClick={() => advance('assess')}>Compare & reflect <Icon name="arrow" size={18} /></button></div>
        </> : <>
          <div className="eyebrow">CLOSE THE LOOP</div><h2 ref={stepHeading} tabIndex={-1}>Explain it. Then be honest.</h2><p>Compare the reasoning, not just the final answer. This is self-assessment, not automated grading.</p>
          <details open><summary>Your answer</summary><pre>{session.draft}</pre></details>
          <details open><summary>Worked solution & explanation</summary><pre>{lesson.solution}</pre></details>
          <fieldset className="checklist"><legend>What can you explain without looking?</legend>{lesson.checklist.map((item, index) => <label key={item}><input type="checkbox" checked={session.checks[index]} onChange={event => edit({ checks: session.checks.map((checked, i) => i === index ? event.target.checked : checked) })} /><span>{item}</span></label>)}</fieldset>
          <p className="helper">No need to check every box. Use the gaps to choose your next review.</p>
          <section className="interview-followups"><h3>Interview follow-ups</h3><p>Answer aloud before opening the discussion. These are practice prompts, not scripts to memorize.</p>{lesson.followUps.map(item => <details key={item.question}><summary>{item.question}</summary><p className="preserve-lines">{item.answer}</p></details>)}</section>
          {prompt && <PathPrompt prompt={prompt} />}
          <fieldset className="rating-options"><legend>How did this feel?</legend><button onClick={() => finish('again')}><strong>Needs practice</strong><span>Review tomorrow</span></button><button onClick={() => finish('okay')}><strong>Getting there</strong><span>Review in a few days</span></button><button className="primary" onClick={() => finish('confident')}><strong>Confident</strong><span>Review after a longer gap</span></button></fieldset>
          <p className="helper">Choosing a confidence level completes this session. First reviews are in 1, 3, or 7 days. Later intervals adapt, up to 60 days. Completion and confidence are kept; your answer and checklist are cleared for fresh recall. Export from Progress before finishing if you want to keep your draft.</p><button className="text-button" onClick={() => advance('practice')}>Back to my answer</button>
        </>}
      </section>
    </div>
  </div>
}
