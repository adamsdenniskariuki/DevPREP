import { useEffect, useRef } from 'react'
import { Annotation, Compartment, EditorState, Prec, StateEffect, StateField, type Extension } from '@codemirror/state'
import { Decoration, EditorView, highlightActiveLineGutter, keymap, lineNumbers, type DecorationSet } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentLess, indentMore } from '@codemirror/commands'
import { bracketMatching, indentOnInput, indentUnit, syntaxHighlighting } from '@codemirror/language'
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete'
import { classHighlighter } from '@lezer/highlight'
import { MAX_CODE_LENGTH } from '../code-drafts'
import type { EditorLanguage, EditorProps } from '../editor-prefs'
import { INDENT } from './CodeEditor'
import './rich-editor.css'

const external = Annotation.define<boolean>()
const setExecLine = StateEffect.define<number | undefined>()
const execLine = Decoration.line({ class: 'cm-exec-line' })

/** Highlights the line a step-through visualiser is executing. Lines are 1-based. */
const execField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, transaction) {
    let next = decorations.map(transaction.changes)
    for (const effect of transaction.effects) {
      if (!effect.is(setExecLine)) continue
      const line = effect.value
      next = line && line >= 1 && line <= transaction.state.doc.lines
        ? Decoration.set([execLine.range(transaction.state.doc.line(line).from)])
        : Decoration.none
    }
    return next
  },
  provide: field => EditorView.decorations.from(field),
})

/** Each language pack is its own chunk, so a Python problem never downloads the SQL grammar. */
async function language(lang: EditorLanguage): Promise<Extension> {
  if (lang === 'py') return (await import('@codemirror/lang-python')).python()
  if (lang === 'sql') {
    const { PostgreSQL, sql } = await import('@codemirror/lang-sql')
    return sql({ dialect: PostgreSQL, upperCaseKeywords: true })
  }
  return (await import('@codemirror/lang-javascript')).javascript({ typescript: lang === 'ts' })
}

/** Tab indents; Escape then Tab leaves the editor (no time limit), matching the Plain editor. */
function escapeThenTab(): Extension {
  let escaped = false
  return Prec.highest(EditorView.domEventHandlers({
    keydown(event) {
      if (event.key === 'Escape') { escaped = true; return false }
      if (event.key === 'Tab' && escaped && !event.altKey && !event.ctrlKey && !event.metaKey) {
        escaped = false
        return true // Handled here without preventDefault, so the browser moves focus.
      }
      if (event.key !== 'Shift') escaped = false
      return false
    },
    focus() { escaped = false; return false },
  }))
}

const theme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--cp-bg-elevated)',
    color: 'var(--cp-text)',
    border: '1px solid var(--cp-border-strong)',
    borderRadius: '.625rem',
    fontSize: '14px',
    minHeight: '340px',
    maxHeight: '70vh',
  },
  '&.cm-focused': { outline: '2px solid var(--cp-accent)', outlineOffset: '2px' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.6', overflow: 'auto' },
  '.cm-content': { padding: '12px 0', caretColor: 'var(--cp-text)' },
  '.cm-content:focus-visible': { outline: 'none' },
  '.cm-line': { padding: '0 12px 0 8px' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--cp-text)', borderLeftWidth: '2px' },
  '.cm-gutters': {
    backgroundColor: 'var(--cp-bg-elevated)',
    color: 'var(--cp-text-muted)',
    borderRight: '1px solid var(--cp-border)',
    borderRadius: '.625rem 0 0 .625rem',
  },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--cp-text)', fontWeight: '700' },
  '.cm-exec-line': { backgroundColor: 'var(--cp-accent-soft)', boxShadow: 'inset 3px 0 0 var(--cp-accent)' },
  '&.cm-focused .cm-matchingBracket': { backgroundColor: 'var(--cp-accent-soft)', outline: '1px solid var(--cp-border-strong)' },
  '&.cm-focused .cm-nonmatchingBracket': { backgroundColor: 'transparent', outline: '1px solid var(--cp-danger)' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': { backgroundColor: 'var(--cp-accent-soft)' },
  '.cm-tooltip': { backgroundColor: 'var(--cp-surface)', color: 'var(--cp-text)', border: '1px solid var(--cp-border-strong)', borderRadius: '8px' },
  '.cm-tooltip-autocomplete > ul': { fontFamily: 'var(--font-mono)', maxHeight: '12em' },
  '.cm-tooltip-autocomplete > ul > li': { padding: '4px 8px', minHeight: '24px' },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: 'var(--cp-accent)', color: 'var(--cp-accent-fg)' },
  '.cm-completionDetail': { color: 'inherit', opacity: '1', fontStyle: 'normal' },
})

function assist(interview: boolean): Extension {
  return interview ? [] : [closeBrackets(), autocompletion(), keymap.of([...closeBracketsKeymap, ...completionKeymap])]
}

function attributes(id: string, labelledBy: string | undefined, describedBy: string | undefined, readOnly: boolean): Extension {
  return EditorView.contentAttributes.of({
    id,
    ...(labelledBy ? { 'aria-labelledby': labelledBy } : {}),
    ...(describedBy ? { 'aria-describedby': describedBy } : {}),
    ...(readOnly ? { 'aria-readonly': 'true' } : {}),
    'data-editor': 'rich',
  })
}

/** The Rich editor (CodeMirror 6). Loaded lazily by Editor; shares EditorProps with the Plain editor. */
export default function RichEditor({ id, lang, value, onChange, describedBy, activeLine, readOnly = false, interview = false }: EditorProps) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView>(null)
  const change = useRef(onChange)
  change.current = onChange
  const compartments = useRef({ assist: new Compartment(), attrs: new Compartment(), readOnly: new Compartment(), language: new Compartment() })
  const labelledBy = useRef<string>(undefined)

  useEffect(() => {
    // The surrounding <label for> cannot name a contenteditable, so point aria-labelledby at it instead.
    const label = document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(id)}"]`)
    if (label && !label.id) label.id = `${id}-label`
    labelledBy.current = label?.id
    const { assist: assistSlot, attrs, readOnly: readOnlySlot, language: languageSlot } = compartments.current
    const created = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          history(),
          indentOnInput(),
          bracketMatching(),
          indentUnit.of(INDENT[lang]),
          EditorState.tabSize.of(4),
          languageSlot.of([]),
          syntaxHighlighting(classHighlighter),
          execField,
          escapeThenTab(),
          assistSlot.of(assist(interview)),
          attrs.of(attributes(id, labelledBy.current, describedBy, readOnly)),
          readOnlySlot.of(EditorState.readOnly.of(readOnly)),
          keymap.of([{ key: 'Tab', run: indentMore, shift: indentLess }, ...defaultKeymap, ...historyKeymap]),
          EditorState.transactionFilter.of(tr => tr.docChanged && tr.newDoc.length > MAX_CODE_LENGTH ? [] : tr),
          EditorView.updateListener.of(update => {
            if (update.docChanged && !update.transactions.some(tr => tr.annotation(external))) change.current(update.state.doc.toString())
          }),
          theme,
        ],
      }),
    })
    view.current = created
    let live = true
    // Highlighting and completions arrive with the language chunk; editing works immediately.
    language(lang).then(extension => { if (live) created.dispatch({ effects: languageSlot.reconfigure(extension) }) }, () => undefined)
    const focus = () => created.focus()
    label?.addEventListener('click', focus)
    return () => { live = false; label?.removeEventListener('click', focus); created.destroy(); view.current = null }
    // The editor is recreated per id and language; other props are synced below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, lang])

  useEffect(() => {
    const current = view.current
    if (current && value !== current.state.doc.toString()) {
      current.dispatch({ changes: { from: 0, to: current.state.doc.length, insert: value }, annotations: external.of(true) })
    }
  }, [value])

  useEffect(() => {
    const { assist: assistSlot, attrs, readOnly: readOnlySlot } = compartments.current
    view.current?.dispatch({ effects: [
      assistSlot.reconfigure(assist(interview)),
      attrs.reconfigure(attributes(id, labelledBy.current, describedBy, readOnly)),
      readOnlySlot.reconfigure(EditorState.readOnly.of(readOnly)),
    ] })
  }, [interview, describedBy, readOnly, id])

  useEffect(() => {
    const current = view.current
    if (!current) return
    const effects: StateEffect<unknown>[] = [setExecLine.of(activeLine)]
    if (activeLine && activeLine >= 1 && activeLine <= current.state.doc.lines) {
      effects.push(EditorView.scrollIntoView(current.state.doc.line(activeLine).from, { y: 'nearest' }))
    }
    current.dispatch({ effects })
  }, [activeLine])

  return <div ref={host} className="rich-editor" data-lang={lang} data-active-line={activeLine} />
}
