import { useState } from 'react'

const FRUITS = ['Apple', 'Banana', 'Cherry']

type RowProps = { name: string; onSelect: (name: string) => void; onRowRender?: (name: string) => void }

// TODO: memoise Row.
export function Row({ name, onSelect, onRowRender }: RowProps) {
  onRowRender?.(name)
  return <li><button onClick={() => onSelect(name)}>Select {name}</button></li>
}

export function FruitPicker({ onRowRender }: { onRowRender?: (name: string) => void }) {
  const [clicks, setClicks] = useState(0)
  const [selected, setSelected] = useState('')
  // TODO: this callback changes on every render.
  const select = (name: string) => setSelected(name)
  return (
    <div>
      <button onClick={() => setClicks(c => c + 1)}>Clicked {clicks}</button>
      <p>Selected: {selected || 'none'}</p>
      <ul>{FRUITS.map(name => <Row key={name} name={name} onSelect={select} onRowRender={onRowRender} />)}</ul>
    </div>
  )
}

export default function App() {
  return <FruitPicker onRowRender={name => console.log('render row', name)} />
}
