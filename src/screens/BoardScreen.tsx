import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { AppModel } from '../app-model'
import Icon from '../components/Icon'
import BoardEditor from '../components/BoardEditor'
import type { CanvasHandle } from '../components/BoardCanvas'
import { Checklist, PracticeBar, PracticeSummary, Reference, usePracticeTimer } from '../components/PracticeParts'
import {
  createAutosave, createBoard, deleteBoard, excalidrawFile, getBoard, listBoards, migrateLegacyBoard, parseExcalidrawFile,
  renameBoard, saveFallback, savePractice, saveScene, MAX_TITLE,
} from '../boards'
import type { BoardKind, BoardRecord, BoardScene, SaveStatus } from '../boards'
import { MAX_BOARD_BYTES } from '../board-backup'
import { caseIndex, loadCases } from '../cases'
import type { DesignCase } from '../case-types'
import { FREE_BOARD, readDesignDraft } from '../design-drafts'
import type { Board } from '../design-drafts'
import { displayDate } from '../format'
import { attemptText } from '../practice'
import type { PracticeState } from '../practice'
import { problemIndex } from '../problems'
import '../board.css'
import { useBusy, useSaveCheck } from '../relaunch-guard'

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const fileName = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'board'
const message = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong.'
const shapeCount = (board: BoardRecord) => board.elements.filter(element => !element.containerId).length
const shapes = (board: BoardRecord) => `${shapeCount(board)} ${shapeCount(board) === 1 ? 'shape' : 'shapes'}`

export default function BoardScreen({ app, boardId }: { app: AppModel; boardId?: string }) {
  const [flash, setFlash] = useState('')
  useEffect(() => { if (!boardId) return; const timer = window.setTimeout(() => setFlash(''), 8_000); return () => window.clearTimeout(timer) }, [boardId, flash])
  return boardId
    ? <BoardPage key={boardId} app={app} id={boardId} flash={flash} />
    : <BoardList app={app} onCreated={setFlash} />
}

const KINDS: { kind: BoardKind; label: string; list: string; empty: string; hint: string; href?: string; link?: string }[] = [
  { kind: 'free', label: 'Boards', list: 'Your boards', empty: 'No boards yet', hint: 'Create one to start drawing.' },
  { kind: 'practice', label: 'Practice', list: 'Practice boards', empty: 'No practice boards yet', hint: 'Start a timed practice from any design case.', href: '#design', link: 'Pick a case study' },
  { kind: 'scratch', label: 'Scratchpads', list: 'Scratchpads', empty: 'No scratchpads yet', hint: 'Open the scratchpad on any coding problem.', href: '#code', link: 'Pick a problem' },
]

function rowMeta(board: BoardRecord): string {
  const updated = `Updated ${displayDate(board.updatedAt.slice(0, 10))}`
  if (board.kind === 'practice' && board.practice) return `${attemptText(board.practice)} · ${updated}`
  if (board.kind === 'scratch') {
    const problem = problemIndex.find(item => item.id === board.problemId)
    return `${problem ? `For ${problem.title} · ` : ''}${shapes(board)} · ${updated}`
  }
  return `${shapes(board)} · ${updated}`
}

function BoardList({ app, onCreated }: { app: AppModel; onCreated: (flash: string) => void }) {
  const [boards, setBoards] = useState<BoardRecord[]>()
  const [kind, setKind] = useState<BoardKind>('free')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [renaming, setRenaming] = useState<BoardRecord>()
  const [deleting, setDeleting] = useState<BoardRecord>()
  const [draftTitle, setDraftTitle] = useState('')
  const importInput = useRef<HTMLInputElement>(null)
  const renameDialog = useRef<HTMLDialogElement>(null)
  const deleteDialog = useRef<HTMLDialogElement>(null)
  const view = KINDS.find(item => item.kind === kind)!
  const shown = boards?.filter(board => board.kind === kind)

  const refresh = useCallback(async () => {
    try { setBoards(await listBoards()) } catch (problem) { setError(message(problem)); setBoards([]) }
  }, [])
  useEffect(() => {
    void (async () => {
      try {
        const migrated = await migrateLegacyBoard(readDesignDraft(FREE_BOARD).board)
        if (migrated) setStatus('Your old whiteboard is now “My first board”. The original is kept too.')
      } catch { /* The list still loads; migration retries next visit. */ }
      await refresh()
    })()
  }, [refresh])
  useEffect(() => { app.heading.current?.focus() }, [app.heading])
  useEffect(() => { if (renaming) renameDialog.current?.showModal(); else renameDialog.current?.close() }, [renaming])
  useEffect(() => { if (deleting) deleteDialog.current?.showModal(); else deleteDialog.current?.close() }, [deleting])

  async function create() {
    try {
      const board = await createBoard()
      const xp = app.createdBoard()
      onCreated(xp ? `Board created · +${xp} XP` : '')
      window.location.hash = `board/${board.id}`
    } catch (problem) { setError(message(problem)) }
  }

  async function importFile(file: File | undefined) {
    if (!file) return
    try {
      if (file.size > MAX_BOARD_BYTES) throw new Error('The file must be 5 MB or smaller.')
      const scene = parseExcalidrawFile(await file.text())
      const board = await createBoard({ title: file.name.replace(/\.(excalidraw|json)$/i, ''), scene })
      const xp = app.createdBoard()
      setError('')
      setKind('free')
      setStatus(`Imported “${board.title}”.${xp ? ` +${xp} XP` : ''}`)
      await refresh()
    } catch (problem) {
      setError(`${message(problem)} Nothing was imported.`)
    } finally {
      if (importInput.current) importInput.current.value = ''
    }
  }

  async function rename() {
    if (!renaming) return
    try {
      const board = await renameBoard(renaming.id, draftTitle)
      setStatus(`Renamed to “${board.title}”.`)
      await refresh()
    } catch (problem) { setError(message(problem)) }
    setRenaming(undefined)
  }

  async function remove() {
    if (!deleting) return
    try {
      await deleteBoard(deleting.id)
      setStatus(`Deleted “${deleting.title}”.`)
      await refresh()
    } catch (problem) { setError(message(problem)) }
    setDeleting(undefined)
  }

  return <>
    <a className="back-link" href="#practice"><Icon name="back" size={16} /> Practice</a>
    <div className="page-heading"><div><div className="eyebrow">PRACTICE · WHITEBOARD</div><h1 ref={app.heading} tabIndex={-1}>Whiteboards</h1><p>Sketch designs with shapes, arrows and system design stencils. Saved on this device.</p></div></div>
    <div className="button-row board-actions">
      <button className="primary" onClick={() => { void create() }}>New board</button>
      <button onClick={() => importInput.current?.click()}>Import .excalidraw <span aria-hidden="true">↑</span></button>
      <input ref={importInput} type="file" accept=".excalidraw,.json,application/json" className="sr-only" aria-label="Import an Excalidraw file" onChange={event => { void importFile(event.target.files?.[0]) }} />
    </div>
    {error && <p className="alert" role="alert">{error}</p>}
    <p className="board-status" role="status">{status}</p>
    <fieldset className="board-filter">
      <legend className="sr-only">Show</legend>
      <div className="chip-group">{KINDS.map(item => <label key={item.kind} className="chip">
        <input type="radio" name="board-kind" checked={kind === item.kind} onChange={() => setKind(item.kind)} />
        {item.label}{boards && <span className="muted"> ({boards.filter(board => board.kind === item.kind).length})</span>}
      </label>)}</div>
    </fieldset>
    {!shown ? <p className="muted">Loading boards…</p> : shown.length === 0
      ? <section className="card empty-state board-empty"><h2>{view.empty}</h2><p>{view.hint}</p>{view.href && <a className="button" href={view.href}>{view.link}</a>}</section>
      : <ul className="card code-list board-list" aria-label={view.list}>{shown.map(board => <li key={board.id} className="code-row">
        <span className="case-row-text"><a href={`#board/${board.id}`}>{board.title}</a><span className="muted">{rowMeta(board)}</span></span>
        <span className="button-row board-row-actions">
          <button className="text-button" aria-label={`Rename ${board.title}`} onClick={() => { setDraftTitle(board.title); setRenaming(board) }}>Rename</button>
          <button className="text-button danger" aria-label={`Delete ${board.title}`} onClick={() => setDeleting(board)}>Delete</button>
        </span>
      </li>)}</ul>}

    <dialog ref={renameDialog} className="import-dialog" aria-labelledby="rename-title" onCancel={() => setRenaming(undefined)}>
      <form method="dialog" onSubmit={event => { event.preventDefault(); void rename() }}>
        <h2 id="rename-title">Rename board</h2>
        <label className="field" htmlFor="board-title">Board name<input id="board-title" value={draftTitle} maxLength={MAX_TITLE} autoFocus onChange={event => setDraftTitle(event.target.value)} /></label>
        <div className="button-row"><button type="button" onClick={() => setRenaming(undefined)}>Cancel</button><button className="primary" type="submit">Save name</button></div>
      </form>
    </dialog>
    <dialog ref={deleteDialog} className="import-dialog" aria-labelledby="delete-title" onCancel={() => setDeleting(undefined)}>
      <h2 id="delete-title">Delete “{deleting?.title}”?</h2>
      <p>This can’t be undone. Export it first if you want a copy.</p>
      <div className="button-row"><button autoFocus onClick={() => setDeleting(undefined)}>Cancel</button><button className="primary danger" onClick={() => { void remove() }}>Delete board</button></div>
    </dialog>
  </>
}

const STATUS_TEXT: Record<SaveStatus, string> = { saved: 'Saved on this device', pending: 'Unsaved changes…', saving: 'Saving…', error: 'Not saved' }

function BoardPage({ app, id, flash }: { app: AppModel; id: string; flash: string }) {
  const [board, setBoard] = useState<BoardRecord | null>()
  const [loadError, setLoadError] = useState('')
  useEffect(() => {
    let live = true
    getBoard(id).then(found => { if (live) setBoard(found ?? null) }, problem => { if (live) setLoadError(message(problem)) })
    return () => { live = false }
  }, [id])
  useEffect(() => { app.heading.current?.focus() }, [app.heading, board === undefined])

  if (loadError) return <section className="card empty-state"><h1 ref={app.heading} tabIndex={-1}>This board couldn’t open.</h1><p>{loadError}</p><a className="button" href="#board">Back to whiteboards</a></section>
  if (board === undefined) return <p role="status">Loading board…</p>
  if (board === null) return <section className="card empty-state"><h1 ref={app.heading} tabIndex={-1}>This page isn’t on the roadmap.</h1><button onClick={() => app.navigate('home')}>Back to Home</button></section>
  return <LoadedBoard app={app} board={board} flash={flash} />
}

function LoadedBoard({ app, board, flash }: { app: AppModel; board: BoardRecord; flash: string }) {
  const id = board.id
  const [status, setStatus] = useState<SaveStatus>('saved')
  const [saveError, setSaveError] = useState('')
  const [exportError, setExportError] = useState('')
  const [mode, setMode] = useState<'canvas' | 'fallback'>()
  const handle = useRef<CanvasHandle | null>(null)
  const latest = useRef<BoardScene>(board)
  const failed = useRef(false)
  const report = useCallback((next: SaveStatus, error?: string) => { failed.current = next === 'error'; setStatus(next); setSaveError(error ?? '') }, [])
  const [autosave] = useState(() => createAutosave<BoardScene>(scene => saveScene(id, scene), report))
  const [fallbackSave] = useState(() => createAutosave<Board>(sketch => saveFallback(id, sketch), report))

  useEffect(() => {
    const flush = () => { void autosave.flush(); void fallbackSave.flush() }
    window.addEventListener('pagehide', flush)
    return () => { window.removeEventListener('pagehide', flush); flush() }
  }, [autosave, fallbackSave])

  const onChange = useCallback((scene: BoardScene) => { latest.current = scene; autosave.schedule(scene) }, [autosave])
  useSaveCheck(async () => {
    await Promise.all([autosave.flush(), fallbackSave.flush()])
    return failed.current ? 'The whiteboard could not be saved.' : undefined
  })
  const onReady = useCallback((next: CanvasHandle) => { handle.current = next }, [])
  const practice = board.kind === 'practice' && board.practice && board.caseId ? { state: board.practice, caseId: board.caseId } : undefined
  const caseTitle = caseIndex.find(item => item.id === practice?.caseId)?.title

  async function exportPng() {
    try {
      if (!handle.current) throw new Error('The drawing tool is not ready.')
      await autosave.flush()
      downloadBlob(await handle.current.png(), `${fileName(board.title)}.png`)
      setExportError('')
    } catch (problem) { setExportError(`The PNG could not be made. ${message(problem)}`) }
  }

  function exportJson() {
    try {
      const scene = handle.current?.scene() ?? latest.current
      downloadBlob(new Blob([excalidrawFile(scene)], { type: 'application/json' }), `${fileName(board.title)}.excalidraw`)
      setExportError('')
    } catch (problem) { setExportError(`The file could not be made. ${message(problem)}`) }
  }

  const editor = <BoardEditor initial={board} name={board.title} onChange={onChange} onReady={onReady} onMode={setMode}
    fallback={board.fallback} onFallbackChange={sketch => fallbackSave.schedule(sketch)} />

  return <div className="board-page">
    {practice
      ? <a className="back-link" href={`#design/${practice.caseId}`}><Icon name="back" size={16} /> {caseTitle ?? 'Case study'}</a>
      : <a className="back-link" href="#board"><Icon name="back" size={16} /> Whiteboards</a>}
    <div className="page-heading board-heading">
      <div><div className="eyebrow">{practice ? 'PRACTICE · SYSTEM DESIGN' : board.kind === 'scratch' ? 'SCRATCHPAD' : 'WHITEBOARD'}</div><h1 ref={app.heading} tabIndex={-1}>{board.title}</h1>
        <p className={status === 'error' ? 'board-save error' : 'board-save'} role="status" data-save={status}>{STATUS_TEXT[status]}{saveError && `. ${saveError}`}</p></div>
      <div className="button-row board-exports">
        {mode === 'canvas' && <button onClick={() => { void exportPng() }}>Export PNG <span aria-hidden="true">↓</span></button>}
        <button onClick={exportJson}>Export .excalidraw <span aria-hidden="true">↓</span></button>
      </div>
    </div>
    {flash && <p className="notice board-flash" role="status">{flash}</p>}
    {exportError && <p className="alert" role="alert">{exportError}</p>}
    {practice
      ? <Practice app={app} id={id} caseId={practice.caseId} initial={practice.state} mode={mode} flushScene={() => autosave.flush()} onSaveStatus={report}>{editor}</Practice>
      : <section className="board-region" aria-label="Drawing area" aria-describedby="board-alt">
        <p id="board-alt" className="sr-only">Drawing area. Its content is your own drawing and is not read aloud.</p>
        {mode === 'canvas' && <p className="helper board-tip">Press a shape’s number or letter to pick a tool. The stencils are in the Library panel.</p>}
        {editor}
      </section>}
  </div>
}

interface PracticeProps {
  app: AppModel
  id: string
  caseId: string
  initial: PracticeState
  mode: 'canvas' | 'fallback' | undefined
  flushScene: () => Promise<void>
  onSaveStatus: (status: SaveStatus, error?: string) => void
  children: ReactNode
}

/** A timed practice board: draw, finish, then compare with the reference and tick the checklist. */
function Practice({ app, id, caseId, initial, mode, flushScene, onSaveStatus, children }: PracticeProps) {
  const [item, setItem] = useState<DesignCase>()
  const [caseError, setCaseError] = useState('')
  const [note, setNote] = useState('')
  const heading = useRef<HTMLHeadingElement>(null)
  const practiceFailed = useRef(false)
  const [practiceSave] = useState(() => createAutosave<PracticeState>(state => savePractice(id, state), (status, error) => { practiceFailed.current = status === 'error'; onSaveStatus(status, error) }, 0))
  const timer = usePracticeTimer(initial, state => practiceSave.schedule(state))
  const finished = timer.finished
  useEffect(() => () => { void practiceSave.flush() }, [practiceSave])
  useSaveCheck(async () => {
    await practiceSave.flush()
    return practiceFailed.current ? 'The practice timer could not be saved.' : undefined
  })
  useBusy(timer.running && 'A timed whiteboard practice')
  useEffect(() => {
    if (!finished) return
    let live = true
    loadCases().then(all => { if (live) setItem(all.get(caseId)) }, () => { if (live) setCaseError('The reference could not be loaded. Reconnect and try again.') })
    return () => { live = false }
  }, [caseId, finished])

  async function finish() {
    timer.finish()
    await flushScene()
    const xp = app.createdBoard(caseId)
    setNote(xp ? `Practice saved · +${xp} XP` : 'Practice saved.')
    requestAnimationFrame(() => heading.current?.focus())
  }

  return <>
    {finished ? <PracticeSummary state={timer.state} heading={heading} /> : <PracticeBar timer={timer} onFinish={() => { void finish() }} />}
    {note && <p className="notice board-flash" role="status">{note}</p>}
    <div className={finished ? 'practice-layout reviewing' : 'practice-layout'}>
      <section className="board-region" aria-label="Drawing area" aria-describedby="board-alt">
        {finished && <h2 className="section-title">Your board</h2>}
        <p id="board-alt" className="sr-only">Drawing area. Its content is your own drawing and is not read aloud.</p>
        {mode === 'canvas' && !finished && <p className="helper board-tip">Press a shape’s number or letter to pick a tool. The stencils are in the Library panel.</p>}
        {children}
      </section>
      {finished && <Reference item={item} error={caseError} />}
    </div>
    {finished && <Checklist timer={timer} />}
  </>
}
