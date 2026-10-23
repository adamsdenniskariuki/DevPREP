import type { CodeLanguage } from './problem-types'

export type EditorLanguage = CodeLanguage | 'sql' | 'ts'
export type EditorKind = 'rich' | 'plain'
export interface EditorPrefs {
  /** Rich is CodeMirror; Plain is the textarea editor, also used when CodeMirror fails to load. */
  kind: EditorKind
  /** Interview mode turns off autocomplete and auto-closing brackets, like a plain interview pad. */
  interview: boolean
}
export const defaultEditorPrefs: EditorPrefs = { kind: 'rich', interview: false }

/** One props interface for both editors so they are drop-in interchangeable. */
export interface EditorProps {
  id: string
  lang: EditorLanguage
  value: string
  onChange: (value: string) => void
  describedBy?: string
  /** 1-based line to highlight as executing (for step-through visualisers). */
  activeLine?: number
  readOnly?: boolean
  /** Overrides the saved interview-mode setting for this editor. */
  interview?: boolean
}
