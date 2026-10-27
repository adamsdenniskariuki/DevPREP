import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { lessons } from '../curriculum'
import { loadNavData } from '../nav-model'
import { buildPaletteIndex, PAGES, searchPalette } from '../palette-index'
import type { PaletteEntry } from '../palette-index'
import Icon from './Icon'
import '../palette.css'

export const RECENT_KEY = 'devprep.palette.recent.v1'
const MAX_RECENT = 5

function readRecent(): string[] {
  try {
    const saved = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? '[]') as unknown
    return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string').slice(0, MAX_RECENT) : []
  } catch { return [] }
}
function saveRecent(id: string) {
  try { window.localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...readRecent().filter(item => item !== id)].slice(0, MAX_RECENT))) } catch { /* Recents are optional. */ }
}

const optionId = (index: number) => `palette-option-${index}`

/**
 * The command palette: a modal dialog with a combobox that searches every page, problem, pattern,
 * guide, case, company, deck and lesson. Loaded lazily, with the nav index, the first time it opens.
 * `close()` is called once the dialog has closed; focus goes back to whatever had it unless a result navigated.
 */
export default function CommandPalette({ close }: { close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const navigated = useRef(false)
  const opener = useRef(document.activeElement as HTMLElement | null)
  const [entries, setEntries] = useState<PaletteEntry[]>()
  const [failed, setFailed] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const recent = useMemo(readRecent, [])

  useEffect(() => {
    let live = true
    loadNavData().then(data => { if (live) setEntries(buildPaletteIndex(data.index, lessons)) }, () => { if (live) setFailed(true) })
    return () => { live = false }
  }, [])
  useEffect(() => {
    const element = dialog.current
    if (element && !element.open) element.showModal()
    input.current?.focus()
  }, [])

  const groups = useMemo(() => searchPalette(entries ?? PAGES, query, { recent }), [entries, query, recent])
  const flat = groups.flatMap(group => group.items)
  const current = flat.length ? Math.min(active, flat.length - 1) : -1
  const expanded = flat.length > 0
  useEffect(() => {
    if (current >= 0) document.getElementById(optionId(current))?.scrollIntoView({ block: 'nearest' })
  }, [current])

  const choose = (entry: PaletteEntry) => {
    saveRecent(entry.id)
    navigated.current = window.location.hash !== entry.href
    dialog.current?.close()
    if (navigated.current) window.location.hash = entry.href
  }
  const dismiss = () => { navigated.current = false; dialog.current?.close() }

  const onInputKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!flat.length) return
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((current + step + flat.length) % flat.length)
    } else if (event.key === 'Enter' && current >= 0) {
      event.preventDefault()
      choose(flat[current])
    }
  }
  // showModal makes the page inert; this keeps Tab cycling between the field and the close button.
  const trap = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== 'Tab' || !dialog.current) return
    const items = [...dialog.current.querySelectorAll<HTMLElement>('input, button')]
    const first = items[0]
    const last = items[items.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }

  const count = flat.length
  const total = groups.reduce((sum, group) => sum + group.items.length + group.more, 0)
  const status = failed && query ? 'Only pages can be searched right now.'
    : !query.trim() ? ''
      : !count ? `No matches for “${query.trim()}”.`
        : `${total} ${total === 1 ? 'result' : 'results'}${total > count ? `, ${count} shown` : ''}.`
  let index = -1

  return <dialog ref={dialog} className="palette" aria-labelledby="palette-title" onKeyDown={trap} onClose={() => { if (!navigated.current) opener.current?.focus(); close() }}
    onClick={event => { if (event.target === event.currentTarget) dismiss() }}>
    <div className="palette-body">
      <h2 id="palette-title" className="sr-only">Search DevPREP</h2>
      <div className="palette-field">
        <Icon name="search" size={20} />
        <input ref={input} type="text" role="combobox" aria-expanded={expanded} aria-controls={expanded ? 'palette-list' : undefined}
          aria-autocomplete="list" aria-activedescendant={current >= 0 ? optionId(current) : undefined}
          aria-label="Search pages, problems, patterns and more" aria-describedby="palette-hint" placeholder="Search pages, problems, patterns…"
          autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
          value={query} onChange={event => { setQuery(event.target.value); setActive(0) }} onKeyDown={onInputKey} />
        <button type="button" className="icon-button" aria-label="Close search" onClick={dismiss}><Icon name="x" size={18} /></button>
      </div>
      {expanded && <div id="palette-list" role="listbox" aria-label="Results" className="palette-list">
        {groups.map(group => <div key={group.kind} role="group" aria-labelledby={`palette-group-${group.kind}`} className="palette-group">
          <div role="presentation" id={`palette-group-${group.kind}`} className="palette-group-label">{group.label}{group.more > 0 && <span className="palette-more"> · {group.more} more</span>}</div>
          {group.items.map(entry => {
            index++
            const position = index
            return <div key={entry.id} id={optionId(position)} role="option" aria-selected={position === current} className="palette-option"
              onMouseDown={event => event.preventDefault()} onMouseMove={() => { if (position !== current) setActive(position) }} onClick={() => choose(entry)}>
              <span className="palette-option-title">{entry.title}</span>
              {entry.detail && <span className="palette-option-detail">{entry.detail}</span>}
            </div>
          })}
        </div>)}
      </div>}
      <p className="palette-status" role="status">{entries || !query ? status : 'Loading the full index…'}</p>
      <p id="palette-hint" className="palette-hint"><kbd>↑</kbd><kbd>↓</kbd> to move · <kbd>Enter</kbd> to open · <kbd>Esc</kbd> to close</p>
    </div>
  </dialog>
}
