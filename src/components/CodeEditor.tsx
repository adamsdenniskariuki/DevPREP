import { useRef, type CSSProperties, type KeyboardEvent } from 'react'
import { MAX_CODE_LENGTH } from '../code-drafts'
import type { EditorLanguage, EditorProps } from '../editor-prefs'

export const INDENT: Record<EditorLanguage, string> = { js: '  ', ts: '  ', py: '    ', sql: '  ' }

function insert(area: HTMLTextAreaElement, text: string, onChange: (value: string) => void) {
  area.focus()
  // execCommand keeps the browser's undo stack; setRangeText is the fallback where it is unsupported.
  if (!document.execCommand?.('insertText', false, text)) {
    area.setRangeText(text, area.selectionStart, area.selectionEnd, 'end')
    onChange(area.value)
  }
}

/**
 * The Plain editor: a textarea with code-friendly keys. Tab indents, Enter keeps indentation.
 * Press Escape first to let Tab move focus out, so keyboard users are never trapped.
 */
export default function CodeEditor({ id, lang, value, onChange, describedBy, activeLine, readOnly }: EditorProps) {
  const escaped = useRef(false)

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (readOnly) return
    const area = event.currentTarget
    if (event.key === 'Escape') { escaped.current = true; return }
    if (event.key === 'Tab' && !escaped.current && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault()
      insert(area, INDENT[lang], onChange)
      return
    }
    if (event.key === 'Enter' && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey && !event.nativeEvent.isComposing) {
      const before = area.value.slice(0, area.selectionStart)
      const line = before.slice(before.lastIndexOf('\n') + 1)
      let indent = /^[ \t]*/.exec(line)?.[0] ?? ''
      if ((lang === 'py' && /:\s*$/.test(line)) || (lang !== 'py' && /[{[(]\s*$/.test(line))) indent += INDENT[lang]
      event.preventDefault()
      insert(area, `\n${indent}`, onChange)
    }
    if (event.key !== 'Shift') escaped.current = false
  }

  // The executing line is a background band that scrolls with the text (background-attachment: local).
  const style = activeLine ? { '--exec-line': activeLine - 1 } as CSSProperties : undefined
  return <textarea
    id={id}
    className={activeLine ? 'code-editor has-exec-line' : 'code-editor'}
    style={style}
    data-active-line={activeLine}
    value={value}
    maxLength={MAX_CODE_LENGTH}
    readOnly={readOnly}
    spellCheck={false}
    autoCapitalize="off"
    autoComplete="off"
    autoCorrect="off"
    wrap="off"
    aria-describedby={describedBy}
    onChange={event => onChange(event.target.value)}
    onFocus={() => { escaped.current = false }}
    onKeyDown={onKeyDown}
  />
}
