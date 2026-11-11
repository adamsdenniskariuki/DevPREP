import { useState } from 'react'

// TODO: only return `value` once it has been stable for `delayMs`.
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  return value
}

export function SearchPreview({ delayMs = 400 }: { delayMs?: number }) {
  const [query, setQuery] = useState('')
  const debounced = useDebouncedValue(query, delayMs)
  return (
    <div>
      <label>Search <input value={query} onChange={e => setQuery(e.target.value)} /></label>
      <p>Searching for: {debounced}</p>
    </div>
  )
}

export default function App() {
  return <SearchPreview />
}
