import { useId, useState, type ReactNode } from 'react'

type DisclosureProps = { title: string; children: ReactNode; defaultOpen?: boolean; onToggle?: (open: boolean) => void }

export function Disclosure({ title, children, defaultOpen = false, onToggle }: DisclosureProps) {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = useId()
  function toggle() {
    const next = !open
    setOpen(next)
    onToggle?.(next)
  }
  return (
    <div>
      <button aria-expanded={open} aria-controls={panelId} onClick={toggle}>{title}</button>
      <div id={panelId} hidden={!open}>{children}</div>
    </div>
  )
}

export default function App() {
  return <Disclosure title="Shipping details">Ships in 2 days.</Disclosure>
}
