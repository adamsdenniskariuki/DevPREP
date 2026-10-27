import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react'
import type { NavNode } from '../nav-model'
import Icon from './Icon'

interface Row { node: NavNode; level: number; size: number; pos: number; parent?: string; open: boolean; branch: boolean }

function visibleRows(nodes: readonly NavNode[], expanded: ReadonlySet<string>, level = 1, parent?: string): Row[] {
  return nodes.flatMap((node, index) => {
    const branch = !!node.children?.length || !!node.pending
    const open = branch && expanded.has(node.id)
    const row: Row = { node, level, size: nodes.length, pos: index + 1, parent, open, branch }
    return open && node.children ? [row, ...visibleRows(node.children, expanded, level + 1, node.id)] : [row]
  })
}

export interface NavTreeProps {
  nodes: readonly NavNode[]
  label: string
  expanded: ReadonlySet<string>
  setOpen: (ids: readonly string[], open: boolean) => void
  current?: string
  path: ReadonlySet<string>
  /** Called after a link row is activated, e.g. to close the mobile sheet. */
  onNavigate?: () => void
  /** Called when a branch with pending children is opened. */
  onNeedIndex?: () => void
}

/**
 * The ARIA tree pattern on a flat list of rows: roving tabindex, arrows, Home/End, Enter, `*` and type-ahead.
 * Only expanded branches are rendered, so long lists cost nothing until opened.
 */
export default function NavTree({ nodes, label, expanded, setOpen, current, path, onNavigate, onNeedIndex }: NavTreeProps) {
  const rows = visibleRows(nodes, expanded)
  const [focusId, setFocusId] = useState<string>()
  const refs = useRef(new Map<string, HTMLElement>())
  const pendingFocus = useRef(false)
  const typed = useRef({ text: '', at: 0 })
  const active = rows.find(row => row.node.id === focusId) ?? rows.find(row => row.node.id === current) ?? rows.find(row => path.has(row.node.id) && !row.open) ?? rows[0]

  useEffect(() => {
    if (!pendingFocus.current || !active) return
    pendingFocus.current = false
    refs.current.get(active.node.id)?.focus()
  })

  const moveTo = (row: Row | undefined) => {
    if (!row) return
    pendingFocus.current = true
    setFocusId(row.node.id)
  }
  const toggle = (row: Row, open = !row.open) => {
    if (!row.branch || open === row.open) return
    if (open && row.node.pending) onNeedIndex?.()
    setOpen([row.node.id], open)
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!active || event.altKey || event.ctrlKey || event.metaKey) return
    const at = rows.indexOf(active)
    const key = event.key
    let handled = true
    if (key === 'ArrowDown') moveTo(rows[at + 1])
    else if (key === 'ArrowUp') moveTo(rows[at - 1])
    else if (key === 'Home') moveTo(rows[0])
    else if (key === 'End') moveTo(rows[rows.length - 1])
    else if (key === 'ArrowRight') {
      if (active.branch && !active.open) toggle(active, true)
      else if (active.open) moveTo(rows[at + 1]?.parent === active.node.id ? rows[at + 1] : undefined)
    } else if (key === 'ArrowLeft') {
      if (active.open) toggle(active, false)
      else moveTo(rows.find(row => row.node.id === active.parent))
    } else if (key === 'Enter' && !active.node.href) toggle(active)
    else if (key === '*') {
      const siblings = rows.filter(row => row.parent === active.parent && row.branch && !row.open)
      if (siblings.some(row => row.node.pending)) onNeedIndex?.()
      setOpen(siblings.map(row => row.node.id), true)
    } else if (key.length === 1 && key !== ' ') {
      const now = Date.now()
      typed.current = { text: (now - typed.current.at < 500 ? typed.current.text : '') + key.toLowerCase(), at: now }
      const text = typed.current.text
      const order = [...rows.slice(at + (text.length === 1 ? 1 : 0)), ...rows.slice(0, at + (text.length === 1 ? 1 : 0))]
      moveTo(order.find(row => row.node.label.toLowerCase().startsWith(text)))
    } else handled = false
    if (handled) event.preventDefault()
  }

  function onRowClick(event: MouseEvent, row: Row) {
    setFocusId(row.node.id)
    const chevron = (event.target as HTMLElement).closest('.tree-chevron')
    if (chevron || !row.node.href) {
      event.preventDefault()
      toggle(row)
      return
    }
    onNavigate?.()
  }

  return <div role="tree" aria-label={label} className="nav-tree" onKeyDown={onKeyDown}>
    {rows.map(row => {
      const { node } = row
      const isCurrent = node.id === current
      const className = ['nav-item', 'tree-row', isCurrent ? 'active' : '', path.has(node.id) && !isCurrent ? 'in-path' : '', node.done ? 'done' : ''].filter(Boolean).join(' ')
      const props = {
        role: 'treeitem',
        'aria-level': row.level,
        'aria-setsize': row.size,
        'aria-posinset': row.pos,
        'aria-expanded': row.branch ? row.open : undefined,
        'aria-current': isCurrent ? 'page' as const : undefined,
        tabIndex: row === active ? 0 : -1,
        className,
        style: { '--level': row.level } as CSSProperties,
        ref: (element: HTMLElement | null) => { if (element) refs.current.set(node.id, element); else refs.current.delete(node.id) },
        onClick: (event: MouseEvent) => onRowClick(event, row),
        onFocus: () => { if (focusId !== node.id) setFocusId(node.id) },
      }
      const content = <>
        <span className="tree-chevron" aria-hidden="true">{row.branch ? <svg viewBox="0 0 12 12" width="12" height="12"><path d="m4 2 4 4-4 4" /></svg> : null}</span>
        {node.icon && <Icon name={node.icon} size={18} />}
        <span className="tree-label">{node.label}</span>
        {node.done && <span className="sr-only">, done</span>}
        {node.badge ? <><span className="nav-badge" aria-hidden="true">{node.badge}</span><span className="sr-only">, {node.badge} due</span></> : null}
        {node.count && node.count.total > 0 && <span className="tree-count" aria-hidden="true">{node.count.done}/{node.count.total}{row.level <= 2 && <span className="tree-meter"><span style={{ inlineSize: `${Math.round(node.count.done / node.count.total * 100)}%` }} /></span>}</span>}
        {node.done && <span className="tree-check" aria-hidden="true"><Icon name="check" size={14} /></span>}
      </>
      return node.href
        ? <a key={node.id} href={node.href} {...props}>{content}</a>
        : <div key={node.id} {...props}>{content}</div>
    })}
  </div>
}
