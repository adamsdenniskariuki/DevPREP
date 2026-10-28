import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { lessons, tracks } from './curriculum'
import type { Lesson, Track } from './curriculum'
import { beginSession, completeSession, dueLessons, localDay, recordCard, recordDesign, recordGuide, recordMock, recordPatternExercise, recordPatternQuiz, recordPicker, recordPlacement, recordSolve, recordSqlSolve, recordBoardCreated, recordCompanyRun, recordCompanyMock, saveStory as saveStoryTo, deleteStory as deleteStoryFrom, updateProfile, editorPrefs, updateEditorPrefs } from './progress'
import { EditorPrefsContext } from './editor-context'
import type { EditorPrefs } from './editor-prefs'
import type { CompanyMockResult, CompanyRun, MockResult, Mode, Profile, Rating, StudySession, Story } from './progress'
import { gradeCard as gradeFlashcard } from './flashcards'
import type { Grade } from './flashcards'
import { useProgress } from './useProgress'
import { displayDate } from './format'
import { getLearningPath, nextLessonFor, pathLessonIds, pathProgress, selectPath } from './learning-paths'
import type { PathId } from './learning-paths'
import { activityXp, boardXp, cardXp, companyMockXp, companyXp, daysUntil, designXp, gameStats, guideXp, mockXp, patternXp, solveXp, sqlSolveXp, weakAreas } from './gamification'
import { problemIds } from './problems'
import { sqlProblemIds } from './sql-problems'
import { placementResult } from './placement'
import { caseIds } from './cases'
import { guideIds } from './guides'
import { patternIds } from './patterns'
import type { PatternLang } from './pattern-types'
import type { CodeLanguage } from './problem-types'
import { TOUR_KEY } from './appearance'
import Icon from './components/Icon'
import PwaPanel from './components/PwaPanel'
import { useAccent } from './useAccent'
import { useAppearance } from './useAppearance'
import { usePwa } from './usePwa'
import HomeScreen from './screens/HomeScreen'
import TracksScreen from './screens/TracksScreen'
import Study from './screens/Study'
import { companyIds } from './companies'
import type { FullBackup } from './board-backup'
import type { AppModel, Route } from './app-model'
import { parseHash as parseRoute } from './routes'
import type { RouteIds } from './routes'
import { breadcrumbsFor, buildNavTree, currentNode, expandedFor, groupFor, loadNavData } from './nav-model'
import type { NavData } from './nav-model'
import { useNavState } from './useNavState'
import NavTree from './components/NavTree'
import MobileNav from './components/MobileNav'
import Breadcrumbs from './components/Breadcrumbs'

const CodeScreen = lazy(() => import('./screens/CodeScreen'))
const SqlProblemsScreen = lazy(() => import('./screens/SqlProblemsScreen'))
const DesignScreen = lazy(() => import('./screens/DesignScreen'))
const FlashcardsScreen = lazy(() => import('./screens/FlashcardsScreen'))
const MockScreen = lazy(() => import('./screens/MockScreen'))
const StoriesScreen = lazy(() => import('./screens/StoriesScreen'))
const FieldGuideScreen = lazy(() => import('./screens/FieldGuideScreen'))
const PatternsScreen = lazy(() => import('./screens/PatternsScreen'))
const CompanyScreen = lazy(() => import('./screens/CompanyScreen'))
const ProgressScreen = lazy(() => import('./screens/ProgressScreen'))
const PlanScreen = lazy(() => import('./screens/PlanScreen'))
const PracticeScreen = lazy(() => import('./screens/PracticeScreen'))
const BoardScreen = lazy(() => import('./screens/BoardScreen'))
const SettingsScreen = lazy(() => import('./screens/SettingsScreen'))
const MapScreen = lazy(() => import('./screens/MapScreen'))
const PlaygroundScreen = lazy(() => import('./screens/PlaygroundScreen'))
const CommandPalette = lazy(() => import('./components/CommandPalette'))
const MAC = /Mac|iP(hone|ad)/.test(navigator.platform)
/** Backup files, whiteboards included, are handled in a lazy chunk so they add nothing to the main bundle. */
const backupFlow = () => import('./backup-flow')
const ImportDialog = lazy(backupFlow)
const Recovery = lazy(() => backupFlow().then(flow => ({ default: flow.Recovery })))

const routeIds: RouteIds = { tracks: tracks.map(item => item.id), problems: problemIds, sql: sqlProblemIds, cases: caseIds, guides: guideIds, patterns: patternIds, companies: companyIds }
const parseHash = () => parseRoute(window.location.hash, routeIds)

function tourSeen() {
  try { return window.localStorage.getItem(TOUR_KEY) !== null } catch { return true }
}

export default function App() {
  const store = useProgress()
  const accent = useAccent()
  const look = useAppearance()
  const { progress } = store
  const [hash, setHash] = useState(() => window.location.hash)
  const [route, setRoute] = useState(() => parseHash().route)
  const [track, setTrack] = useState<Track | 'all'>('all')
  const [problemId, setProblemId] = useState(() => parseHash().problemId)
  const [caseId, setCaseId] = useState(() => parseHash().caseId)
  const [guideId, setGuideId] = useState(() => parseHash().guideId)
  const [sqlId, setSqlId] = useState(() => parseHash().sqlId)
  const [patternView, setPatternView] = useState(() => parseHash().patternView)
  const [boardId, setBoardId] = useState(() => parseHash().boardId)
  const [companyId, setCompanyId] = useState(() => parseHash().companyId)
  const [snippetId, setSnippetId] = useState(() => parseHash().snippetId)
  const [includeBoards, setIncludeBoards] = useState(true)
  const [roadmapScope, setRoadmapScope] = useState<'path' | 'all'>(progress.selectedPath ? 'path' : 'all')
  const [notice, setNotice] = useState('')
  const [backupError, setBackupError] = useState('')
  const [pendingImport, setPendingImport] = useState<FullBackup | null>(null)
  const [clock, setClock] = useState(() => new Date())
  const [tour, setTour] = useState<'auto' | 'replay' | 'off'>(() => tourSeen() ? 'off' : 'auto')
  const nav = useNavState()
  const [navData, setNavData] = useState<NavData>()
  const needIndex = useCallback(() => { loadNavData().then(setNavData, () => undefined) }, [])
  useEffect(needIndex, [needIndex])
  const [palette, setPalette] = useState(false)
  useEffect(() => {
    // Capture phase, so Ctrl/Cmd+K opens search even from inside an editor. Shift+K reports 'K'.
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key === 'k') {
        event.preventDefault()
        event.stopPropagation()
        setPalette(true)
      }
    }
    addEventListener('keydown', onKey, true)
    return () => removeEventListener('keydown', onKey, true)
  }, [])
  const importInput = useRef<HTMLInputElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
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
      setHash(window.location.hash)
      setRoute(parsed.route)
      setProblemId(parsed.problemId)
      setCaseId(parsed.caseId)
      setGuideId(parsed.guideId)
      setSqlId(parsed.sqlId)
      setPatternView(parsed.patternView)
      setBoardId(parsed.boardId)
      setCompanyId(parsed.companyId)
      setSnippetId(parsed.snippetId)
      if (parsed.track) { setRoadmapScope('all'); setTrack(parsed.track) }
    }
    apply()
    const timer = window.setInterval(() => setClock(new Date()), 60_000)
    window.addEventListener('hashchange', apply)
    return () => { window.removeEventListener('hashchange', apply); window.clearInterval(timer) }
  }, [])
  useEffect(() => { heading.current?.focus() }, [route, problemId, caseId, guideId, sqlId, patternView, boardId, companyId, snippetId])

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
    setHash(`#${next}`)
    setRoute(next)
    setProblemId(undefined)
    setCaseId(undefined)
    setGuideId(undefined)
    setSqlId(undefined)
    setPatternView(undefined)
    setCompanyId(undefined)
  }

  const latest = useRef(progress)
  latest.current = progress
  function solveProblem(id: string, lang: CodeLanguage) {
    const before = latest.current
    const after = recordSolve(before, id, lang)
    if (after === before) return 0
    store.update(value => recordSolve(value, id, lang))
    latest.current = after
    return solveXp(after) - solveXp(before)
  }
  function solveSqlProblem(id: string) {
    const before = latest.current
    const after = recordSqlSolve(before, id)
    if (after === before) return 0
    store.update(value => recordSqlSolve(value, id))
    latest.current = after
    return sqlSolveXp(after) - sqlSolveXp(before)
  }
  function scoreDesign(id: string, percent: number) {
    const before = latest.current
    const after = recordDesign(before, id, percent)
    store.update(value => recordDesign(value, id, percent))
    latest.current = after
    return designXp(after) - designXp(before)
  }
  function placeTrack(track: Track, answers: (number | undefined)[]) {
    const questions = tracks.find(item => item.id === track)?.placement ?? []
    const result = placementResult(questions, answers)
    latest.current = recordPlacement(latest.current, track, result.percent, result.known)
    store.update(value => recordPlacement(value, track, result.percent, result.known))
    return result
  }
  function readGuide(id: string, percent: number) {
    const before = latest.current
    const after = recordGuide(before, id, percent)
    store.update(value => recordGuide(value, id, percent))
    latest.current = after
    return guideXp(after) - guideXp(before)
  }
  function passPatternExercise(id: string, lang: PatternLang) {
    const before = latest.current
    const after = recordPatternExercise(before, id, lang)
    if (after === before) return 0
    store.update(value => recordPatternExercise(value, id, lang))
    latest.current = after
    return patternXp(after) - patternXp(before)
  }
  function scorePatternQuiz(id: string, percent: number) {
    const before = latest.current
    const after = recordPatternQuiz(before, id, percent)
    store.update(value => recordPatternQuiz(value, id, percent))
    latest.current = after
    return patternXp(after) - patternXp(before)
  }
  function finishPicker(score: number) {
    const before = latest.current
    const after = recordPicker(before, score)
    store.update(value => recordPicker(value, score))
    latest.current = after
    return patternXp(after) - patternXp(before)
  }
  function createdBoard(caseId?: string) {
    const before = latest.current
    const after = recordBoardCreated(before, caseId)
    if (after === before) return 0
    store.update(value => recordBoardCreated(value, caseId))
    latest.current = after
    return boardXp(after) - boardXp(before)
  }

  function gradeCard(id: string, grade: Grade) {
    const before = latest.current
    const state = gradeFlashcard(before.cards?.[id], grade, localDay(new Date()))
    const after = recordCard(before, id, state)
    store.update(value => recordCard(value, id, state))
    latest.current = after
    return cardXp(after) - cardXp(before)
  }
  function finishMock(result: Omit<MockResult, 'at'>) {
    const before = latest.current
    const after = recordMock(before, result)
    store.update(value => recordMock(value, result))
    latest.current = after
    return mockXp(after) - mockXp(before)
  }
  function finishCompanyRun(id: string, run: Omit<CompanyRun, 'at'>) {
    const before = latest.current
    const after = recordCompanyRun(before, id, run)
    store.update(value => recordCompanyRun(value, id, run))
    latest.current = after
    return companyXp(after) - companyXp(before)
  }
  function finishCompanyMock(id: string, result: Omit<CompanyMockResult, 'at'>) {
    const before = latest.current
    const after = recordCompanyMock(before, id, result)
    store.update(value => recordCompanyMock(value, id, result))
    latest.current = after
    return companyMockXp(after) - companyMockXp(before)
  }
  function saveStory(story: Omit<Story, 'updatedAt'>) {
    try { latest.current = saveStoryTo(latest.current, story) } catch (error) { return (error as Error).message }
    store.update(value => saveStoryTo(value, story))
    return ''
  }
  function deleteStory(id: string) {
    latest.current = deleteStoryFrom(latest.current, id)
    store.update(value => deleteStoryFrom(value, id))
  }

  function changePath(id: PathId | undefined) {
    store.update(value => selectPath(value, id))
    setNotice(`${getLearningPath(id)?.title ?? 'All curriculum'} selected. Your progress is unchanged.`)
  }

  function changeEditorPrefs(patch: Partial<EditorPrefs>) {
    store.update(value => updateEditorPrefs(value, patch))
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

  const backupFailed = (error: unknown) => setBackupError(error instanceof Error ? error.message : String(error))
  function exportBackup() {
    backupFlow().then(flow => flow.exportBackup(progress, includeBoards, today)).then(text => { setNotice(text); setBackupError('') }, backupFailed)
  }
  function importBackup(file: File | undefined) {
    if (file) backupFlow().then(flow => flow.importBackup(file)).then(parsed => { setPendingImport(parsed); setBackupError('') }, backupFailed)
      .finally(() => { if (importInput.current) importInput.current.value = '' })
  }

  const backupControls = <div className="backup-controls">
    {!store.recovery && <label className="check-row"><input type="checkbox" checked={includeBoards} onChange={event => setIncludeBoards(event.target.checked)} /> Include whiteboards</label>}
    <div className="button-row">
      {!store.recovery && <button onClick={exportBackup}>Export backup <span aria-hidden="true">↓</span></button>}
      <button onClick={() => importInput.current?.click()}>Import backup <span aria-hidden="true">↑</span></button>
    </div>
  </div>
  const accentProblem = <div className="accent-problem"><strong>Accent preference needs attention.</strong><p>{accent.error} Study progress is separate and has not been changed by the accent preference.</p><button onClick={accent.retry}>Save current accent</button></div>

  const app: AppModel = {
    progress, due, completed, selectedPath, selectedStatus, nextLesson, todayActivity, learnedToday, reviewedToday,
    activeLesson, percent, outsidePath, clock, today, game, weak: weakAreas(progress), daysLeft: daysUntil(progress.profile?.interviewDate, clock),
    heading, backupControls, roadmapScope, setRoadmapScope, track, setTrack,
    navigate, start, browseAll, changePath, changeProfile, solveProblem, solveSqlProblem, scoreDesign, readGuide, passPatternExercise, scorePatternQuiz, finishPicker, createdBoard, placeTrack, gradeCard, finishMock, finishCompanyRun, finishCompanyMock, saveStory, deleteStory, tourOpen, closeTour,
    replayTour: () => { setTour('replay'); navigate('home') },
  }
  const parsed = parseRoute(hash, routeIds)
  const tree = useMemo(() => buildNavTree(navData?.deepSections(progress, navData.index), due.length), [progress, navData, due.length])
  const branch = expandedFor(tree, parsed)
  const pathIds = new Set(branch)
  const currentId = currentNode(tree, parsed)?.id
  const crumbs = breadcrumbsFor(tree, parsed, { lesson: route === 'study' ? activeLesson?.title : undefined })
  const branchKey = branch.join('|')
  const { setOpen: openBranches } = nav
  useEffect(() => { if (branchKey) openBranches(branchKey.split('|'), true) }, [branchKey, openBranches])
  const treeProps = { expanded: nav.expanded, setOpen: nav.setOpen, current: currentId, path: pathIds, onNeedIndex: needIndex }

  const editorContext = { prefs: editorPrefs(progress), setPrefs: changeEditorPrefs }
  return <EditorPrefsContext.Provider value={editorContext}><div className={nav.collapsed ? 'app-shell nav-collapsed' : 'app-shell'}>
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus() }}>Skip to content</a>
    <aside className="sidebar">
      <div className="sidebar-head">
        <a className="brand" href="#home" aria-label="DevPREP home"><span className="brand-mark"><Icon name="code" size={24} /></span><span className="brand-name">Dev<span className="brand-accent">PREP</span></span></a>
        <button type="button" className="icon-button sidebar-toggle" aria-expanded={!nav.collapsed} aria-label={nav.collapsed ? 'Show menu' : 'Hide menu'} onClick={() => nav.setCollapsed(!nav.collapsed)}><Icon name="back" size={18} /></button>
      </div>
      {!nav.collapsed && <>
        <p className="brand-tagline">Interview prep for SE &amp; SSE.</p>
        <nav aria-label="Main navigation"><NavTree {...treeProps} nodes={tree} label="Site" /></nav>
        <div className="sidebar-journey">
          <div className="eyebrow">{selectedPath ? `${selectedPath.shortTitle} PATH` : 'ALL TRACKS'}</div>
          <progress aria-label={selectedPath ? 'Selected path completed' : 'Curriculum completed'} value={selectedStatus?.completed ?? completed} max={selectedStatus?.total ?? lessons.length} />
          <span>{selectedStatus?.completed ?? completed} of {selectedStatus?.total ?? lessons.length} lessons</span>
        </div>
        <div className="sidebar-bottom"><span className="local-dot" /> Saved on this device<a className="text-button" href="#settings">Backup</a></div>
      </>}
    </aside>
    <MobileNav {...treeProps} tree={tree} group={groupFor(parsed)} />

    <div className="main-shell">
      <header className="topbar"><a className="mobile-brand" href="#home">Dev<span>PREP</span></a>
        <div className="topbar-right">
          <button type="button" className="search-button" aria-keyshortcuts={MAC ? 'Meta+K' : 'Control+K'} onClick={() => setPalette(true)}><Icon name="search" size={18} /><span className="search-text">Search</span><kbd aria-hidden="true">{MAC ? '⌘K' : 'Ctrl K'}</kbd></button>
          <a className="game-chip" href="#progress"><span className={game.streak.activeToday ? 'chip-part lit' : 'chip-part'}><Icon name="flame" size={16} />{game.streak.current}<span className="sr-only"> day streak, </span></span><span className="chip-part"><Icon name="bolt" size={16} />{game.xp}<span className="sr-only"> XP</span></span></a>
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
        <Breadcrumbs crumbs={crumbs} />
        <input ref={importInput} type="file" accept=".json,application/json" className="sr-only" aria-label="Import progress JSON" onChange={event => importBackup(event.target.files?.[0])} />
        {store.error && <div className="alert" role="alert"><strong>{store.recovery ? 'Your saved progress needs attention.' : 'Progress could not be saved safely.'}</strong><p>{store.error} {store.unsaved && 'Your latest work is only in memory. Export it before closing this page.'}</p><div className="button-row">
          {!store.recovery && !store.conflict && <button onClick={store.retry}>Retry saving</button>}
          {!store.recovery && <button onClick={exportBackup}>Export current work</button>}
          <button onClick={() => { if (!store.unsaved || window.confirm('Reload and discard unsaved changes? Export a backup first to keep them.')) window.location.reload() }}>Reload saved version</button>
        </div>{accent.error && accentProblem}</div>}
        {!store.error && accent.error && <div className="alert" role="alert">{accentProblem}</div>}
        {notice && <div className="notice" role="status">{notice}<button className="text-button" aria-label="Dismiss notification" onClick={() => setNotice('')}>Dismiss</button></div>}
        {backupError && <div className="alert" role="alert">{backupError}</div>}

        {store.recovery ? <Suspense fallback={null}><Recovery heading={heading} today={today} controls={backupControls} replace={store.replace} fail={backupFailed}><PwaPanel pwa={pwa} reloadBlocked={reloadBlocked} /></Recovery></Suspense>
          : <>
            {route === 'home' && <HomeScreen app={app} />}
            {route === 'tracks' && <TracksScreen app={app} />}
            {route === 'practice' && <Suspense fallback={<p role="status">Loading practice…</p>}><PracticeScreen app={app} /></Suspense>}
            {route === 'code' && <Suspense fallback={<p role="status">Loading code runner…</p>}><CodeScreen app={app} problemId={problemId} /></Suspense>}
            {route === 'sql' && <Suspense fallback={<p role="status">Loading SQL problems…</p>}><SqlProblemsScreen app={app} problemId={sqlId} /></Suspense>}
            {(route === 'guide' || route === 'antipatterns') && <Suspense fallback={<p role="status">Loading the Field Guide…</p>}><FieldGuideScreen app={app} guideId={guideId} gallery={route === 'antipatterns'} /></Suspense>}
            {route === 'design' && <Suspense fallback={<p role="status">Loading system design…</p>}><DesignScreen app={app} caseId={caseId} /></Suspense>}
            {route === 'board' && <Suspense fallback={<p role="status">Loading whiteboards…</p>}><BoardScreen app={app} boardId={boardId} /></Suspense>}
            {route === 'cards' && <Suspense fallback={<p role="status">Loading flashcards…</p>}><FlashcardsScreen app={app} /></Suspense>}
            {route === 'mock' && <Suspense fallback={<p role="status">Loading mock interviews…</p>}><MockScreen app={app} companyId={companyId} /></Suspense>}
            {route === 'stories' && <Suspense fallback={<p role="status">Loading story bank…</p>}><StoriesScreen app={app} /></Suspense>}
      {route === 'patterns' && <Suspense fallback={<p role="status">Loading patterns…</p>}><PatternsScreen app={app} view={patternView} /></Suspense>}
            {route === 'company' && <Suspense fallback={<p role="status">Loading company prep…</p>}><CompanyScreen app={app} companyId={companyId} /></Suspense>}
            {route === 'plan' && <Suspense fallback={<p role="status">Loading study plan…</p>}><PlanScreen app={app} /></Suspense>}
            {route === 'progress' && <Suspense fallback={<p role="status">Loading progress…</p>}><ProgressScreen app={app} /></Suspense>}
            {route === 'settings' && <Suspense fallback={<p role="status">Loading settings…</p>}><SettingsScreen app={app} appearance={look.appearance} setAppearance={look.update} appearanceError={look.error} accent={accent.accent} chooseAccent={accent.choose} /></Suspense>}
            {route === 'playground' && <Suspense fallback={<p role="status">Loading the Playground…</p>}><PlaygroundScreen app={app} snippetId={snippetId} /></Suspense>}
      {route === 'map' && <Suspense fallback={<p role="status">Loading the site map…</p>}><MapScreen app={app} /></Suspense>}
            {route === 'study' && (progress.session && activeLesson ? <Study key={activeLesson.id} lesson={activeLesson} session={progress.session} edit={editSession} finish={finish} heading={heading} path={selectedPath} openLesson={lesson => start(lesson, progress.records[lesson.id] ? 'review' : 'learn')} /> : <section className="card empty-state"><h1 ref={heading} tabIndex={-1}>A fresh page.</h1><p>No unfinished session. Pick a lesson to begin.</p><button className="primary" onClick={() => navigate('home')}>Go to Home</button></section>)}
            {route === 'unknown' && <section className="card empty-state"><h1 ref={heading} tabIndex={-1}>This page isn’t on the roadmap.</h1><button onClick={() => navigate('home')}>Back to Home</button></section>}
            <footer className="app-footer"><PwaPanel pwa={pwa} reloadBlocked={reloadBlocked} /></footer>
          </>}
      </main>
    </div>
    {palette && <Suspense fallback={null}><CommandPalette close={() => setPalette(false)} /></Suspense>}
    {pendingImport && <Suspense fallback={null}><ImportDialog backup={pendingImport} cancel={() => setPendingImport(null)} fail={setBackupError} restored={setNotice} replace={next => {
      setPendingImport(null)
      if (!store.replace(next)) return false
      navigate('home')
      return true
    }} /></Suspense>}
  </div></EditorPrefsContext.Provider>
}
