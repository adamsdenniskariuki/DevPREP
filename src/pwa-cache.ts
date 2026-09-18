export interface PrecacheEntry {
  url: string
  revision: string | null
}

export function cachePrefix(scope: string) {
  return `devprep-pwa:${encodeURIComponent(new URL(scope).href)}:`
}

export function appDocument(url: string, scope: string) {
  const target = new URL(url)
  const base = new URL(scope)
  return target.origin === base.origin && (target.pathname === base.pathname || target.pathname === `${base.pathname}index.html`)
}

export function precacheEntries(entries: PrecacheEntry[], scope: string) {
  const base = new URL(scope)
  const resolved = entries.map(entry => {
    const url = new URL(entry.url, base)
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname) || url.search) {
      throw new Error('Invalid offline build manifest.')
    }
    return { url: url.href, revision: entry.revision }
  })
  if (!resolved.some(entry => entry.url === new URL('index.html', base).href)) throw new Error('The offline build has no app shell.')
  // Vite PWA appends icon/manifest metadata after transforms. Require our SHA-256 entry for every URL.
  return Array.from(new Set(resolved.map(entry => entry.url))).map(url => {
    const hashes = new Set(resolved.filter(entry => entry.url === url && /^[a-f0-9]{64}$/.test(entry.revision ?? '')).map(entry => entry.revision!))
    if (hashes.size !== 1) throw new Error('Invalid offline build manifest.')
    return { url, revision: Array.from(hashes)[0] }
  })
}

export async function sha256(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(value => value.toString(16).padStart(2, '0')).join('')
}
