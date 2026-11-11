import { useRef, useState, type Ref } from 'react'

export function SearchBox() {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  // TODO: attach the ref, then focus the input from both buttons.
  return (
    <div>
      <label>Search <input value={query} onChange={e => setQuery(e.target.value)} /></label>
      <button onClick={() => inputRef.current?.focus()}>Focus search</button>
      <button onClick={() => setQuery('')}>Clear</button>
    </div>
  )
}

// TODO: forward `ref` to the input.
export function FancyInput({ label }: { label: string; ref?: Ref<HTMLInputElement> }) {
  return <label>{label} <input className="fancy" /></label>
}

export default function App() {
  return <SearchBox />
}
