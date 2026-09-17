import { expect, test } from '@playwright/test'
import { ACCENT_KEY, accents } from '../src/accent-preference'
import { STORAGE_KEY } from '../src/progress'
import legacyBackup from './fixtures/v1-progress.json' with { type: 'json' }
import { color, contrast, css, over, textContrast } from './contrast'

const neutralTokens = ['bg', 'bg-elevated', 'surface', 'surface-soft', 'border', 'border-strong', 'text', 'text-muted', 'text-soft', 'success', 'danger', 'warning', 'link']
const paletteTokens = ['accent', 'accent-hover', 'accent-soft', 'accent-fg', 'accent-on-soft', 'highlight']
const tokensToRead = [...neutralTokens, ...paletteTokens]

for (const theme of ['light', 'dark'] as const) {
  for (const accent of accents) {
    test(`${theme} ${accent.label}: real tokens and accent surfaces meet contrast targets`, async ({ page }, testInfo) => {
      await page.emulateMedia({ colorScheme: theme === 'light' ? 'dark' : 'light' })
      await page.addInitScript(({ key, progressKey, backup }) => {
        localStorage.removeItem(key)
        localStorage.setItem(progressKey, JSON.stringify(backup))
      }, { key: ACCENT_KEY, progressKey: STORAGE_KEY, backup: { ...legacyBackup, session: null, records: { 'hash-map-complements': { ...legacyBackup.records['hash-map-complements'], due: '2000-01-01' } } } })
      await page.goto(`./?scoutTheme=${theme}`)
      const baseline = await page.evaluate(names => Object.fromEntries(names.map(name => [name, getComputedStyle(document.documentElement).getPropertyValue(`--cp-${name}`).trim()])), neutralTokens)
      await page.getByLabel('Accent', { exact: true }).selectOption(accent.id)
      await expect(page.locator('html')).toHaveAttribute('data-accent', accent.id)
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      const tokens = await page.evaluate(names => Object.fromEntries(names.map(name => [name, getComputedStyle(document.documentElement).getPropertyValue(`--cp-${name}`).trim()])), tokensToRead)
      for (const name of neutralTokens) expect(tokens[name], `${name} must not be recolored`).toBe(baseline[name])
      if (accent.id === 'red') {
        expect(color(tokens.accent)).toEqual(color(theme === 'light' ? '#b11f4b' : '#fd8ea1'))
        expect(color(tokens['accent-hover'])).toEqual(color(theme === 'light' ? '#9a1a41' : '#fb7b91'))
        expect(color(tokens['accent-soft'])).toEqual(theme === 'light' ? [177, 31, 75, 0.08] : [253, 142, 161, 0.14])
        expect(color(tokens.highlight)).toEqual(theme === 'light' ? [177, 31, 75, 0.12] : [253, 142, 161, 0.12])
      }
      const fill = color(tokens.accent)
      const ink = color(tokens['accent-on-soft'])
      expect(contrast(color(tokens['accent-fg']), fill)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(color(tokens['accent-fg']), color(tokens['accent-hover']))).toBeGreaterThanOrEqual(4.5)
      expect(contrast(fill, color(tokens.border)), 'progress fill versus track').toBeGreaterThanOrEqual(3)
      for (const name of ['bg', 'bg-elevated', 'surface', 'surface-soft']) {
        const base = color(tokens[name])
        const soft = over(color(tokens['accent-soft']), base)
        const highlight = over(color(tokens.highlight), soft)
        expect(contrast(fill, base), `accent text on ${name}`).toBeGreaterThanOrEqual(4.5)
        expect(contrast(ink, soft), `selected text on soft/${name}`).toBeGreaterThanOrEqual(4.5)
        expect(contrast(color(tokens.text), soft), `body text on soft/${name}`).toBeGreaterThanOrEqual(4.5)
        expect(contrast(color(tokens.text), highlight), `badge text on nested highlight/${name}`).toBeGreaterThanOrEqual(4.5)
        expect(contrast(fill, soft), `focus outline on soft/${name}`).toBeGreaterThanOrEqual(3)
        expect(contrast(fill, highlight), `focus outline on highlight/${name}`).toBeGreaterThanOrEqual(3)
      }
      await expect(page.locator('.accent-swatch')).toHaveCSS('background-color', css(tokens.accent))
      await expect(page.locator('.nav-item.active')).toHaveCSS('color', css(tokens['accent-on-soft']))
      expect(await textContrast(page.locator('.nav-item.active'))).toBeGreaterThanOrEqual(4.5)
      expect(await textContrast(page.locator('.nav-badge'))).toBeGreaterThanOrEqual(4.5)
      expect(await textContrast(page.locator('.note-card .eyebrow'))).toBeGreaterThanOrEqual(4.5)
      expect(await textContrast(page.locator('.note-card p'))).toBeGreaterThanOrEqual(4.5)
      expect(await textContrast(page.locator('.track-index').first())).toBeGreaterThanOrEqual(4.5)
      const primary = page.locator('.hero-copy .primary')
      await expect(primary).toHaveCSS('background-color', css(tokens.accent))
      expect(await textContrast(primary)).toBeGreaterThanOrEqual(4.5)
      await primary.hover()
      await expect(primary).toHaveCSS('background-color', css(tokens['accent-hover']))
      expect(await textContrast(primary)).toBeGreaterThanOrEqual(4.5)
      await page.getByLabel('Accent', { exact: true }).focus()
      await page.keyboard.press('Tab')
      await page.keyboard.press('Shift+Tab')
      await expect(page.getByLabel('Accent', { exact: true })).toHaveCSS('outline-color', css(tokens.accent))
      await expect(page.getByLabel('Accent', { exact: true })).toHaveCSS('outline-width', '3px')
      await expect(page.locator('.local-dot')).toHaveCSS('background-color', css(tokens.success))
      await page.screenshot({ path: testInfo.outputPath(`${accent.id}-${theme}.png`) })
      await page.getByRole('link', { name: 'Roadmap', exact: true }).click()
      const selectedFilter = page.getByRole('button', { name: 'All tracks', exact: true })
      await expect(selectedFilter).toHaveCSS('color', css(tokens['accent-on-soft']))
      expect(await textContrast(selectedFilter)).toBeGreaterThanOrEqual(4.5)
      await page.getByRole('article').first().getByRole('button', { name: 'Start lesson' }).click()
      await expect(page.locator('.study-steps [aria-current="step"]')).toHaveCSS('color', css(tokens['accent-on-soft']))
      await page.getByRole('button', { name: 'Continue to practice' }).click()
      expect(await textContrast(page.getByRole('button', { name: 'Core task', exact: true }))).toBeGreaterThanOrEqual(4.5)
      await page.goto(`./?scoutTheme=${theme}#progress`)
      await page.getByLabel('Import progress JSON').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{') })
      await expect(page.getByRole('alert')).toHaveCSS('border-left-color', css(tokens.danger))
    })
  }
}

test('the saved accent initializes before the application module loads', async ({ page }) => {
  await page.addInitScript(key => localStorage.setItem(key, 'forest'), ACCENT_KEY)
  await page.route('**/assets/index-*.js', route => route.abort())
  await page.goto('./?scoutTheme=light')
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'forest')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  expect(await page.locator('#root').textContent()).toBe('')
})

test('selection reloads independently of light/dark/system and leaves study backups unchanged', async ({ page }) => {
  await page.addInitScript(({ key, backup }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(backup))
  }, { key: STORAGE_KEY, backup: { ...legacyBackup, selectedPath: 'senior' } })
  await page.goto('./')
  const before = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)
  for (const accent of accents) {
    await page.getByLabel('Accent', { exact: true }).selectOption(accent.id)
    await page.reload()
    await expect(page.getByLabel('Accent', { exact: true })).toHaveValue(accent.id)
    expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(before)
  }
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('./?scoutTheme=light')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'purple')
  await page.getByRole('button', { name: 'Toggle color theme' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'purple')
  await page.goto('./')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.goto('./#progress')
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export backup' }).click()
  const downloaded = await downloading
  await page.getByLabel('Accent', { exact: true }).selectOption('blue')
  await page.getByLabel('Import progress JSON').setInputFiles((await downloaded.path())!)
  await page.getByRole('button', { name: 'Replace progress' }).click()
  await expect(page.getByLabel('Accent', { exact: true })).toHaveValue('blue')
  expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(before)
  await page.getByRole('button', { name: 'Resume session' }).click()
  await expect(page.getByText(legacyBackup.session.draft, { exact: true })).toBeVisible()
  await expect(page.getByRole('checkbox').first()).toBeChecked()
})

test('missing and invalid accents default to red without silently rewriting storage', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByLabel('Accent', { exact: true })).toHaveValue('red')
  expect(await page.evaluate(key => localStorage.getItem(key), ACCENT_KEY)).toBeNull()
  await page.evaluate(key => localStorage.setItem(key, 'amber'), ACCENT_KEY)
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('saved accent preference is invalid')
  expect(await page.evaluate(key => localStorage.getItem(key), ACCENT_KEY)).toBe('amber')
  await page.getByRole('button', { name: 'Save current accent' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(await page.evaluate(key => localStorage.getItem(key), ACCENT_KEY)).toBe('red')
})

test('accent read failure is visible without blocking or resetting study data', async ({ page }) => {
  await page.addInitScript(({ accentKey, progressKey, backup }) => {
    localStorage.setItem(progressKey, JSON.stringify(backup))
    localStorage.setItem(accentKey, 'blue')
    const original = Storage.prototype.getItem
    Storage.prototype.getItem = function (key) {
      if (key === accentKey) throw new DOMException('Denied accent storage', 'SecurityError')
      return original.call(this, key)
    }
  }, { accentKey: ACCENT_KEY, progressKey: STORAGE_KEY, backup: legacyBackup })
  await page.goto('./')
  await expect(page.getByRole('alert')).toContainText('accent preference could not be read')
  await expect(page.getByLabel('Accent', { exact: true })).toHaveValue('red')
  await page.getByRole('button', { name: 'Resume session' }).click()
  await expect(page.getByText(legacyBackup.session.draft, { exact: true })).toBeVisible()
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY)).toEqual(legacyBackup)
})

test('failed accent writes retain the old value and can be retried without touching progress', async ({ page }) => {
  await page.addInitScript(({ key, backup }) => localStorage.setItem(key, JSON.stringify(backup)), { key: STORAGE_KEY, backup: legacyBackup })
  await page.goto('./')
  await page.getByLabel('Accent', { exact: true }).selectOption('blue')
  await page.evaluate(accentKey => {
    const original = Storage.prototype.setItem
    Object.defineProperty(window, 'restoreAccentStorage', { value: () => { Storage.prototype.setItem = original } })
    Storage.prototype.setItem = function (key, value) {
      if (key === accentKey) throw new DOMException('Storage full', 'QuotaExceededError')
      original.call(this, key, value)
    }
  }, ACCENT_KEY)
  await page.getByLabel('Accent', { exact: true }).selectOption('purple')
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'purple')
  await expect(page.getByRole('alert')).toContainText('Accent was not saved')
  expect(await page.evaluate(key => localStorage.getItem(key), ACCENT_KEY)).toBe('blue')
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY)).toEqual(legacyBackup)
  await page.evaluate(() => { (window as unknown as { restoreAccentStorage: () => void }).restoreAccentStorage() })
  await page.getByRole('button', { name: 'Save current accent' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(await page.evaluate(key => localStorage.getItem(key), ACCENT_KEY)).toBe('purple')
})

test('another tab changing an accent does not trigger a study-progress conflict', async ({ page, context }) => {
  await page.goto('./')
  const other = await context.newPage()
  await other.goto('./')
  await other.getByLabel('Accent', { exact: true }).selectOption('forest')
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.reload()
  await expect(page.getByLabel('Accent', { exact: true })).toHaveValue('forest')
})

test('all accents are keyboard/touch accessible at a narrow custom-domain root', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 })
  await page.goto('/')
  const selector = page.getByLabel('Accent', { exact: true })
  await selector.focus()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await expect(selector).toHaveValue('purple')
  await expect(selector).toBeFocused()
  expect((await selector.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  for (const accent of accents) {
    await selector.selectOption(accent.id)
    await page.getByRole('link', { name: 'Roadmap', exact: true }).click()
    await page.reload()
    await expect(selector).toHaveValue(accent.id)
    expect(new URL(page.url()).pathname).toBe('/')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
})
