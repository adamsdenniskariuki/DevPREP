import { useState } from 'react'

export function Counter({ step = 1 }: { step?: number }) {
  const [count, setCount] = useState(0)
  // TODO: add `step`, never go below 0, and make Reset work.
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
      <button onClick={() => setCount(count - 1)}>Decrement</button>
      <button>Reset</button>
    </div>
  )
}

export default function App() {
  return <Counter step={5} />
}
