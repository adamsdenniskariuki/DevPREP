import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { GroupId, NavNode } from '../nav-model'
import type { NavTreeProps } from './NavTree'
import NavTree from './NavTree'
import Icon from './Icon'

type Props = Omit<NavTreeProps, 'nodes' | 'label' | 'onNavigate'> & { tree: readonly NavNode[]; group?: GroupId }

const FOCUSABLE = 'a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), [tabindex="0"]'

/** Phones and tablets: a bottom bar of the five groups. Each opens its sub-tree in a modal sheet. */
export default function MobileNav({ tree, group, ...treeProps }: Props) {
  const [open, setOpen] = useState<string>()
  const dialog = useRef<HTMLDialogElement>(null)
  const opener = useRef<HTMLButtonElement | null>(null)
  const navigated = useRef(false)
  const node = tree.find(item => item.id === open)

  useEffect(() => {
    const element = dialog.current
    if (!open || !element || element.open) return
    element.showModal()
    const start = element.querySelector<HTMLElement>('.nav-tree [tabindex="0"]') ?? element.querySelector<HTMLElement>(FOCUSABLE)
    start?.focus()
  }, [open])

  const close = (viaLink: boolean) => {
    navigated.current = viaLink
    dialog.current?.close()
  }
  const onClose = () => {
    setOpen(undefined)
    if (!navigated.current) opener.current?.focus()
    navigated.current = false
  }
  // showModal makes the page inert; this keeps Tab inside the sheet instead of escaping to the browser.
  const trap = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== 'Tab' || !dialog.current) return
    const items = [...dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(item => item.offsetParent !== null)
    const first = items[0]
    const last = items[items.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }

  return <>
    <nav className="bottom-bar" aria-label="Sections">
      {tree.map(item => <button key={item.id} type="button" className={item.id === group ? 'nav-item active' : 'nav-item'} aria-haspopup="dialog" aria-expanded={open === item.id}
        aria-label={[item.label, item.id === group ? 'current section' : '', item.badge ? `${item.badge} due` : ''].filter(Boolean).join(', ')}
        onClick={event => { opener.current = event.currentTarget; setOpen(item.id) }}>
        {item.icon && <Icon name={item.icon} />}<span>{item.label}</span>
        {item.badge ? <span className="nav-badge" aria-hidden="true">{item.badge}</span> : null}
      </button>)}
    </nav>
    {node && <dialog ref={dialog} className="nav-sheet" aria-labelledby="nav-sheet-title" onClose={onClose} onKeyDown={trap}
      onClick={event => { if (event.target === event.currentTarget) close(false) }}>
      <div className="nav-sheet-body">
        <header className="nav-sheet-head">
          <h2 id="nav-sheet-title">{node.label}</h2>
          {node.href && <a className="text-button" href={node.href} onClick={() => close(true)}>{node.label} hub</a>}
          <button type="button" className="icon-button" aria-label="Close" onClick={() => close(false)}><Icon name="x" size={18} /></button>
        </header>
        <NavTree {...treeProps} nodes={node.children ?? []} label={node.label} onNavigate={() => close(true)} />
      </div>
    </dialog>}
  </>
}
