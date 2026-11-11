import { useEffect, useState } from 'react'

export function Stopwatch({ intervalMs = 1000 }: { intervalMs?: number }) {
  const [ticks, setTicks] = useState(0)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setTicks(t => t + 1), intervalMs)
    return () => clearInterval(id)
  }, [running, intervalMs])

  return (
    <div>
      <p>Elapsed: <span data-testid="elapsed">{ticks}</span></p>
      <button onClick={() => setRunning(r => !r)}>{running ? 'Stop' : 'Start'}</button>
      <button onClick={() => setTicks(0)}>Reset</button>
    </div>
  )
}

export default function App() {
  return <Stopwatch />
}
