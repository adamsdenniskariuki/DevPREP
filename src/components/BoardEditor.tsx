import { useEffect, useState, type ComponentType } from 'react'
import Whiteboard from './Whiteboard'
import { emptyBoard } from '../design-drafts'
import type { Board } from '../design-drafts'
import type { BoardCanvasProps } from './BoardCanvas'
import { setExcalidrawAssetPath } from './board-assets'

type Canvas = ComponentType<BoardCanvasProps>
let request: Promise<Canvas> | undefined
let canvas: Canvas | undefined
let failed = false

/** Excalidraw is fetched only when a board first opens, then precached for offline use. */
export function loadBoardCanvas(): Promise<Canvas> {
  setExcalidrawAssetPath()
  request ??= import('./BoardCanvas').then(module => (canvas = module.default), error => { failed = true; throw error })
  return request
}

export interface BoardEditorProps extends BoardCanvasProps {
  fallback?: Board
  onFallbackChange: (board: Board) => void
  /** Told once whether the drawing tool loaded. */
  onMode?: (mode: 'canvas' | 'fallback') => void
}

/** Shows the Excalidraw canvas, or the simple whiteboard if its chunk can't load. */
export default function BoardEditor({ fallback, onFallbackChange, onMode, ...props }: BoardEditorProps) {
  const [, rerender] = useState(0)
  const [sketch, setSketch] = useState<Board>(() => fallback ?? emptyBoard())
  useEffect(() => {
    if (canvas || failed) return
    let live = true
    loadBoardCanvas().then(() => { if (live) rerender(n => n + 1) }, () => { if (live) rerender(n => n + 1) })
    return () => { live = false }
  }, [])
  const mode = failed ? 'fallback' : canvas ? 'canvas' : undefined
  useEffect(() => { if (mode) onMode?.(mode) }, [mode, onMode])

  if (failed) return <>
    <p className="helper editor-fallback" role="note">The drawing tool couldn’t load, so this is the simple whiteboard. It saves separately from the drawing.</p>
    <Whiteboard title="Simple whiteboard" board={sketch} onChange={next => { setSketch(next); onFallbackChange(next) }} />
  </>
  if (!canvas) return <p className="board-loading" role="status">Loading the drawing tool…</p>
  const Loaded = canvas
  return <Loaded {...props} />
}
