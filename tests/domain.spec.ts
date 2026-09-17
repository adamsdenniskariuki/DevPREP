import { expect, test } from '@playwright/test'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { STORAGE_KEY } from '../src/progress'

async function builtFiles(directory = 'dist', prefix = ''): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(entry => entry.isDirectory()
    ? builtFiles(join(directory, entry.name), `${prefix}${entry.name}/`)
    : [`${prefix}${entry.name}`]))
  return nested.flat()
}

for (const mount of ['/', '/DevPREP/']) {
  test(`${mount} serves the complete, identical artifact and domain marker`, async ({ request, baseURL }) => {
    const origin = new URL(baseURL!).origin
    for (const file of await builtFiles()) {
      const response = await request.get(`${origin}${mount}${file}`)
      expect(response.status(), file).toBe(200)
      expect(await response.body(), file).toEqual(await readFile(join('dist', file)))
    }
    const cname = await request.get(`${origin}${mount}CNAME`)
    expect(await cname.text()).toMatch(/^devprep\.madebyfavor\.com\r?\n$/)
    expect((await request.get(`${origin}${mount}assets/missing.js`)).status()).toBe(404)
  })

  test(`${mount} loads assets and refreshes hash routes without rewrites`, async ({ page, baseURL }) => {
    const origin = new URL(baseURL!).origin
    const failures: string[] = []
    const assets = new Set<string>()
    page.on('pageerror', error => failures.push(error.message))
    page.on('requestfailed', request => failures.push(request.url()))
    page.on('response', response => {
      if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`)
      if (['script', 'stylesheet', 'image', 'font'].includes(response.request().resourceType())) {
        assets.add(response.url())
      }
    })
    for (const route of ['today', 'roadmap', 'review', 'progress', 'study']) {
      await page.goto(`${origin}${mount}?scoutTheme=light#${route}`)
      await page.reload()
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      expect(new URL(page.url()).pathname).toBe(mount)
      expect(new URL(page.url()).hash).toBe(`#${route}`)
    }
    await page.getByRole('link', { name: 'Today', exact: true }).click()
    await page.getByRole('button', { name: 'Start today’s lesson' }).click()
    await page.getByRole('button', { name: 'Continue to practice' }).click()
    await page.getByLabel('Your approach & answer').fill('A refresh-safe domain draft.')
    await page.reload()
    await expect(page.getByLabel('Your approach & answer')).toHaveValue('A refresh-safe domain draft.')
    expect(new URL(page.url()).pathname).toBe(mount)
    const references = await page.locator('script[src], link[rel="stylesheet"]').evaluateAll(elements =>
      elements.map(element => element.getAttribute('src') ?? element.getAttribute('href')))
    expect(references.length).toBeGreaterThanOrEqual(2)
    for (const reference of references) expect(reference).toMatch(/^\.\/assets\//)
    expect([...assets].some(url => url.endsWith('.js'))).toBe(true)
    expect([...assets].some(url => url.endsWith('.css'))).toBe(true)
    for (const url of assets) expect(url).toContain(`${origin}${mount}assets/`)
    expect(failures).toEqual([])
  })
}

test('a new origin starts empty and restores progress only through explicit backup import', async ({ page, context, baseURL }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Start today’s lesson' }).click()
  await page.getByRole('button', { name: 'Continue to practice' }).click()
  await page.getByLabel('Your approach & answer').fill('Transfer this unfinished answer explicitly.')
  await page.goto('./#progress')
  const before = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export backup' }).click()
  const backup = await (await downloadPromise).path()
  expect(backup).toBeTruthy()

  // Different host, same browser context: local storage must not follow the user.
  const target = new URL(baseURL!)
  target.hostname = 'localhost'
  target.pathname = '/'
  target.hash = 'progress'
  const other = await context.newPage()
  await other.goto(target.href)
  expect(await other.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBeNull()
  await other.getByLabel('Import progress JSON').setInputFiles(backup!)
  await expect(other.getByRole('dialog')).toBeVisible()
  await other.getByRole('button', { name: 'Replace progress' }).click()
  expect(await other.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(before)
  await other.getByRole('button', { name: 'Resume session' }).click()
  await other.reload()
  await expect(other.getByLabel('Your approach & answer')).toHaveValue('Transfer this unfinished answer explicitly.')
  expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(before)
})
