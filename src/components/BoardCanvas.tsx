import { useEffect, useRef, useState } from 'react'
import { Excalidraw, exportToBlob, getSceneVersion } from '@excalidraw/excalidraw'
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI, LibraryItems } from '@excalidraw/excalidraw/types'
import '@excalidraw/excalidraw/index.css'
import { stencilLibrary } from '../board-library'
import type { SceneElement } from '../board-elements'
import type { BoardAppState, BoardFile, BoardScene } from '../boards'
import { setExcalidrawAssetPath } from './board-assets'

setExcalidrawAssetPath()

export interface CanvasHandle {
  scene: () => BoardScene
  png: () => Promise<Blob>
}

export interface BoardCanvasProps {
  initial: BoardScene
  name: string
  onChange: (scene: BoardScene) => void
  onReady?: (handle: CanvasHandle) => void
}

type Theme = 'light' | 'dark'
const docTheme = (): Theme => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'

/** Follows the app's resolved light/dark theme, however it changes. */
function useDocumentTheme(): Theme {
  const [theme, setTheme] = useState(docTheme)
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(docTheme()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])
  return theme
}

function sceneFrom(elements: readonly unknown[], appState: AppState, files: BinaryFiles): BoardScene {
  const live = (elements as SceneElement[]).filter(element => !element.isDeleted)
  const used = new Set(live.map(element => element.fileId).filter((id): id is string => typeof id === 'string'))
  const kept: Record<string, BoardFile> = {}
  for (const [id, file] of Object.entries(files)) {
    if (used.has(id)) kept[id] = { id, mimeType: file.mimeType, dataURL: file.dataURL, created: file.created, ...file.lastRetrieved ? { lastRetrieved: file.lastRetrieved } : {} }
  }
  const state: BoardAppState = {
    viewBackgroundColor: appState.viewBackgroundColor, gridModeEnabled: appState.gridModeEnabled,
    scrollX: appState.scrollX, scrollY: appState.scrollY, zoom: appState.zoom.value,
  }
  return { elements: JSON.parse(JSON.stringify(live)) as SceneElement[], appState: state, files: kept }
}

/** The Excalidraw canvas. Lives in its own lazy chunk with its CSS, fonts and stencils. */
export default function BoardCanvas({ initial, name, onChange, onReady }: BoardCanvasProps) {
  const theme = useDocumentTheme()
  const api = useRef<ExcalidrawImperativeAPI | null>(null)
  const last = useRef(`${getSceneVersion(initial.elements as never)}:${Object.keys(initial.files).length}`)
  const change = useRef(onChange)
  change.current = onChange
  const [initialData] = useState(() => ({
    elements: initial.elements as never,
    appState: { ...initial.appState, zoom: initial.appState.zoom ? { value: initial.appState.zoom } : undefined } as never,
    files: initial.files as unknown as BinaryFiles,
    libraryItems: stencilLibrary() as unknown as LibraryItems,
  }))

  return <div className="board-canvas" data-testid="excalidraw-canvas">
    <Excalidraw
      initialData={initialData}
      theme={theme}
      name={name}
      excalidrawAPI={instance => {
        api.current = instance
        onReady?.({
          scene: () => sceneFrom(instance.getSceneElementsIncludingDeleted(), instance.getAppState(), instance.getFiles()),
          png: () => exportToBlob({
            elements: instance.getSceneElements(),
            appState: { ...instance.getAppState(), exportBackground: true, exportWithDarkMode: false },
            files: instance.getFiles(),
            mimeType: 'image/png',
          }),
        })
      }}
      onChange={(elements, appState, files) => {
        const key = `${getSceneVersion(elements)}:${Object.keys(files).length}`
        if (last.current === key) return
        last.current = key
        change.current(sceneFrom(elements, appState, files))
      }}
      UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, export: false, saveAsImage: false, toggleTheme: null } }}
    />
  </div>
}
