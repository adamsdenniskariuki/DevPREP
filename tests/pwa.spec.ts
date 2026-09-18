import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'
import { ACCENT_KEY } from '../src/accent-preference'
import { lessons } from '../src/curriculum'
import { beginSession, emptyProgress, STORAGE_KEY } from '../src/progress'

type Mount = '/' | '/DevPREP/'
type Reply = { ok: boolean; ready?: boolean; version?: string; error?: string }
const mounts: Mount[] = ['/', '/DevPREP/']
const secondRelease = 'pwa-test-v2'

async function control(request: APIRequestContext, action: string, data: object = {}) {
  const response = await request.post(`/__pwa_test__/${action}`, { data })
  expect(response.ok(), await response.text()).toBeTruthy()
  return response.json()
}

function panel(page: Page) {
  return page.locator('details').filter({ has: page.locator('summary', { hasText: 'App & offline' }) })
}

async function openPanel(page: Page) {
  const details = panel(page)
  if (await details.getAttribute('open') === null) await details.locator('summary').click()
  return details
}

async function status(page: Page, type: 'PWA_STATUS' | 'PREPARE_OFFLINE' = 'PWA_STATUS', reportedAssets?: string[]): Promise<Reply | null> {
  return page.evaluate(async ({ type, reportedAssets }) => {
    const worker = navigator.serviceWorker.controller
    if (!worker) return null
    return new Promise<Reply>((resolve, reject) => {
      const channel = new MessageChannel()
      const timer = setTimeout(() => { channel.port1.close(); reject(new Error(`${type} timed out`)) }, 10_000)
      channel.port1.onmessage = event => {
        clearTimeout(timer)
        channel.port1.close()
        resolve(event.data)
      }
      const assets = reportedAssets ?? Array.from(document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>('script[src], link[rel="stylesheet"], link[rel="modulepreload"]'))
        .map(element => 'src' in element ? element.src : element.href)
      worker.postMessage({ type, assets }, [channel.port2])
    })
  }, { type, reportedAssets })
}

async function ready(page: Page) {
  await expect(panel(page).locator('summary')).toContainText('Offline lessons ready')
  await expect.poll(async () => (await status(page))?.ready).toBe(true)
  const reply = await status(page)
  expect(reply?.ok).toBe(true)
  expect(reply?.version).toMatch(/^[a-f0-9]{12,64}$/)
}

async function build(page: Page) {
  const details = await openPanel(page)
  return (await details.getByText(/^Build: /).innerText()).replace(/^Build:\s*/, '').split(' · ')[0].trim()
}

async function seedDraft(page: Page, draft = 'A saved draft survives the explicit production update.') {
  const seed = beginSession(emptyProgress(), lessons[0].id, 'learn')
  seed.session = { ...seed.session!, phase: 'practice', draft }
  await page.addInitScript(({ key, seed }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(seed))
  }, { key: STORAGE_KEY, seed })
  return draft
}

async function waitForUpdate(page: Page) {
  const details = await openPanel(page)
  await details.getByRole('button', { name: 'Check for updates', exact: true }).click()
  await expect.poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting)).toBe(true)
  await expect(details.locator('summary')).toContainText('Update ready')
}

async function inventory(release: 'v1' | 'v2') {
  const files: { path: string; sha256: string }[] = []
  async function visit(directory: string, prefix = '') {
    for (const item of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, item.name)
      const relative = `${prefix}${item.name}`
      if (item.isDirectory()) await visit(path, `${relative}/`)
      else if (/\.(html|js|css|png|svg|webmanifest)$/.test(item.name) && relative !== 'sw.js') {
        files.push({ path: relative, sha256: createHash('sha256').update(await readFile(path)).digest('hex') })
      }
    }
  }
  await visit(resolve('dist-pwa-tests', release))
  return files
}

async function assertPrecache(page: Page, mount: Mount, release: 'v1' | 'v2') {
  const expected = await inventory(release)
  const version = (await status(page))?.version
  expect(version).toBeTruthy()
  const actual = await page.evaluate(async ({ mount, paths, version }) => {
    const scope = new URL(mount, location.origin).href
    const prefix = `devprep-pwa:${encodeURIComponent(scope)}:`
    const names = (await caches.keys()).filter(name => name.startsWith(`${prefix}${version}`))
    const rows: Record<string, string | null> = {}
    for (const path of paths) {
      const url = new URL(path, scope).href
      let response: Response | undefined
      for (const name of names) {
        response = await (await caches.open(name)).match(url)
        if (response) break
      }
      rows[path] = response ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await response.arrayBuffer())))
        .map(byte => byte.toString(16).padStart(2, '0')).join('') : null
    }
    return { names, rows }
  }, { mount, paths: expected.map(file => file.path), version })
  expect(actual.names).toHaveLength(1)
  for (const file of expected) expect(actual.rows[file.path], `Verified precache: ${mount}${file.path}`).toBe(file.sha256)
}

test.beforeEach(async ({ request }) => {
  await control(request, 'reset')
})

test('artifact server has strict dual mounts, loopback-only controls, and no SPA or old-release fallback', async ({ request }) => {
  const root = await request.get('/')
  const nested = await request.get('/DevPREP/')
  expect(await root.body()).toEqual(await nested.body())
  expect((await request.get('/a-missing-route')).status()).toBe(404)
  expect((await request.get('/DevPREP/a-missing-route')).status()).toBe(404)
  expect((await request.get('/__pwa_test__/reset')).status()).toBe(405)
  expect((await request.post('/__pwa_test__/reset', { data: {}, headers: { Origin: 'https://example.org' } })).status()).toBe(403)
  expect((await request.post('/__pwa_test__/reset', { data: {}, headers: { Host: 'example.org' } })).status()).toBe(403)
  const oldEntry = (await root.text()).match(/<script[^>]+src="([^"]+)"/)![1].replace(/^\.\//, '')
  await control(request, 'release', { mount: '/', release: 'v2' })
  expect((await request.get(`/${oldEntry}`)).status()).toBe(404)
  expect((await request.get(`/DevPREP/${oldEntry}`)).status()).toBe(200)
  const next = await request.get('/')
  expect(await next.body()).not.toEqual(await nested.body())
})

for (const mount of mounts) {
  test.describe(`production mount ${mount}`, () => {
    test('manifest, icon dimensions, real worker control, and every production file are ready', async ({ page, request }) => {
      await page.goto(mount)
      await ready(page)
      const manifestURL = await page.locator('link[rel="manifest"]').evaluate((element: HTMLLinkElement) => element.href)
      const response = await request.get(manifestURL)
      expect(response.headers()['content-type']).toContain('application/manifest+json')
      const manifest = await response.json()
      const scope = new URL(mount, page.url()).href
      expect(new URL(manifest.id, manifestURL).href).toBe(scope)
      expect(new URL(manifest.scope, manifestURL).href).toBe(scope)
      expect(new URL(manifest.start_url, manifestURL).href).toBe(scope)
      expect(manifest.display).toBe('standalone')
      expect(manifest.icons).toEqual(expect.arrayContaining([
        expect.objectContaining({ sizes: '192x192', purpose: 'any' }),
        expect.objectContaining({ sizes: '512x512', purpose: 'any' }),
        expect.objectContaining({ sizes: '512x512', purpose: 'maskable' }),
      ]))
      for (const icon of manifest.icons) {
        const url = new URL(icon.src, manifestURL).href
        expect(url.startsWith(scope)).toBe(true)
        const dimensions = await page.evaluate(async url => {
          const image = new Image()
          image.src = url
          await image.decode()
          return `${image.naturalWidth}x${image.naturalHeight}`
        }, url)
        expect(dimensions).toBe(icon.sizes)
      }
      expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.scope)).toBe(scope)
      await assertPrecache(page, mount, 'v1')
      expect((await status(page, 'PWA_STATUS', [new URL('assets/not-a-cached-entry.js', scope).href]))?.ready).toBe(false)
      await ready(page)
      await page.setViewportSize({ width: 320, height: 780 })
      await openPanel(page)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    })

    test('cold offline launch opens unseen lessons in all four tracks and saves, reloads, exports, and imports a draft', async ({ page, context }) => {
      await page.goto(mount)
      await ready(page)
      await context.setOffline(true)
      await page.close()
      const offline = await context.newPage()
      offline.on('dialog', dialog => dialog.accept())
      await offline.goto(`${mount}#roadmap`)
      await ready(offline)
      for (const track of ['dsa', 'system-design', 'ml', 'behavioral']) {
        const lesson = lessons.filter(item => item.track === track).at(-1)!
        await offline.goto(`${mount}#roadmap`)
        const row = offline.getByRole('article').filter({ has: offline.getByRole('heading', { name: lesson.title, exact: true }) })
        await row.getByRole('button', { name: 'Start lesson', exact: true }).click()
        await expect(offline.getByRole('heading', { name: lesson.title, exact: true })).toBeVisible()
        await offline.getByLabel('In this lesson').selectOption('concept-0')
        await expect(offline.getByText(lesson.concepts[0].body, { exact: true })).toBeVisible()
        await offline.getByRole('button', { name: 'Continue to practice' }).click()
        await expect(offline.getByText(lesson.task, { exact: true })).toBeVisible()
        await offline.getByLabel('Your approach & answer').fill(`Offline answer for ${track}`)
        await offline.reload()
        await expect(offline.getByLabel('Your approach & answer')).toHaveValue(`Offline answer for ${track}`)
      }
      await offline.goto(`${mount}#progress`)
      const before = await offline.evaluate(key => localStorage.getItem(key), STORAGE_KEY)
      const downloaded = offline.waitForEvent('download')
      await offline.getByRole('button', { name: 'Export backup' }).click()
      const download = await downloaded
      expect(await download.failure()).toBeNull()
      const stream = await download.createReadStream()
      if (!stream) throw new Error('Chromium did not expose the offline backup download')
      const chunks: Buffer[] = []
      for await (const chunk of stream) chunks.push(Buffer.from(chunk))
      const backup = Buffer.concat(chunks)
      expect(JSON.parse(backup.toString())).toEqual(JSON.parse(before!))
      await offline.evaluate(key => localStorage.removeItem(key), STORAGE_KEY)
      await offline.reload()
      await offline.getByLabel('Import progress JSON').setInputFiles({ name: 'offline-backup.json', mimeType: 'application/json', buffer: backup })
      await offline.getByRole('button', { name: 'Replace progress' }).click()
      expect(await offline.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(before)
      await offline.getByRole('button', { name: 'Resume session' }).click()
      await expect(offline.getByLabel('Your approach & answer')).toHaveValue('Offline answer for behavioral')
    })

    for (const fault of ['network', 'tamper'] as const) {
      test(`initial ${fault} precache failure never advertises readiness; repair and explicit retry recover`, async ({ page, request }) => {
        await control(request, 'fault', { mount, fault })
        await page.goto(mount)
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
        await expect.poll(async () => (await control(request, 'state', { mount })).hits).toBeGreaterThan(0)
        const details = await openPanel(page)
        await expect(details.getByRole('button', { name: 'Retry offline preparation', exact: true })).toBeVisible()
        await expect(details.locator('summary')).not.toContainText('Offline lessons ready')
        expect((await status(page))?.ready ?? false).toBe(false)
        await control(request, 'fault', { mount, fault: null })
        await details.getByRole('button', { name: 'Retry offline preparation', exact: true }).click()
        await ready(page)
        await assertPrecache(page, mount, 'v1')
      })
    }

    test('real waiting update is explicit, preserves a saved active draft and old tab assets, and retains every cache generation', async ({ page, context, request }) => {
      const draft = await seedDraft(page)
      await page.goto(`${mount}#study`)
      await ready(page)
      const firstBuild = await build(page)
      expect(firstBuild).not.toBe(secondRelease)
      const oldTab = await context.newPage()
      await oldTab.goto(`${mount}#study`)
      await ready(oldTab)
      await openPanel(oldTab)
      const oldEntry = await oldTab.locator('script[src]').first().evaluate((element: HTMLScriptElement) => element.src)
      const sentinels = await page.evaluate(async mount => {
        const otherMount = mount === '/' ? '/DevPREP/' : '/'
        const names = ['another-app:sentinel', `devprep-pwa:${encodeURIComponent(new URL(otherMount, location.origin).href)}:sentinel`]
        for (const name of names) await (await caches.open(name)).put(new URL('sentinel', location.origin), new Response('keep me'))
        return names
      }, mount)
      const oldNames = await page.evaluate(async mount => {
        const prefix = `devprep-pwa:${encodeURIComponent(new URL(mount, location.origin).href)}:`
        return (await caches.keys()).filter(name => name.startsWith(prefix))
      }, mount)
      await page.evaluate(() => { Object.assign(window, { pwaDocumentMarker: 'original' }) })
      await oldTab.evaluate(() => { Object.assign(window, { pwaDocumentMarker: 'old-tab' }) })
      await control(request, 'release', { mount, release: 'v2' })
      await waitForUpdate(page)
      expect(await build(page)).toBe(firstBuild)
      expect(await page.evaluate(() => Reflect.get(window, 'pwaDocumentMarker'))).toBe('original')
      await expect(page.getByLabel('Your approach & answer')).toHaveValue(draft)
      expect((await request.get(oldEntry)).status()).toBe(404)
      await (await openPanel(page)).getByRole('button', { name: 'Update & reload', exact: true }).click()
      await expect.poll(() => build(page)).toBe(secondRelease)
      await expect(page.getByLabel('Your approach & answer')).toHaveValue(draft)
      expect(await build(oldTab)).toBe(firstBuild)
      expect(await oldTab.evaluate(() => Reflect.get(window, 'pwaDocumentMarker'))).toBe('old-tab')
      await expect(panel(oldTab).locator('summary')).toContainText('Update ready')
      const oldResponse = await oldTab.evaluate(async url => {
        const response = await fetch(url, { cache: 'no-store' })
        return { status: response.status, body: await response.text() }
      }, oldEntry)
      expect(oldResponse.status).toBe(200)
      expect(oldResponse.body).toBe(await readFile(resolve('dist-pwa-tests', 'v1', 'assets', new URL(oldEntry).pathname.split('/').at(-1)!), 'utf8'))
      for (const name of oldNames) expect(await page.evaluate(name => caches.has(name), name)).toBe(true)
      await oldTab.close()
      await ready(page)
      await status(page)
      for (const name of oldNames) expect(await page.evaluate(name => caches.has(name), name)).toBe(true)
      for (const name of sentinels) {
        expect(await page.evaluate(async name => (await (await caches.open(name)).match(new URL('sentinel', location.origin)))?.text(), name)).toBe('keep me')
      }
      await assertPrecache(page, mount, 'v2')
      await context.setOffline(true)
      await page.close()
      const nextLaunch = await context.newPage()
      await nextLaunch.goto(`${mount}#study`)
      await ready(nextLaunch)
      expect(await build(nextLaunch)).toBe(secondRelease)
      await expect(nextLaunch.getByLabel('Your approach & answer')).toHaveValue(draft)
      for (const name of oldNames) expect(await nextLaunch.evaluate(name => caches.has(name), name)).toBe(true)
    })

    for (const fault of ['network', 'tamper'] as const) {
      test(`failed ${fault} update leaves the old offline version usable`, async ({ page, request, context }) => {
        const draft = await seedDraft(page)
        await page.goto(`${mount}#study`)
        await ready(page)
        const firstBuild = await build(page)
        const firstVersion = (await status(page))!.version
        await control(request, 'release', { mount, release: 'v2' })
        await control(request, 'fault', { mount, fault })
        await (await openPanel(page)).getByRole('button', { name: 'Check for updates', exact: true }).click()
        await expect.poll(async () => (await control(request, 'state', { mount })).hits).toBeGreaterThan(0)
        await expect.poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.installing)).toBe(false)
        expect(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting)).toBe(false)
        expect(await build(page)).toBe(firstBuild)
        expect((await status(page))!.version).toBe(firstVersion)
        await context.setOffline(true)
        await page.close()
        const offline = await context.newPage()
        await offline.goto(`${mount}#study`)
        await ready(offline)
        expect(await build(offline)).toBe(firstBuild)
        await expect(offline.getByLabel('Your approach & answer')).toHaveValue(draft)
      })
    }

    test('a last-moment storage write failure blocks update reload and preserves the live draft', async ({ page, request }) => {
      const draft = await seedDraft(page)
      await page.goto(`${mount}#study`)
      await ready(page)
      const firstBuild = await build(page)
      await control(request, 'release', { mount, release: 'v2' })
      await waitForUpdate(page)
      await page.evaluate(() => {
        Object.assign(window, { pwaDocumentMarker: 'must-not-reload' })
        Storage.prototype.setItem = () => { throw new DOMException('PWA test storage quota', 'QuotaExceededError') }
      })
      await (await openPanel(page)).getByRole('button', { name: 'Update & reload', exact: true }).click()
      await expect(page.getByRole('alert').filter({ hasText: /save|storage|memory|quota/i }).first()).toBeVisible()
      expect(await page.evaluate(() => Reflect.get(window, 'pwaDocumentMarker'))).toBe('must-not-reload')
      expect(await build(page)).toBe(firstBuild)
      await expect(page.getByLabel('Your approach & answer')).toHaveValue(draft)
      await page.getByLabel('Your approach & answer').fill('Unsaved in-memory edit must not be reloaded')
      await expect((await openPanel(page)).getByRole('button', { name: 'Update & reload', exact: true })).toBeDisabled()
      await expect(page.getByLabel('Your approach & answer')).toHaveValue('Unsaved in-memory edit must not be reloaded')
      expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).session.draft, STORAGE_KEY)).toBe(draft)
    })

    test('reconnection discovers an update without reloading; closing all clients allows the next offline launch to use it', async ({ page, request, context }) => {
      await page.goto(mount)
      await ready(page)
      const firstBuild = await build(page)
      await page.evaluate(() => { Object.assign(window, { pwaDocumentMarker: 'original' }) })
      await context.setOffline(true)
      await control(request, 'release', { mount, release: 'v2' })
      const discovered = context.waitForEvent('serviceworker')
      await context.setOffline(false)
      await expect.poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting)).toBe(true)
      await expect(panel(page).locator('summary')).toContainText('Update ready')
      expect(await build(page)).toBe(firstBuild)
      expect(await page.evaluate(() => Reflect.get(window, 'pwaDocumentMarker'))).toBe('original')
      const nextWorker = await discovered
      await page.close()
      await expect.poll(() => nextWorker.evaluate(() => {
        const registration = (self as unknown as { registration: ServiceWorkerRegistration }).registration
        return registration.active?.state === 'activated' && !registration.waiting
      })).toBe(true)
      await context.setOffline(true)
      const nextLaunch = await context.newPage()
      await nextLaunch.goto(mount)
      await ready(nextLaunch)
      expect(await build(nextLaunch)).toBe(secondRelease)
    })

    test('missing cached files withdraw readiness and PREPARE_OFFLINE repairs the complete cache', async ({ page }) => {
      await page.goto(mount)
      await ready(page)
      await page.evaluate(async mount => {
        const scope = new URL(mount, location.origin).href
        const prefix = `devprep-pwa:${encodeURIComponent(scope)}:`
        for (const name of (await caches.keys()).filter(name => name.startsWith(prefix))) {
          await (await caches.open(name)).delete(new URL('icons/icon-192.png', scope))
        }
      }, mount)
      expect((await status(page))?.ready).toBe(false)
      await page.reload()
      const details = await openPanel(page)
      await expect(details.locator('summary')).not.toContainText('Offline lessons ready')
      await details.getByRole('button', { name: 'Retry offline preparation', exact: true }).click()
      await ready(page)
      expect((await status(page, 'PREPARE_OFFLINE'))?.ready).toBe(true)
      await assertPrecache(page, mount, 'v1')
    })

    test('reserved assets preserve uncached 404s; unrelated routes, navigation, non-GET and cross-origin requests bypass the worker', async ({ page }) => {
      await page.goto(mount)
      await ready(page)
      const missingURLs: string[] = []
      for (const path of ['not-an-app-route', 'another-app/index.html', 'assets/not-a-bundled-file.js', 'icons/not-a-bundled-file.png']) {
        const url = new URL(`${mount}${path}`, page.url()).href
        missingURLs.push(url)
        const received = page.waitForResponse(response => response.url() === url)
        const result = await page.evaluate(async url => {
          const response = await fetch(url)
          return { status: response.status, body: await response.json() }
        }, url)
        expect(result).toEqual({ status: 404, body: { error: 'Not found in current release' } })
        const response = await received
        // Reserved namespaces may look in prior-generation caches before passing through to the network.
        if (!/^(assets|icons)\//.test(path)) expect(response.fromServiceWorker(), `${url} must bypass the worker`).toBe(false)
      }
      const received = page.waitForResponse(response => response.url() === new URL(mount, page.url()).href && response.request().method() === 'POST')
      expect(await page.evaluate(async mount => (await fetch(mount, { method: 'POST', body: 'not a navigation' })).status, mount)).toBe(405)
      expect((await received).fromServiceWorker()).toBe(false)
      const crossOrigin = new URL('/pwa-cross-origin-probe', page.url())
      crossOrigin.hostname = 'localhost'
      const crossResponse = page.waitForResponse(response => response.url() === crossOrigin.href)
      await page.evaluate(async url => { await fetch(url, { mode: 'no-cors' }) }, crossOrigin.href)
      const foreign = await crossResponse
      expect(foreign.fromServiceWorker()).toBe(false)
      expect(foreign.status()).toBe(403) // The strict loopback server rejects the alternate Host.
      const navigation = await page.goto(`${mount}unrelated-document`)
      expect(navigation?.status()).toBe(404)
      expect(navigation?.fromServiceWorker()).toBe(false)
      expect(await navigation?.json()).toEqual({ error: 'Not found in current release' })
      missingURLs.push(new URL(`${mount}unrelated-document`, page.url()).href, crossOrigin.href)
      const cachedFailures = await page.evaluate(async urls => {
        const found: string[] = []
        for (const name of (await caches.keys()).filter(name => name.startsWith('devprep-pwa:'))) {
          const cache = await caches.open(name)
          for (const url of urls) if (await cache.match(url)) found.push(`${name}: ${url}`)
        }
        return found
      }, missingURLs)
      expect(cachedFailures, '404s and cross-origin responses must be absent from every DevPREP cache generation').toEqual([])
    })
  })
}

for (const blocker of ['recovery', 'conflict', 'accent'] as const) {
  test(`${blocker} warnings prevent an otherwise prepared update`, async ({ page, context, request }) => {
    await seedDraft(page)
    await page.goto('/DevPREP/#study')
    await ready(page)
    const firstBuild = await build(page)
    const firstEntry = await page.locator('script[src]').first().getAttribute('src')
    await control(request, 'release', { mount: '/DevPREP/', release: 'v2' })
    await waitForUpdate(page)
    if (blocker === 'recovery') {
      await page.evaluate(key => localStorage.setItem(key, '{broken'), STORAGE_KEY)
      await page.reload()
      await expect(page.getByRole('heading', { name: 'Let’s protect your progress.' })).toBeVisible()
      // Recovery hides the ordinary app controls rather than offering any reload/update action.
      await expect(page.getByRole('button', { name: 'Update & reload', exact: true })).toHaveCount(0)
      expect(await page.locator('script[src]').first().getAttribute('src')).toBe(firstEntry)
      expect(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting)).toBe(true)
      return
    } else if (blocker === 'conflict') {
      const other = await context.newPage()
      await other.goto('/DevPREP/#study')
      await other.getByLabel('Your approach & answer').fill('A different window owns the saved answer')
      await expect(page.getByRole('alert').filter({ hasText: /another tab/ })).toBeVisible()
    } else {
      await page.evaluate(key => {
        const original = Storage.prototype.setItem
        Storage.prototype.setItem = function (name, value) {
          if (name === key) throw new DOMException('Accent quota', 'QuotaExceededError')
          return original.call(this, name, value)
        }
      }, ACCENT_KEY)
      await page.getByLabel('Accent', { exact: true }).selectOption('forest')
      await expect(page.getByRole('alert').filter({ hasText: 'Accent preference needs attention.' })).toBeVisible()
    }
    const details = await openPanel(page)
    await expect(details.locator('summary')).toContainText('Update ready')
    await expect(details.getByRole('button', { name: 'Update & reload', exact: true })).toBeDisabled()
    expect(await build(page)).toBe(firstBuild)
    expect(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting)).toBe(true)
  })
}

test('synthetic install events cover dismissal, acceptance, and appinstalled without claiming native OS installation', async ({ page }) => {
  await page.goto('/DevPREP/')
  await ready(page)
  const details = await openPanel(page)
  const firstBuild = await build(page)
  for (const outcome of ['dismissed', 'accepted'] as const) {
    await page.evaluate(outcome => {
      const event = new Event('beforeinstallprompt', { cancelable: true })
      Object.defineProperties(event, {
        prompt: { value: async () => { Object.assign(window, { syntheticInstallPrompted: true }) } },
        userChoice: { value: Promise.resolve({ outcome, platform: 'web' }) },
      })
      Object.assign(window, { syntheticInstallPrompted: false })
      window.dispatchEvent(event)
      Object.assign(window, { syntheticInstallPrevented: event.defaultPrevented })
    }, outcome)
    await expect(details.getByRole('button', { name: 'Install DevPREP', exact: true })).toBeVisible()
    expect(await page.evaluate(() => Reflect.get(window, 'syntheticInstallPrompted'))).toBe(false)
    expect(await page.evaluate(() => Reflect.get(window, 'syntheticInstallPrevented'))).toBe(true)
    await details.getByRole('button', { name: 'Install DevPREP', exact: true }).click()
    expect(await page.evaluate(() => Reflect.get(window, 'syntheticInstallPrompted'))).toBe(true)
    await expect(details.getByText(outcome === 'dismissed' ? /Installation dismissed/ : /Installation requested/)).toBeVisible()
    await expect(details.getByRole('button', { name: 'Install DevPREP', exact: true })).toHaveCount(0)
  }
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')))
  await expect(details.getByText('The browser reported this app installed.', { exact: true })).toBeVisible()
  expect(await build(page)).toBe(firstBuild)
})

test('synthetic standalone display mode and iOS guidance remain usable at 320px', async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    baseURL,
    serviceWorkers: 'allow',
    viewport: { width: 320, height: 780 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
  })
  try {
    const page = await context.newPage()
    await page.goto('/DevPREP/')
    await ready(page)
    const details = await openPanel(page)
    await expect(details.getByText(/On iPhone or iPad:.*Safari.*Share.*Add to Home Screen/)).toBeVisible()
    await page.addInitScript(() => {
      const original = window.matchMedia.bind(window)
      window.matchMedia = query => {
        const result = original(query)
        if (query === '(display-mode: standalone)') Object.defineProperty(result, 'matches', { value: true })
        return result
      }
    })
    await page.reload()
    await openPanel(page)
    await expect(details.getByText('Running as an installed app.', { exact: true })).toBeVisible()
    await expect(details.getByText(/On iPhone or iPad:/)).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  } finally {
    await context.close()
  }
})
