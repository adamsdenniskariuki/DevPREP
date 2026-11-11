import { useRef, useState, type Ref } from 'react'

export function SearchBox() {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  function clear() {
    setQuery('')
    inputRef.current?.focus()
  }
  return (
    <div>
      <label>Search <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} /></label>
      <button onClick={() => inputRef.current?.focus()}>Focus search</button>
      <button onClick={clear}>Clear</button>
    </div>
  )
}

export function FancyInput({ label, ref }: { label: string; ref?: Ref<HTMLInputElement> }) {
  return <label>{label} <input ref={ref} className="fancy" /></label>
}

export default function App() {
  return <SearchBox />
}
