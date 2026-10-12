import { useEffect, useRef, useState } from 'react'
import { lessons, tracks } from './curriculum'
import type { Lesson, Track } from './curriculum'
import { beginSession, completeSession, dueLessons, emptyProgress, localDay, MAX_BACKUP_BYTES, parseBackup, serializeBackup, STORAGE_KEY, updateProfile } from './progress'
import type { Mode, Profile, Rating, StudySession } from './progress'
import { useProgress } from './useProgress'
import { displayDate } from './format'
import { download } from './download'
import { getLearningPath, nextLessonFor, pathLessonIds, pathProgress, selectPath } from './learning-paths'
import type { PathId } from './learning-paths'
import { activityXp, daysUntil, gameStats, weakAreas } from './gamification'
import { TOUR_KEY } from './appearance'
import Icon from './components/Icon'
import PwaPanel from './components/PwaPanel'
import { useAccent } from './useAccent'
import { useAppearance } from './useAppearance'
import { usePwa } from './usePwa'
import HomeScreen from './screens/HomeScreen'
import TracksScreen from './screens/TracksScreen'
import PracticeScreen from './screens/PracticeScreen'
import ProgressScreen from './screens/ProgressScreen'
import SettingsScreen from './screens/SettingsScreen'
import Study from './screens/Study'
import type { AppModel, Route } from './app-model'

const navigation = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'tracks', label: 'Tracks', icon: 'map' },
  { id: 'practice', label: 'Practice', icon: 'repeat' },
  { id: 'progress', label: 'Progress', icon: 'chart' },
  { id: 'settings', label: 'Settings', icon: 'gear' },
] as const
const routes: Route[] = ['home', 'tracks', 'practice', 'progress', 'settings', 'study']
/** Hashes from earlier releases keep working as bookmarks. */
const aliases: Record<string, Route> = { today: 'home', roadmap: 'tracks', review: 'practice' }

function parseHash(): { route: Route | 'unknown'; track?: Track } {
  const [head, sub, ...rest] = window.location.hash.slice(1).split('/')
  const route = aliases[head || 'home'] ?? (routes as string[]).find(item => item === (head || 'home')) as Route | undefined
  if (!route || rest.length) return { route: 'unknown' }
  if (sub === undefined) return { route }
  const track = tracks.find(item => item.id === sub)?.id
  return route === 'tracks' && track ? { route, track } : { route: 'unknown' }
}

function tourSeen() {
  try { return window.localStorage.getItem(TOUR_KEY) !== null } catch { return true }
}

export default function App() {
  const store = useProgress()
  const accent = useAccent()
  const look = useAppearance()
  const { progress } = store
  const [route, setRoute] = useState(() => parseHash().route)
  const [track, setTrack] = useState<Track | 'all'>('all')
  const [roadmapScope, setRoadmapScope] = useState<'path' | 'all'>(progress.selectedPath ? 'path' : 'all')
  const [notice, setNotice] = useState('')
  const [backupError, setBackupError] = useState('')
  const [pendingImport, setPendingImport] = useState<ReturnType<typeof parseBackup> | null>(null)
  const [clock, setClock] = useState(() => new Date())
  const [tour, setTour] = useState<'auto' | 'replay' | 'off'>(() => tourSeen() ? 'off' : 'auto')
  const importInput = useRef<HTMLInputElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const importDialog = useRef<HTMLDialogElement>(null)
  const reloadBlocked = !!(store.error || store.unsaved || store.conflict || accent.error)
  const pwa = usePwa(() => {
    if (store.recovery || store.error || store.unsaved || store.conflict || accent.error) return false
    return store.retry()
  })

  useEffect(() => {
    setRoadmapScope(progress.selectedPath ? 'path' : 'all')
    setTrack('all')
  }, [progress.selectedPath])
  useEffect(() => {
    const apply = () => {
      const parsed = parseHash()
      setRoute(parsed.route)
      if (parsed.track) { setRoadmapScope('all'); setTrack(parsed.track) }
    }
    apply()
    const timer = window.setInterval(() => setClock(new Date()), 60_000)
    window.addEventListener('hashchange', apply)
    return () => { window.removeEventListener('hashchange', apply); window.clearInterval(timer) }
  }, [])
  useEffect(() => { heading.current?.focus() }, [route])
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
  const game = gameStats(progress, clock)
  const tourOpen = tour === 'replay' || (tour === 'auto' && completed === 0 && !progress.session)

  function navigate(next: Route) {
    window.location.hash = next
    setRoute(next)
  }

  function changePath(id: PathId | undefined) {
    store.update(value => selectPath(value, id))
    setNotice(`${getLearningPath(id)?.title ?? 'All curriculum'} selected. Your progress is unchanged.`)
  }

  function changeProfile(patch: Partial<Profile>) {
    store.update(value => updateProfile(value, patch))
  }

  function closeTour() {
    setTour('off')
    try { window.localStorage.setItem(TOUR_KEY, 'seen') } catch { /* The tour simply reappears next visit. */ }
  }

  function browseAll(nextTrack: Track | 'all' = 'all') {
    setRoadmapScope('all')
    setTrack(nextTrack)
    navigate('tracks')
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
    const last = next.activity.at(-1)
    const gained = last && last !== progress.activity.at(-1) ? activityXp(last) : 0
    setNotice(`${title} completed${gained ? ` · +${gained} XP` : ''}. Next review: ${displayDate(next.records[progress.session!.lessonId].due)}.`)
    navigate('home')
  }

  function exportBackup() {
    try {
      download(serializeBackup(progress), `devprep-backup-${today}.json`)
      setNotice('Backup downloaded. It includes your written answers.')
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

  const app: AppModel = {
    progress, due, completed, selectedPath, selectedStatus, nextLesson, todayActivity, learnedToday, reviewedToday,
    activeLesson, percent, outsidePath, clock, today, game, weak: weakAreas(progress), daysLeft: daysUntil(progress.profile?.interviewDate, clock),
    heading, backupControls, roadmapScope, setRoadmapScope, track, setTrack,
    navigate, start, browseAll, changePath, changeProfile, tourOpen, closeTour,
    replayTour: () => { setTour('replay'); navigate('home') },
  }
  const activeNav = route === 'study' ? 'home' : route

  return <div className="app-shell">
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus() }}>Skip to content</a>
    <aside className="sidebar">
      <a className="brand" href="#home" aria-label="DevPREP home"><span className="brand-mark"><Icon name="code" size={24} /></span><span>Dev<span className="brand-accent">PREP</span></span></a>
      <p className="brand-tagline">Interview prep for SE &amp; SSE.</p>
      <nav aria-label="Main navigation">
        {navigation.map(item => <a key={item.id} href={`#${item.id}`} className={activeNav === item.id ? 'nav-item active' : 'nav-item'} aria-current={route === item.id ? 'page' : undefined}>
          <Icon name={item.icon} /><span>{item.label}</span>{item.id === 'practice' && due.length > 0 && <span className="nav-badge" aria-label={`${due.length} due`}>{due.length}</span>}
        </a>)}
      </nav>
      <div className="sidebar-journey">
        <div className="eyebrow">{selectedPath ? `${selectedPath.shortTitle} PATH` : 'ALL TRACKS'}</div>
        <progress aria-label={selectedPath ? 'Selected path completed' : 'Curriculum completed'} value={selectedStatus?.completed ?? completed} max={selectedStatus?.total ?? lessons.length} />
        <span>{selectedStatus?.completed ?? completed} of {selectedStatus?.total ?? lessons.length} lessons</span>
      </div>
      <div className="sidebar-bottom"><span className="local-dot" /> Saved on this device<a className="text-button" href="#settings">Backup</a></div>
    </aside>

    <div className="main-shell">
      <header className="topbar"><a className="mobile-brand" href="#home">Dev<span>PREP</span></a>
        <div className="topbar-right">
          <a className="game-chip" href="#progress" aria-label={`${game.streak.current}-day streak, ${game.xp} XP`}><span className={game.streak.activeToday ? 'chip-part lit' : 'chip-part'}><Icon name="flame" size={16} />{game.streak.current}</span><span className="chip-part"><Icon name="bolt" size={16} />{game.xp}</span></a>
          {pwa.updateReady && <a className="update-chip" href="#settings">Update ready</a>}
          <span className="local-label">{store.unsaved ? 'Not saved' : store.recovery || store.conflict ? 'Storage needs attention' : 'Saved'}</span>
          <button className="theme-button" aria-label="Toggle color theme" onClick={() => {
            const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
            document.documentElement.dataset.theme = theme
            const url = new URL(window.location.href)
            url.searchParams.set('scoutTheme', theme)
            window.history.replaceState(null, '', url)
          }}><Icon name="sun" size={18} /></button>
        </div></header>
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
        }}>Replace with a fresh start</button><PwaPanel pwa={pwa} reloadBlocked={reloadBlocked} /></section>
          : <>
            {route === 'home' && <HomeScreen app={app} />}
            {route === 'tracks' && <TracksScreen app={app} />}
            {route === 'practice' && <PracticeScreen app={app} />}
            {route === 'progress' && <ProgressScreen app={app} />}
            {route === 'settings' && <SettingsScreen app={app} appearance={look.appearance} setAppearance={look.update} appearanceError={look.error} accent={accent.accent} chooseAccent={accent.choose} />}
            {route === 'study' && (progress.session && activeLesson ? <Study key={activeLesson.id} lesson={activeLesson} session={progress.session} edit={editSession} finish={finish} heading={heading} path={selectedPath} openLesson={lesson => start(lesson, progress.records[lesson.id] ? 'review' : 'learn')} /> : <section className="card empty-state"><h1 ref={heading} tabIndex={-1}>A fresh page.</h1><p>No unfinished session. Pick a lesson to begin.</p><button className="primary" onClick={() => navigate('home')}>Go to Home</button></section>)}
            {route === 'unknown' && <section className="card empty-state"><h1 ref={heading} tabIndex={-1}>This page isn’t on the roadmap.</h1><button onClick={() => navigate('home')}>Back to Home</button></section>}
            <footer className="app-footer"><PwaPanel pwa={pwa} reloadBlocked={reloadBlocked} /></footer>
          </>}
      </main>
    </div>
    <input ref={importInput} type="file" accept=".json,application/json" className="sr-only" aria-label="Import progress JSON" onChange={event => { void importBackup(event.target.files?.[0]) }} />
    <dialog ref={importDialog} className="import-dialog" aria-labelledby="import-title" onCancel={() => setPendingImport(null)}>
      <h2 id="import-title">Replace this browser’s progress?</h2><p>This backup contains {pendingImport ? Object.keys(pendingImport.records).length : 0} completed lessons{pendingImport?.session ? ' and an unfinished session' : ''}. It will replace, not merge with, your current progress.</p><p>Learning path after import: {getLearningPath(pendingImport?.selectedPath)?.title ?? 'All curriculum (no path selected)'}. The backup replaces this choice too.</p><p>Export your current progress first if you want to keep both versions.</p><div className="button-row"><button autoFocus onClick={() => setPendingImport(null)}>Cancel import</button><button className="primary" onClick={() => {
        if (pendingImport && store.replace(pendingImport)) {
          setPendingImport(null)
          setNotice('Backup restored. Your lessons, reviews, and unfinished session are ready.')
          navigate('home')
        } else setPendingImport(null)
      }}>Replace progress</button></div>
    </dialog>
  </div>
}
