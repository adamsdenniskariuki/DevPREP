import { useRef, type KeyboardEvent } from 'react'
import type { CodeLanguage } from '../problem-types'
import { MAX_CODE_LENGTH } from '../code-drafts'

const INDENT: Record<CodeLanguage, string> = { js: '  ', py: '    ' }

function insert(area: HTMLTextAreaElement, text: string, onChange: (value: string) => void) {
  area.focus()
  // execCommand keeps the browser's undo stack; setRangeText is the fallback where it is unsupported.
  if (!document.execCommand?.('insertText', false, text)) {
    area.setRangeText(text, area.selectionStart, area.selectionEnd, 'end')
    onChange(area.value)
  }
}

/**
 * A plain textarea with code-friendly keys: Tab indents, Enter keeps indentation.
 * Press Escape first to let Tab move focus out, so keyboard users are never trapped.
 */
export default function CodeEditor({ id, lang, value, onChange, describedBy }: {
  id: string
  lang: CodeLanguage
  value: string
  onChange: (value: string) => void
  describedBy?: string
}) {
  const escaped = useRef(false)

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
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
      if ((lang === 'py' && /:\s*$/.test(line)) || (lang === 'js' && /[{[(]\s*$/.test(line))) indent += INDENT[lang]
      event.preventDefault()
      insert(area, `\n${indent}`, onChange)
    }
    if (event.key !== 'Shift') escaped.current = false
  }

  return <textarea
    id={id}
    className="code-editor"
    value={value}
    maxLength={MAX_CODE_LENGTH}
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
