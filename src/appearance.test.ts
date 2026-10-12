import { describe, expect, it } from 'vitest'
import { defaultAppearance, parseAppearance, resolveTheme } from './appearance'

describe('appearance', () => {
  it('falls back per field', () => {
    expect(parseAppearance(null)).toEqual(defaultAppearance)
    expect(parseAppearance('not json')).toEqual(defaultAppearance)
    expect(parseAppearance(JSON.stringify({ mode: 'dark', palette: 'nope', font: 'dyslexic' })))
      .toEqual({ ...defaultAppearance, mode: 'dark', font: 'dyslexic' })
  })
  it('resolves the theme: URL param, then saved mode, then system', () => {
    expect(resolveTheme('system', null, true)).toBe('dark')
    expect(resolveTheme('light', null, true)).toBe('light')
    expect(resolveTheme('light', 'dark', false)).toBe('dark')
    expect(resolveTheme('dark', 'invalid', false)).toBe('dark')
  })
})
