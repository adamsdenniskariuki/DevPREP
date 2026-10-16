import { useState } from 'react'
import type { ExtraPractice as Exercise } from '../curriculum-types'
import { inline } from '../inline'

export default function ExtraPractice({ exercise, rich = false }: { exercise: Exercise; rich?: boolean }) {
  const text = (value: string) => rich ? inline(value) : value
  const [hints, setHints] = useState(0)
  return <section className="extra-practice" aria-label={`${exercise.id} exercise`}>
    <h3>{exercise.title}</h3>
    <p className="preserve-lines">{text(exercise.prompt)}</p>
    <p className="helper">Optional exercise. Add labeled notes to the same answer below. This does not create a separate completion or review.</p>
    {hints < exercise.hints.length && <button onClick={() => setHints(hints + 1)}>Show {exercise.id} hint {hints + 1}</button>}
    {exercise.hints.slice(0, hints).map((hint, i) => <div className="callout" key={i}><strong>Hint {i + 1}</strong><p>{text(hint)}</p></div>)}
    <details><summary>{exercise.id === 'warmup' ? 'Warm-up' : 'Stretch'} worked answer & rubric</summary>
      <pre>{exercise.solution}</pre>
      <h3>Check your reasoning</h3>
      <ul>{exercise.checklist.map(item => <li key={item}>{text(item)}</li>)}</ul>
    </details>
  </section>
}
