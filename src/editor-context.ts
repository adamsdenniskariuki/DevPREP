import { createContext, useContext } from 'react'
import { defaultEditorPrefs, type EditorPrefs } from './editor-prefs'

export const EditorPrefsContext = createContext<{ prefs: EditorPrefs; setPrefs: (patch: Partial<EditorPrefs>) => void }>({
  prefs: defaultEditorPrefs,
  setPrefs: () => undefined,
})
export const useEditorPrefs = () => useContext(EditorPrefsContext)
