import { useEffect, useState } from 'react'

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])
  return debounced
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
