import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import { ACCENT_KEY, accents, parseAccent, writeAccent } from './accent-preference'
import { color, contrast, over } from '../tests/contrast'

const initialization = readFileSync(new URL('../index.html', import.meta.url), 'utf8').match(/<script>([\s\S]*?)<\/script>/)![1]

function initialize(saved: string | null, search = '', systemDark = false, denied = false) {
  const dataset: Record<string, string> = {}
  const setItem = vi.fn()
  runInNewContext(initialization, {
    URLSearchParams,
    window: {
      location: { search },
      matchMedia: () => ({ matches: systemDark }),
      localStorage: {
        getItem: (key: string) => {
          expect(key).toBe(ACCENT_KEY)
          if (denied) throw new Error('Access denied')
          return saved
        },
        setItem,
      },
    },
    document: { documentElement: { dataset, setAttribute: (name: string, value: string) => { dataset[name.slice(5)] = value } } },
  })
  expect(setItem).not.toHaveBeenCalled()
  return dataset
}

describe('accent preference', () => {
  it('provides exactly the four approved, visibly named colors', () => {
    expect(accents.map(accent => accent.id)).toEqual(['red', 'blue', 'forest', 'purple'])
    expect(accents.map(accent => accent.label)).toEqual(['Red (rose)', 'Blue', 'Forest green', 'Purple'])
    expect(parseAccent(null)).toBe('purple')
  })

  it.each(accents)('validates and writes only the $id preference key', ({ id }) => {
    const data = new Map([['devprep.progress.v1', 'untouched study data']])
    writeAccent({ getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value) } }, id)
    expect(data.get(ACCENT_KEY)).toBe(id)
    expect(data.get('devprep.progress.v1')).toBe('untouched study data')
    expect(data.size).toBe(2)
  })

  it.each(['', 'amber', 'slate', 'green', 'BLUE', '{}', 'null', '<script>'])('rejects unknown preference %s', value => {
    expect(() => parseAccent(value)).toThrow('not recognized')
  })

  it('surfaces a write failure without clearing any stored data', () => {
    const setItem = vi.fn(() => { throw new Error('Quota exceeded') })
    expect(() => writeAccent({ getItem: () => 'blue', setItem }, 'purple')).toThrow('Quota exceeded')
    expect(setItem).toHaveBeenCalledExactlyOnceWith(ACCENT_KEY, 'purple')
  })
})

describe('pre-paint appearance initialization', () => {
  it.each(accents)('loads $id before React in both theme modes', ({ id }) => {
    expect(initialize(id, '?scoutTheme=light', true)).toEqual({ theme: 'light', accent: id })
    expect(initialize(id, '?scoutTheme=dark', false)).toEqual({ theme: 'dark', accent: id })
  })

  describe('contrast calculation reference cases', () => {
    it('uses WCAG sRGB luminance and composites translucent layers before measuring', () => {
      expect(contrast(color('#ffffff'), color('#000000'))).toBe(21)
      expect(contrast(color('#777777'), color('#ffffff'))).toBeCloseTo(4.478, 3)
      expect(contrast(color('#205ba9'), color('#205ba9'))).toBe(1)
      expect(over(color('rgba(255, 0, 0, 0.5)'), color('#ffffff'))).toEqual([255, 127.5, 127.5, 1])
      expect(() => color('not-a-color')).toThrow('Unsupported color')
    })
  })

  it('defaults missing users to purple without writing a preference', () => {
    expect(initialize(null)).toEqual({ theme: 'light', accent: 'purple' })
  })

  it('keeps system detection independent of the saved accent and ignores invalid theme overrides', () => {
    expect(initialize('forest', '', true)).toEqual({ theme: 'dark', accent: 'forest' })
    expect(initialize('purple', '?scoutTheme=invalid', false)).toEqual({ theme: 'light', accent: 'purple' })
  })

  it('records invalid/unreadable preferences for a visible React error rather than silently deleting them', () => {
    expect(initialize('amber')).toEqual({ theme: 'light', accent: 'purple', accentError: 'invalid' })
    expect(initialize(null, '?scoutTheme=light', true, true)).toEqual({ theme: 'light', accent: 'purple', accentError: 'unavailable' })
  })
})
