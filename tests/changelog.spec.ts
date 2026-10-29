import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { LAST_SEEN_VERSION_KEY } from '../src/whats-new'

const { releases }: { releases: { version: string; title: string }[] } = JSON.parse(readFileSync(new URL('../content/changelog.json', import.meta.url), 'utf8'))
const current = releases[0]
const MOD = process.platform === 'darwin' ? 'Meta' : 'Control'
const card = (page: Page) => page.getByRole('region', { name: `What’s new in DevPREP ${current.version}` })
const axe = async (page: Page) => (await new AxeBuilder({ page }).analyze()).violations.map(violation => ({ id: violation.id, targets: violation.nodes.map(node => node.target.join(' ')) }))

async function seenBefore(page: Page, version: string) {
  await page.addInitScript(({ key, version }) => {
    if (!sessionStorage.getItem('seeded-last-seen')) {
      localStorage.setItem(key, version)
      sessionStorage.setItem('seeded-last-seen', '1')
    }
  }, { key: LAST_SEEN_VERSION_KEY, version })
}

test('the changelog page lists every release newest first, marks the current version, and filters', async ({ page }) => {
  await page.goto('./#changelog')
  await expect(page.getByRole('heading', { level: 1, name: 'What’s new' })).toBeFocused()
  await expect(page.getByText(`You’re on version ${current.version}`)).toBeVisible()
  const titles = page.locator('.changelog-release h2')
  await expect(titles).toHaveText(releases.map(release => release.title))
  await expect(page.locator('.changelog-release').first()).toContainText('Current')
  await page.getByLabel('Filter releases').fill('whiteboard')
  await expect(page.getByRole('status').filter({ hasText: /releases? shown/ })).toHaveText(/^\d+ releases? shown$/)
  await expect(titles.filter({ hasText: 'Whiteboard' })).toHaveCount(1)
  expect(await titles.count()).toBeLessThan(releases.length)
  await page.getByLabel('Filter releases').fill('zzzz-not-a-release')
  await expect(page.getByText('No release mentions that.')).toBeVisible()
})

test('Ctrl+K finds the changelog, and Settings links to it', async ({ page }) => {
  await page.goto('./#home')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.keyboard.press(`${MOD}+k`)
  const dialog = page.getByRole('dialog', { name: 'Search DevPREP' })
  await dialog.getByRole('combobox').fill('changelog')
  await expect(dialog.getByRole('option').first()).toContainText('What’s new')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#changelog$/)
  await expect(page.getByRole('heading', { level: 1, name: 'What’s new' })).toBeFocused()
  await page.goto('./#settings')
  await page.getByRole('link', { name: 'See what’s new' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'What’s new' })).toBeFocused()
})

test('a first install never shows What’s new, but records the version', async ({ page }) => {
  await page.goto('./#home')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('region', { name: /What’s new in DevPREP/ })).toHaveCount(0)
  expect(await page.evaluate(key => localStorage.getItem(key), LAST_SEEN_VERSION_KEY)).toBe(current.version)
})

test('after an update What’s new appears once, links to the changelog, and does not return', async ({ page }) => {
  await seenBefore(page, releases[2].version)
  await page.goto('./#home')
  await expect(card(page)).toBeVisible()
  await expect(card(page).getByRole('heading', { level: 3 })).toHaveCount(2)
  await expect(card(page)).toContainText(releases[0].title)
  await expect(card(page)).toContainText(releases[1].title)
  await expect(card(page)).not.toContainText(releases[2].title)
  await card(page).getByRole('button', { name: 'Dismiss What’s new' }).click()
  await expect(card(page)).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(card(page)).toHaveCount(0)
})

test('the What’s new link opens the changelog and hides the card', async ({ page }) => {
  await seenBefore(page, releases[1].version)
  await page.goto('./#home')
  await card(page).getByRole('link', { name: 'See the full changelog' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'What’s new' })).toBeFocused()
  await expect(card(page)).toHaveCount(0)
})

for (const width of [360, 768, 1440]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`changelog and What’s new are accessible and fit at ${width}px in ${theme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
      await page.setViewportSize({ width, height: 900 })
      await seenBefore(page, releases[3].version)
      await page.goto('./#home')
      await expect(card(page)).toBeVisible()
      await page.waitForTimeout(400)
      expect(await axe(page), `What’s new at ${width} ${theme}`).toEqual([])
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.goto('./#changelog')
      await expect(page.getByRole('heading', { level: 1, name: 'What’s new' })).toBeVisible()
      await page.locator('.changelog-notes summary').first().click()
      await page.waitForTimeout(400)
      expect(await axe(page), `changelog at ${width} ${theme}`).toEqual([])
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    })
  }
}
