import { useEffect, useState } from 'react'

export function Stopwatch({ intervalMs = 1000 }: { intervalMs?: number }) {
  const [ticks, setTicks] = useState(0)
  const [running, setRunning] = useState(false)

  // TODO: this reads a stale `ticks`, never cleans up and ignores `running`.
  useEffect(() => {
    if (!running) return
    setInterval(() => setTicks(ticks + 1), intervalMs)
  }, [running])

  return (
    <div>
      <p>Elapsed: <span data-testid="elapsed">{ticks}</span></p>
      <button onClick={() => setRunning(!running)}>{running ? 'Stop' : 'Start'}</button>
      <button onClick={() => setTicks(0)}>Reset</button>
    </div>
  )
}

export default function App() {
  return <Stopwatch />
}
