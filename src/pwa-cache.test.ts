import { describe, expect, it } from 'vitest'
import { appDocument, cachePrefix, precacheEntries, sha256 } from './pwa-cache'

const hash = 'a'.repeat(64)

describe('offline scope boundaries', () => {
  it('keeps caches distinct by exact origin and mount', () => {
    const scopes = ['https://example.com/', 'https://example.com/DevPREP/', 'https://other.example/']
    expect(new Set(scopes.map(cachePrefix)).size).toBe(3)
    expect(cachePrefix(scopes[0])).not.toBe(cachePrefix(scopes[1]))
  })

  it.each(['https://example.com/', 'https://example.com/DevPREP/'])('recognizes only the app documents in %s', scope => {
    expect(appDocument(`${scope}?scoutTheme=dark#study`, scope)).toBe(true)
    expect(appDocument(`${scope}index.html#roadmap`, scope)).toBe(true)
    expect(appDocument(`${scope}unrelated-page`, scope)).toBe(false)
    expect(appDocument('https://other.example/', scope)).toBe(false)
  })

  it('resolves the same offline build relative to both deployment mounts', () => {
    const entries = [{ url: 'index.html', revision: hash }, { url: 'assets/curriculum-abcd.js', revision: hash }]
    expect(precacheEntries(entries, 'https://example.com/DevPREP/').map(entry => entry.url)).toEqual([
      'https://example.com/DevPREP/index.html', 'https://example.com/DevPREP/assets/curriculum-abcd.js',
    ])
    expect(precacheEntries(entries, 'https://example.com/')[1].url).toBe('https://example.com/assets/curriculum-abcd.js')
  })

  it.each([
    { url: 'https://outside.example/a.js', revision: hash },
    { url: '../other-app.js', revision: hash },
    { url: '/root-only.js', revision: hash },
    { url: 'assets/x.js?cache=dynamic', revision: hash },
    { url: 'assets/x.js', revision: null },
    { url: 'assets/x.js', revision: 'not-a-content-hash' },
  ])('rejects unsafe or unverifiable precache entry $url', entry => {
    expect(() => precacheEntries([{ url: 'index.html', revision: hash }, entry], 'https://example.com/DevPREP/')).toThrow('Invalid offline build')
  })

  it('requires the shell and removes duplicate identical URLs', () => {
    expect(() => precacheEntries([], 'https://example.com/')).toThrow('no app shell')
    expect(precacheEntries([{ url: 'index.html', revision: hash }, { url: 'index.html', revision: hash }], 'https://example.com/')).toHaveLength(1)
    expect(precacheEntries([{ url: 'index.html', revision: hash }, { url: 'index.html', revision: 'b'.repeat(32) }], 'https://example.com/')).toEqual([{ url: 'https://example.com/index.html', revision: hash }])
    expect(() => precacheEntries([{ url: 'index.html', revision: hash }, { url: 'index.html', revision: 'b'.repeat(64) }], 'https://example.com/')).toThrow('Invalid offline build')
  })

  it('computes the published SHA-256 reference digest used for content verification', async () => {
    expect(await sha256(new TextEncoder().encode('abc').buffer)).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})
