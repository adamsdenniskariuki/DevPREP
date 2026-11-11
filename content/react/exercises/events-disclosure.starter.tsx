import { useState, type ReactNode } from 'react'

type DisclosureProps = { title: string; children: ReactNode; defaultOpen?: boolean; onToggle?: (open: boolean) => void }

// TODO: toggle on click, set aria-expanded/aria-controls, hide the panel when closed and call onToggle.
export function Disclosure({ title, children, defaultOpen = false }: DisclosureProps) {
  const [open] = useState(defaultOpen)
  return (
    <div>
      <button>{title}</button>
      <div>{children}</div>
    </div>
  )
}

export default function App() {
  return <Disclosure title="Shipping details">Ships in 2 days.</Disclosure>
}
