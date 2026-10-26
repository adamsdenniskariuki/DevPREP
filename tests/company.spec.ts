import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { palettes } from '../src/appearance'
import { color, contrast, over } from './contrast'

const read = (path: string) => JSON.parse(readFileSync(new URL(`../content/${path}`, import.meta.url), 'utf8'))
const { companies: ids }: { companies: string[] } = read('companies/index.json')
const companies = ids.map(id => read(`companies/${id}.json`))
const google = companies[0]
const title = (id: string): string => read(`problems/${id}.json`).title

async function openCompany(page: Page, company = google) {
  await page.goto(`./#company/${company.id}`)
  await expect(page.getByRole('heading', { level: 1, name: company.name })).toBeFocused()
}

test('practice links to company prep, and a timed run can be started, worked and finished for XP', async ({ page }) => {
  await page.goto('./#practice')
  await page.getByRole('link', { name: /Company prep/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Company prep' })).toBeFocused()
  await expect(page.locator('.company-card')).toHaveCount(companies.length)
  await page.getByRole('link', { name: new RegExp(`^${google.name}`) }).click()
  await expect(page.getByRole('heading', { level: 1, name: google.name })).toBeFocused()
  await expect(page.getByRole('heading', { level: 2, name: 'Interview process' })).toBeVisible()
  await expect(page.locator('.company-stages > li')).toHaveCount(google.process.stages.length)

  await page.getByRole('button', { name: `Start ${google.practice.minutes}-minute practice` }).click()
  await expect(page.getByRole('timer')).toBeVisible()
  const picks = page.locator('.company-run-list > li')
  await expect(picks).toHaveCount(google.practice.count)
  const first = (await picks.first().getByRole('link').textContent())!.replace(/^Open /, '')
  await picks.first().getByRole('link').click()
  await expect(page.getByRole('heading', { level: 1, name: first })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('heading', { level: 1, name: google.name })).toBeFocused()
  await expect(page.getByRole('timer')).toBeVisible()
  await page.getByRole('checkbox', { name: `Done: ${first}` }).check()
  await page.getByRole('button', { name: 'Finish run' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Run saved' })).toContainText(`1 of ${google.practice.count} done`)
  await expect(page.getByRole('status').filter({ hasText: 'Run saved' })).toContainText('+20 XP')
  await expect(page.getByRole('timer')).toHaveCount(0)
  await expect(page.getByText(/Last run: 1 of/)).toBeVisible()
  await page.goto('./#company')
  await expect(page.locator('.page-heading .pill')).toHaveText(`1 of ${companies.length} practised`)
})

test('STAR notes are saved on the device and come back after a reload', async ({ page }) => {
  await openCompany(page)
  const prompt = google.values.prompts[0]
  const box = page.getByLabel(prompt.text)
  await box.fill('Situation: a flaky deploy. Action: added a canary. Result: no more rollbacks.')
  await page.reload()
  await expect(page.getByLabel(prompt.text)).toHaveValue(/added a canary/)
  await expect(page.getByLabel(google.values.prompts[1].text)).toHaveValue('')
})

test('both diagrams have accessible names, text descriptions and no axe violations', async ({ page }) => {
  await page.goto('./#company')
  await expect(page.getByRole('heading', { level: 1, name: 'Company prep' })).toBeVisible()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await openCompany(page)
  await expect(page.getByRole('figure', { name: `Figure 1: ${google.name} interview loop` })).toBeVisible()
  await expect(page.getByRole('figure', { name: `Figure 2: ${google.name} focus areas by reported emphasis` })).toBeVisible()
  await expect(page.getByRole('img', { name: `${google.name} interview loop` })).toBeVisible()
  await expect(page.getByRole('img', { name: `${google.name} focus areas by reported emphasis` })).toBeVisible()
  await expect(page.locator('details.dg-description')).toHaveCount(2)
  expect(await page.evaluate(() => new Set([...document.querySelectorAll('[id]')].map(node => node.id)).size === document.querySelectorAll('[id]').length)).toBe(true)
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
})

test('every company page renders its sections, links and practice set', async ({ page }) => {
  for (const company of companies) {
    await openCompany(page, company)
    await expect(page.locator('.dg-figure')).toHaveCount(2)
    await expect(page.locator('.company-set > li')).toHaveCount(company.practice.problems.length)
    await expect(page.locator('.company-set').getByRole('link', { name: title(company.practice.problems[0]) })).toBeVisible()
    await expect(page.locator('.company-prompts textarea')).toHaveCount(company.values.prompts.length)
    await expect(page.locator('.fg-sources > li')).toHaveCount(company.sources.length)
  }
  await page.goto('./#company/not-a-company')
  await expect(page.getByRole('heading', { level: 1, name: 'This page isn’t on the roadmap.' })).toBeVisible()
})

test('company diagram text, lines and bars stay readable in every palette, light and dark', async ({ page }) => {
  test.slow()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openCompany(page)
  for (const palette of palettes) {
    for (const theme of ['light', 'dark'] as const) {
      const sample = await page.evaluate(({ palette, theme }) => {
        const root = document.documentElement
        root.dataset.palette = palette
        root.dataset.theme = theme
        const surface = getComputedStyle(document.querySelector('.company-figure .dg-scroll')!).backgroundColor
        const texts = [...document.querySelectorAll('.company-svg text')].map(node => {
          const marker = node.closest('.co-stage')?.querySelector('.co-marker')
          const inMarker = marker && node.getAttribute('text-anchor') === 'middle'
          return { name: `${node.getAttribute('class')} "${node.textContent}"`, fill: getComputedStyle(node).fill, behind: inMarker ? getComputedStyle(marker).fill : surface }
        })
        const lines = [...document.querySelectorAll('.company-svg .dg-axis, .company-svg .co-marker, .company-svg .co-track')].map(node => ({ name: node.getAttribute('class')!, paint: getComputedStyle(node).stroke }))
        const bars = [...document.querySelectorAll('.company-svg .co-fill')].map(node => ({ name: 'co-fill', paint: getComputedStyle(node).fill }))
        return { surface, texts, lines: [...lines, ...bars] }
      }, { palette: palette.id, theme })
      const label = `${palette.id}/${theme}`
      const surface = color(sample.surface)
      expect(sample.texts.length).toBeGreaterThan(10)
      for (const text of sample.texts) {
        const behind = over(color(text.behind), surface)
        expect(contrast(over(color(text.fill), behind), behind), `${label} ${text.name}`).toBeGreaterThanOrEqual(4.5)
      }
      for (const line of sample.lines) {
        expect(contrast(over(color(line.paint), surface), surface), `${label} ${line.name}`).toBeGreaterThanOrEqual(3)
      }
    }
  }
})

for (const width of [360, 768, 1440]) {
  test(`company prep fits without sideways scrolling at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    for (const hash of ['#company', ...ids.map(id => `#company/${id}`)]) {
      await page.goto(`./${hash}`)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expect(page.getByText('Loading company prep…')).toHaveCount(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${hash} at ${width}`).toBe(true)
    }
    await page.goto(`./#company/${google.id}`)
    const svgWidth = await page.locator('.company-svg').first().evaluate(node => node.getBoundingClientRect().width)
    expect(svgWidth).toBeGreaterThan(Math.min(width - 80, 300))
  })
}
