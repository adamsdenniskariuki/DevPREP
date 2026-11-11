import { useId, useRef, useState, type KeyboardEvent } from 'react'

export type Tab = { label: string; content: string }

export function Tabs({ label, tabs }: { label: string; tabs: Tab[] }) {
  const [selected, setSelected] = useState(0)
  const id = useId()
  const buttons = useRef<(HTMLButtonElement | null)[]>([])

  function move(event: KeyboardEvent, index: number) {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    event.preventDefault()
    const next = (index + step + tabs.length) % tabs.length
    setSelected(next)
    buttons.current[next]?.focus()
  }

  return (
    <div>
      <div role="tablist" aria-label={label}>
        {tabs.map((tab, index) => (
          <button
            key={tab.label}
            ref={element => { buttons.current[index] = element }}
            role="tab"
            id={`${id}-tab-${index}`}
            aria-selected={index === selected}
            aria-controls={`${id}-panel-${index}`}
            tabIndex={index === selected ? 0 : -1}
            onClick={() => setSelected(index)}
            onKeyDown={event => move(event, index)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab, index) => (
        <div key={tab.label} role="tabpanel" id={`${id}-panel-${index}`} aria-labelledby={`${id}-tab-${index}`} hidden={index !== selected}>
          {tab.content}
        </div>
      ))}
    </div>
  )
}

export default function App() {
  return <Tabs label="Account" tabs={[{ label: 'Profile', content: 'Your profile.' }, { label: 'Billing', content: 'Your invoices.' }, { label: 'Security', content: 'Passwords and keys.' }]} />
}
