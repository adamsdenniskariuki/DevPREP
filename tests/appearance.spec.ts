import { expect, test } from '@playwright/test'
import { ACCENT_KEY, accents } from '../src/accent-preference'
import { color, contrast } from './contrast'

test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } })

for (const theme of ['light', 'dark']) {
  for (const accent of accents) {
    test(`${theme} ${accent.label}: menu taps avoid the browser rectangle and retain thin keyboard focus`, async ({ page }) => {
      await page.addInitScript(({ key, id }) => localStorage.setItem(key, id), { key: ACCENT_KEY, id: accent.id })
      await page.goto(`./?scoutTheme=${theme}`)
      const menu = page.getByRole('link', { name: 'Roadmap', exact: true })
      await expect(menu).toHaveCSS('-webkit-tap-highlight-color', 'rgba(0, 0, 0, 0)')
      await expect(menu).toHaveCSS('box-shadow', 'none')
      await menu.tap()
      await expect(menu).toHaveClass(/active/)
      expect(await menu.evaluate(element => element.matches(':focus-visible'))).toBe(false)
      await expect(menu).toHaveCSS('outline-style', 'none')
      await menu.focus()
      await page.keyboard.press('Tab')
      await page.keyboard.press('Shift+Tab')
      await expect(menu).toBeFocused()
      await expect(menu).toHaveCSS('outline-width', '2px')
      await expect(menu).toHaveCSS('outline-offset', '2px')
      await expect(menu).toHaveCSS('outline-style', 'solid')
      const focus = await menu.evaluate(element => ({
        outline: getComputedStyle(element).outlineColor,
        surface: getComputedStyle(element.parentElement!.parentElement!).backgroundColor,
      }))
      expect(contrast(color(focus.outline), color(focus.surface))).toBeGreaterThanOrEqual(3)
      const filter = page.getByRole('button', { name: 'All tracks', exact: true })
      await expect(filter).toHaveCSS('-webkit-tap-highlight-color', 'rgba(0, 0, 0, 0)')
      await filter.tap()
      await expect(filter).toHaveAttribute('aria-pressed', 'true')
      await expect(page.locator('.pwa-panel > summary')).toHaveCSS('-webkit-tap-highlight-color', 'rgba(0, 0, 0, 0)')
      const select = page.getByLabel('Accent', { exact: true })
      await select.focus()
      await page.keyboard.press('Tab')
      await page.keyboard.press('Shift+Tab')
      await expect(select).toBeFocused()
      await expect(select).toHaveCSS('outline-width', '2px')
      expect(await select.evaluate(element => getComputedStyle(element).getPropertyValue('-webkit-tap-highlight-color'))).not.toBe('rgba(0, 0, 0, 0)')
      await page.getByRole('article').first().getByRole('button', { name: 'Start lesson' }).tap()
      await page.getByRole('button', { name: 'Continue to practice' }).tap()
      const answer = page.getByLabel('Your approach & answer')
      await answer.focus()
      await expect(answer).toHaveCSS('outline-width', '2px')
      await expect(answer).toHaveCSS('box-shadow', 'none')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    })
  }
}

test('unset users get purple before React; explicit saved red stays red', async ({ page }) => {
  await page.route('**/assets/index-*.js', route => route.abort())
  await page.goto('./?scoutTheme=light')
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'purple')
  expect(await page.evaluate(key => localStorage.getItem(key), ACCENT_KEY)).toBeNull()
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--cp-accent').trim())).toBe('#6b36a8')
  await page.evaluate(key => localStorage.setItem(key, 'red'), ACCENT_KEY)
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'red')
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--cp-accent').trim())).toBe('#b11f4b')
  await page.evaluate(() => document.documentElement.removeAttribute('data-accent'))
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--cp-accent').trim())).toBe('#6b36a8')
})
