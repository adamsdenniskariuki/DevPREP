import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { palettes } from '../src/appearance'
import { color, contrast, over } from './contrast'

const PROGRESS_KEY = 'devprep.progress.v1'
const read = (path: string) => JSON.parse(readFileSync(new URL(`../content/field-guide/${path}`, import.meta.url), 'utf8'))
const index: { guides: string[] } = read('index.json')
const entries = index.guides.map(id => read(`${id}.json`))
const entry = entries.find(item => item.diagrams.some((diagram: { steps?: unknown[]; type: string }) => diagram.steps || diagram.type === 'sequence'))!

async function openEntry(page: Page, item = entry) {
  await page.goto('./#guide')
  await expect(page.getByRole('heading', { level: 1, name: 'Field Guide' })).toBeVisible()
  await page.getByRole('link', { name: item.title }).click()
  await expect(page.getByRole('heading', { level: 1, name: item.title })).toBeFocused()
  await expect(page.locator('.dg-figure')).toHaveCount(item.diagrams.length)
}

test('the Field Guide is in the main navigation and lists every entry with filters', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('link', { name: 'Field Guide', exact: true }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Field Guide' })).toBeFocused()
  await expect(page.locator('.fg-card')).toHaveCount(entries.length)
  const cases = entries.filter(item => item.kind === 'case').length
  await page.getByRole('radio', { name: 'Case studies' }).check()
  await expect(page.locator('.fg-card')).toHaveCount(cases)
  await page.getByRole('radio', { name: 'All', exact: true }).first().check()
  await page.getByRole('radio', { name: 'Guides' }).check()
  await expect(page.locator('.fg-card')).toHaveCount(entries.length - cases)
})

test('an entry renders every diagram with a title, accessible name, caption and text description', async ({ page }) => {
  await openEntry(page)
  for (const diagram of entry.diagrams) {
    const figure = page.locator(`#fig-${diagram.id}`)
    await expect(figure.locator('.dg-title')).toContainText(diagram.title)
    await expect(figure.locator('figcaption')).toContainText(diagram.caption.slice(0, 40))
    await expect(figure.locator('svg[role="img"]').first()).toHaveAttribute('aria-label', /.+/)
    await figure.getByText('Text description').click()
    await expect(figure.locator('.dg-description li').first()).toBeVisible()
  }
  expect(await page.locator('svg text').evaluateAll(nodes => nodes.filter(node => !node.textContent?.trim()).length)).toBe(0)
})

test('a step-through walks the request one step at a time, and Play is hidden with reduced motion', async ({ page }) => {
  await openEntry(page)
  const figure = page.locator('.dg-figure').filter({ has: page.locator('.dg-steps') }).first()
  await expect(figure.getByRole('button', { name: 'Play' })).toBeVisible()
  await figure.getByRole('button', { name: 'Step through' }).click()
  await expect(figure.locator('.dg-step-text')).toContainText('Step 1 of')
  await figure.getByRole('button', { name: 'Next' }).click()
  await expect(figure.locator('.dg-step-text')).toContainText('Step 2 of')
  await expect(figure.locator('.is-active').first()).toBeAttached()
  await figure.getByRole('button', { name: 'Show all' }).click()
  await expect(figure.locator('.is-active')).toHaveCount(0)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await expect(page.locator('.dg-steps').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Play' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Step through' }).first().click()
  const animated = await page.locator('.dg-edge.is-active .dg-line').first().evaluate(node => getComputedStyle(node).animationName)
  expect(animated).toBe('none')
})

test('finishing the quiz scores it, awards XP once, marks the entry read and survives a reload', async ({ page }) => {
  await openEntry(page)
  const questions = page.locator('.fg-questions > li')
  await expect(page.getByRole('button', { name: 'Check answers' })).toBeDisabled()
  for (const [q, item] of entry.quiz.entries()) await questions.nth(q).getByRole('radio').nth(item.answer).check()
  await page.getByRole('button', { name: 'Check answers' }).click()
  await expect(page.locator('.fg-quiz-result')).toContainText('100% correct · +20 XP')
  await expect(page.locator('.fg-explain')).toHaveCount(entry.quiz.length)
  await page.reload()
  await expect(page.getByText('Best 100%')).toBeVisible()
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), PROGRESS_KEY)
  expect(saved.guides[entry.id].best).toBe(100)

  for (const [q, item] of entry.quiz.entries()) await questions.nth(q).getByRole('radio').nth(item.answer).check()
  await page.getByRole('button', { name: 'Check answers' }).click()
  await expect(page.locator('.fg-quiz-result')).toHaveText(/^100% correct/)
  await expect(page.locator('.fg-quiz-result')).not.toContainText('XP')

  await page.getByRole('link', { name: 'Field Guide', exact: true }).first().click()
  await expect(page.locator('.fg-card').filter({ hasText: entry.title })).toContainText('Read')
})

test('related links open lessons, problems, design cases and guides', async ({ page }) => {
  await openEntry(page)
  const related = page.locator('.fg-related')
  if (entry.links.cases?.length) {
    await related.getByRole('link', { name: /^Design case:/ }).first().click()
    await expect(page).toHaveURL(new RegExp(`#design/${entry.links.cases[0]}$`))
    await page.goBack()
  }
  if (entry.links.lessons?.length) {
    await related.getByRole('button', { name: /^Lesson:/ }).first().click()
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
  }
})

test('the anti-pattern gallery shows bad and better side by side with a link back to the source', async ({ page }) => {
  await page.goto('./#guide')
  await page.getByRole('link', { name: /Anti-pattern gallery/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Anti-pattern gallery' })).toBeFocused()
  const total = entries.filter(item => item.kind === 'guide').reduce((sum, item) => sum + item.antipatterns.length, 0)
  await expect(page.locator('.fg-anti')).toHaveCount(total)
  await expect(page.locator('.fg-anti').first().getByRole('link', { name: entries.find(item => item.kind === 'guide').title })).toBeVisible()
  expect(await page.evaluate(() => new Set([...document.querySelectorAll('[id]')].map(node => node.id)).size === document.querySelectorAll('[id]').length)).toBe(true)
})

test('diagram text and lines stay readable in every palette, light and dark', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openEntry(page)
  for (const palette of palettes) {
    for (const theme of ['light', 'dark'] as const) {
      const sample = await page.evaluate(({ palette, theme }) => {
        const root = document.documentElement
        root.dataset.palette = palette
        root.dataset.theme = theme
        const surface = getComputedStyle(document.querySelector('.dg-scroll')!).backgroundColor
        const texts = [...document.querySelectorAll('.dg-svg text')].map(node => {
          const holder = node.closest('.dg-node')?.querySelector('.dg-box') ?? node.closest('.dg-badge')?.querySelector('circle')
          return { name: `${node.getAttribute('class')} "${node.textContent}"`, fill: getComputedStyle(node).fill, behind: holder ? getComputedStyle(holder).fill : surface }
        })
        const lines = [...document.querySelectorAll('.dg-edge:not(.is-dim) .dg-line, .dg-axis, .dg-head:not(.is-dim *)')].map(node => ({ name: node.getAttribute('class')!, paint: node.classList.contains('dg-head') ? getComputedStyle(node).fill : getComputedStyle(node).stroke }))
        const style = getComputedStyle(root)
        const status = ['--dg-bad', '--dg-good', '--dg-warn'].map(name => ({ name, paint: style.getPropertyValue(name).trim() }))
        return { surface, texts, lines, status }
      }, { palette: palette.id, theme })
      const label = `${palette.id}/${theme}`
      const surface = color(sample.surface)
      expect(sample.texts.length).toBeGreaterThan(10)
      for (const text of sample.texts) {
        const behind = over(color(text.behind === 'none' ? sample.surface : text.behind), surface)
        expect(contrast(over(color(text.fill), behind), behind), `${label} ${text.name}`).toBeGreaterThanOrEqual(4.5)
      }
      for (const line of [...sample.lines, ...sample.status]) {
        expect(contrast(over(color(line.paint), surface), surface), `${label} ${line.name}`).toBeGreaterThanOrEqual(3)
      }
    }
  }
})

for (const width of [360, 768, 1440]) {
  test(`the Field Guide fits without sideways scrolling at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    for (const hash of ['#guide', `#guide/${entry.id}`, '#antipatterns']) {
      await page.goto(`./${hash}`)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expect(page.getByText('Loading the Field Guide…')).toHaveCount(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${hash} at ${width}`).toBe(true)
      const clipped = await page.locator('.nav-item:visible').evaluateAll(items => items.filter(item => item.scrollWidth > item.clientWidth + 1).map(item => item.textContent))
      expect(clipped, `nav labels at ${width}`).toEqual([])
    }
    const svgWidth = await page.goto(`./#guide/${entry.id}`).then(() => page.locator('.dg-svg').first().evaluate(node => node.getBoundingClientRect().width))
    expect(svgWidth).toBeGreaterThan(Math.min(width - 80, 300))
  })
}

test('every entry renders all its diagrams and fits a 360px screen', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  for (const item of entries) {
    await page.goto(`./#guide/${item.id}`)
    await expect(page.getByRole('heading', { level: 1, name: item.title })).toBeVisible()
    await expect(page.locator('.dg-figure'), item.id).toHaveCount(item.diagrams.length)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), item.id).toBe(true)
  }
})
