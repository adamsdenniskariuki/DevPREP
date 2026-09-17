import type { StoragePort } from './progress'

export const ACCENT_KEY = 'devprep.accent.v1'
export const accents = [
  { id: 'red', label: 'Red (rose)' },
  { id: 'blue', label: 'Blue' },
  { id: 'forest', label: 'Forest green' },
  { id: 'purple', label: 'Purple' },
] as const
export type Accent = typeof accents[number]['id']

export function parseAccent(value: string | null): Accent {
  if (value === null) return 'red'
  if (value === 'red' || value === 'blue' || value === 'forest' || value === 'purple') return value
  throw new Error('The saved accent preference is not recognized.')
}

export function writeAccent(storage: StoragePort, accent: Accent): void {
  storage.setItem(ACCENT_KEY, parseAccent(accent))
}
