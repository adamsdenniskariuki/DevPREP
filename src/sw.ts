import { appDocument, cachePrefix, precacheEntries, sha256 } from './pwa-cache'
import type { PrecacheEntry } from './pwa-cache'
import type { WorkerReply } from './pwa-types'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: PrecacheEntry[] }

const scope = self.registration.scope
const prefix = cachePrefix(scope)
const entries = precacheEntries(self.__WB_MANIFEST, scope)
const urls = new Set(entries.map(entry => entry.url))
const version = sha256(new TextEncoder().encode(JSON.stringify(entries)).buffer)
const cacheName = version.then(hash => prefix + hash)
let preparing: Promise<void> | undefined

function message(error: unknown) {
  return error instanceof Error ? error.message : 'Browser offline storage is unavailable.'
}

async function cacheReady() {
  const name = await cacheName
  if (!await caches.has(name)) return false
  const cache = await caches.open(name)
  const responses = await Promise.all(entries.map(entry => cache.match(entry.url)))
  return responses.every(response => response?.ok)
}

async function prepareCache() {
  if (await cacheReady()) return
  const responses = await Promise.all(entries.map(async entry => {
    const response = await fetch(entry.url, { cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(20_000) })
    if (!response.ok || response.redirected || new URL(response.url).origin !== new URL(scope).origin) {
      throw new Error('Offline preparation could not download every required file. Reconnect and try again.')
    }
    if (await sha256(await response.clone().arrayBuffer()) !== entry.revision) {
      throw new Error('The deployed build changed during offline preparation. Check for an update and try again online.')
    }
    return response
  }))
  const cache = await caches.open(await cacheName)
  await Promise.all(entries.map((entry, index) => cache.put(entry.url, responses[index])))
  if (!await cacheReady()) throw new Error('The browser did not retain all offline files. Try preparing again.')
}

function prepare() {
  preparing ??= prepareCache().finally(() => { preparing = undefined })
  return preparing
}

async function notifyFailure(error: unknown) {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  for (const client of windows) {
    if (appDocument(client.url, scope)) client.postMessage({ type: 'DEVPREP_PREPARE_FAILED', error: message(error) })
  }
}

self.addEventListener('install', event => {
  event.waitUntil(prepare().catch(async error => {
    await notifyFailure(error)
    throw error
  }))
})

// Never remove old build caches during activation: other windows can still need their hashed chunks.
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()) })

async function cached(url: string) {
  const current = await cacheName
  if (await caches.has(current)) {
    const response = await (await caches.open(current)).match(url)
    if (response?.ok) return response
  }
  for (const name of (await caches.keys()).filter(name => name.startsWith(prefix) && name !== current)) {
    const response = await (await caches.open(name)).match(url)
    if (response?.ok) return response
  }
}

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)
  const base = new URL(scope)
  if (event.request.method !== 'GET' || url.origin !== base.origin) return
  if (event.request.mode === 'navigate' && appDocument(url.href, scope)) {
    event.respondWith((async () => {
      const response = await (await caches.open(await cacheName)).match(new URL('index.html', scope).href)
      return response?.ok ? response : fetch(event.request)
    })())
    return
  }
  if (urls.has(url.href) || url.pathname.startsWith(`${base.pathname}assets/`) || url.pathname.startsWith(`${base.pathname}icons/`)) {
    event.respondWith((async () => await cached(url.href) ?? fetch(event.request))())
  }
})

self.addEventListener('message', event => {
  const data: unknown = event.data
  const port = event.ports[0]
  if (!port || !data || typeof data !== 'object' || !('type' in data)) return
  event.waitUntil((async () => {
    let reply: WorkerReply
    try {
      const source = event.source
      const client = source && 'id' in source ? await self.clients.get(source.id) : undefined
      if (!client || !appDocument(client.url, scope)) throw new Error('This window is outside the app scope.')
      if (data.type === 'ACTIVATE_UPDATE') {
        if (!await cacheReady()) throw new Error('The update is not fully prepared. Keep using the current version.')
        port.postMessage({ ok: true })
        await self.skipWaiting()
        return
      }
      if (data.type !== 'PWA_STATUS' && data.type !== 'PREPARE_OFFLINE') throw new Error('Unknown offline request.')
      if (data.type === 'PREPARE_OFFLINE') await prepare()
      let ready = await cacheReady()
      const assets = 'assets' in data && Array.isArray(data.assets) && data.assets.every(item => typeof item === 'string') ? data.assets : []
      if (ready && assets.length > 0) ready = (await Promise.all(assets.map(cached))).every(response => response?.ok)
      reply = { ok: true, ready, version: (await version).slice(0, 12) }
    } catch (error) {
      reply = { ok: false, error: message(error) }
    }
    port.postMessage(reply)
  })())
})
