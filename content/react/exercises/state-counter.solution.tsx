import { useState } from 'react'

export function Counter({ step = 1 }: { step?: number }) {
  const [count, setCount] = useState(0)
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(c => c + step)}>Increment</button>
      <button onClick={() => setCount(c => Math.max(0, c - step))}>Decrement</button>
      <button onClick={() => setCount(0)}>Reset</button>
    </div>
  )
}

export default function App() {
  return <Counter step={5} />
}
