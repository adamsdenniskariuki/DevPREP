import type { StoragePort } from './progress'

export const APPEARANCE_KEY = 'devprep.appearance.v1'
/** Set once the welcome tour is finished or skipped. */
export const TOUR_KEY = 'devprep.tour.v1'

export const modes = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
] as const
export const palettes = [
  { id: 'blueprint', label: 'Blueprint' },
  { id: 'paper', label: 'Paper (classic)' },
  { id: 'sepia', label: 'Sepia' },
  { id: 'contrast', label: 'High contrast' },
] as const
export const fonts = [
  { id: 'atkinson', label: 'Atkinson Hyperlegible' },
  { id: 'inter', label: 'Inter' },
  { id: 'serif', label: 'Source Serif' },
  { id: 'dyslexic', label: 'OpenDyslexic' },
  { id: 'system', label: 'System font' },
] as const

export type ThemeMode = typeof modes[number]['id']
export type Palette = typeof palettes[number]['id']
export type Font = typeof fonts[number]['id']
export interface Appearance { mode: ThemeMode; palette: Palette; font: Font }

export const defaultAppearance: Appearance = { mode: 'system', palette: 'blueprint', font: 'atkinson' }

const isMode = (value: unknown): value is ThemeMode => modes.some(item => item.id === value)
const isPalette = (value: unknown): value is Palette => palettes.some(item => item.id === value)
const isFont = (value: unknown): value is Font => fonts.some(item => item.id === value)

/** Unknown or damaged fields fall back individually so one bad value never hides the others. */
export function parseAppearance(raw: string | null): Appearance {
  if (raw === null) return { ...defaultAppearance }
  let value: unknown
  try { value = JSON.parse(raw) } catch { return { ...defaultAppearance } }
  const record = typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}
  return {
    mode: isMode(record.mode) ? record.mode : defaultAppearance.mode,
    palette: isPalette(record.palette) ? record.palette : defaultAppearance.palette,
    font: isFont(record.font) ? record.font : defaultAppearance.font,
  }
}

export function writeAppearance(storage: StoragePort, appearance: Appearance): void {
  storage.setItem(APPEARANCE_KEY, JSON.stringify(parseAppearance(JSON.stringify(appearance))))
}

/** An explicit ?scoutTheme= link wins, then the saved mode, then the operating system. */
export function resolveTheme(mode: ThemeMode, param: string | null, systemDark: boolean): 'light' | 'dark' {
  if (param === 'light' || param === 'dark') return param
  if (mode === 'light' || mode === 'dark') return mode
  return systemDark ? 'dark' : 'light'
}
