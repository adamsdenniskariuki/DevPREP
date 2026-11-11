import { useState } from 'react'

export type Tab = { label: string; content: string }

// TODO: add roles, aria-selected, aria-controls, tabIndex, hidden panels and arrow keys.
export function Tabs({ label, tabs }: { label: string; tabs: Tab[] }) {
  const [selected, setSelected] = useState(0)
  return (
    <div>
      <div>
        {tabs.map((tab, index) => <div key={tab.label} onClick={() => setSelected(index)}>{tab.label}</div>)}
      </div>
      <div>{tabs[selected].content}</div>
    </div>
  )
}

export default function App() {
  return <Tabs label="Account" tabs={[{ label: 'Profile', content: 'Your profile.' }, { label: 'Billing', content: 'Your invoices.' }, { label: 'Security', content: 'Passwords and keys.' }]} />
}
