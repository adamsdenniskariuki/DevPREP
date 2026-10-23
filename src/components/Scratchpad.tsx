import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppModel } from '../app-model'
import BoardEditor from './BoardEditor'
import { createAutosave, createBoard, emptyScene, findBoards, saveFallback, saveScene } from '../boards'
import type { BoardRecord, BoardScene, SaveStatus } from '../boards'
import type { Board } from '../design-drafts'
import '../board.css'

const STATUS_TEXT: Record<SaveStatus, string> = { saved: 'Saved on this device', pending: 'Unsaved changes…', saving: 'Saving…', error: 'Not saved' }

/** A problem's own whiteboard for tracing arrays, trees and pointers. The board is made on the first stroke. */
export default function Scratchpad({ app, problemId, title }: { app: AppModel; problemId: string; title: string }) {
  const [board, setBoard] = useState<BoardRecord | null>()
  const [boardId, setBoardId] = useState<string>()
  const [error, setError] = useState('')
  const [status, setStatus] = useState<SaveStatus>('saved')
  const making = useRef<Promise<string> | undefined>(undefined)
  const report = useCallback((next: SaveStatus, problem?: string) => { setStatus(next); setError(problem ?? '') }, [])

  useEffect(() => {
    let live = true
    findBoards('scratch', { problemId }).then(([found]) => {
      if (!live) return
      if (found) { making.current = Promise.resolve(found.id); setBoardId(found.id) }
      setBoard(found ?? null)
    }, problem => { if (live) setError(problem instanceof Error ? problem.message : 'The scratchpad could not load.') })
    return () => { live = false }
  }, [problemId])

  const [saves] = useState(() => {
    const ensure = () => making.current ??= createBoard({ kind: 'scratch', problemId, title: `${title} scratchpad` }).then(made => {
      app.createdBoard()
      setBoardId(made.id)
      return made.id
    }, problem => { making.current = undefined; throw problem })
    return {
      scene: createAutosave<BoardScene>(async scene => saveScene(await ensure(), scene), report),
      sketch: createAutosave<Board>(async sketch => saveFallback(await ensure(), sketch), report),
    }
  })
  useEffect(() => {
    const flush = () => { void saves.scene.flush(); void saves.sketch.flush() }
    window.addEventListener('pagehide', flush)
    return () => { window.removeEventListener('pagehide', flush); flush() }
  }, [saves])
  const onChange = useCallback((scene: BoardScene) => saves.scene.schedule(scene), [saves])

  if (board === undefined) return error ? <p className="alert" role="alert">{error}</p> : <p role="status">Loading the scratchpad…</p>
  return <div className="scratchpad-body">
    <div className="scratchpad-meta">
      <p className={status === 'error' ? 'board-save error' : 'board-save'} role="status" data-save={status}>{STATUS_TEXT[status]}{error && `. ${error}`}</p>
      {boardId && <a href={`#board/${boardId}`}>Open full size</a>}
    </div>
    <section className="board-region scratchpad-region" aria-label="Scratchpad drawing area" aria-describedby="scratchpad-alt">
      <p id="scratchpad-alt" className="sr-only">Drawing area. Its content is your own drawing and is not read aloud.</p>
      <BoardEditor initial={board ?? emptyScene()} name={`${title} scratchpad`} onChange={onChange}
        fallback={board?.fallback} onFallbackChange={sketch => saves.sketch.schedule(sketch)} />
    </section>
  </div>
}
