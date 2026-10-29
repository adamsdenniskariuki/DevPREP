import { describe, expect, it } from 'vitest'
import { decideWhatsNew, LAST_SEEN_VERSION_KEY } from './whats-new'
import { compareVersions, releasesSince } from './versions'

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) } }
}

describe('What’s new', () => {
  it('stays silent on a brand-new install but remembers the version', () => {
    const storage = memory()
    expect(decideWhatsNew('1.8.0', storage)).toEqual({ show: false })
    expect(storage.data.get(LAST_SEEN_VERSION_KEY)).toBe('1.8.0')
  })

  it('shows once per version after an update', () => {
    const storage = memory({ [LAST_SEEN_VERSION_KEY]: '1.6.0' })
    expect(decideWhatsNew('1.8.0', storage)).toEqual({ show: true, since: '1.6.0' })
    expect(storage.data.get(LAST_SEEN_VERSION_KEY)).toBe('1.8.0')
    expect(decideWhatsNew('1.8.0', storage)).toEqual({ show: false })
  })

  it('never shows when storage is unavailable', () => {
    expect(decideWhatsNew('1.8.0', undefined)).toEqual({ show: false })
    const broken = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
    expect(decideWhatsNew('1.8.0', broken)).toEqual({ show: false })
  })

  it('compares versions numerically', () => {
    expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0)
    expect(compareVersions('1.8.0', '1.8.0')).toBe(0)
    expect(compareVersions('0.9.9', '1.0.0')).toBeLessThan(0)
  })

  it('lists every release since the last seen version, up to the running one', () => {
    const releases = ['1.9.0', '1.8.0', '1.7.0', '1.6.0'].map(version => ({ version }))
    expect(releasesSince(releases, '1.8.0', '1.6.0').map(item => item.version)).toEqual(['1.8.0', '1.7.0'])
    expect(releasesSince(releases, '1.8.0', '1.7.0').map(item => item.version)).toEqual(['1.8.0'])
    expect(releasesSince(releases, '1.8.0').map(item => item.version)).toEqual(['1.8.0'])
    // A build without its own entry (or a downgrade) falls back to the newest release it knows.
    expect(releasesSince(releases, '1.8.5', '1.8.0').map(item => item.version)).toEqual(['1.8.0'])
    expect(releasesSince(releases, '0.1.0', '0.0.1').map(item => item.version)).toEqual(['1.9.0'])
  })
})
