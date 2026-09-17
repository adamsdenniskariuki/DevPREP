import { accents } from './accent-preference'
import type { Accent } from './accent-preference'

export default function AccentPicker({ accent, onChange }: { accent: Accent; onChange: (value: string) => void }) {
  return <div className="accent-picker">
    <label htmlFor="accent-choice">Accent</label>
    <span className="accent-swatch" aria-hidden="true" />
    <select id="accent-choice" value={accent} onChange={event => onChange(event.target.value)}>
      {accents.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
    </select>
  </div>
}
