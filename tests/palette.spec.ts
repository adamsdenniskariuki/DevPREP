import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { ACCENT_KEY, accents } from '../src/accent-preference'
import type { NavIndex } from '../src/nav-model'
import { emptyProgress, recordSolve, serializeBackup, STORAGE_KEY } from '../src/progress'
import { color, contrast, textContrast } from './contrast'

const index: NavIndex = JSON.parse(readFileSync(new URL('../src/generated/nav-index.json', import.meta.url), 'utf8'))
const heading = (page: Page) => page.getByRole('heading', { level: 1 })
const palette = (page: Page) => page.getByRole('dialog', { name: 'Search DevPREP' })
const combobox = (page: Page) => palette(page).getByRole('combobox')
const listbox = (page: Page) => palette(page).getByRole('listbox', { name: 'Results' })
const searchButton = (page: Page) => page.getByRole('banner').getByRole('button', { name: 'Search', exact: true })
const axe = async (page: Page) => (await new AxeBuilder({ page }).exclude('.cm-scroller').analyze()).violations.map(violation => ({ id: violation.id, targets: violation.nodes.map(node => node.target.join(' ')) }))
const MOD = process.platform === 'darwin' ? 'Meta' : 'Control'

async function open(page: Page, hash: string) {
  await page.goto(`./${hash}`)
  await expect(heading(page)).toBeVisible()
  await expect(heading(page)).not.toHaveText(/^Loading/)
}

test.describe('command palette', () => {
  test('Ctrl+K opens a modal combobox from anywhere, and Escape closes it and restores focus', async ({ page }) => {
    await open(page, '#home')
    const search = searchButton(page)
    await expect(search).toBeVisible()
    await expect(search).toHaveAttribute('aria-keyshortcuts', /Control\+K/)
    await search.focus()
    await page.keyboard.press(`${MOD}+k`)
    await expect(palette(page)).toBeVisible()
    await expect(combobox(page)).toBeFocused()
    await expect(combobox(page)).toHaveAttribute('aria-expanded', 'true')
    await expect(combobox(page)).toHaveAttribute('aria-controls', 'palette-list')
    await expect(palette(page).getByRole('group', { name: 'Suggested' })).toBeVisible()
    await expect(palette(page).getByRole('option', { name: /^Site map/ })).toBeVisible()
    const first = listbox(page).getByRole('option').first()
    await expect(first).toHaveAttribute('aria-selected', 'true')
    await expect(combobox(page)).toHaveAttribute('aria-activedescendant', (await first.getAttribute('id'))!)
    expect(await page.evaluate(() => document.querySelector('main')!.closest('[inert]') !== null || !document.querySelector('dialog.palette')!.matches(':modal'))).toBe(false)

    for (let step = 0; step < 4; step++) {
      await page.keyboard.press('Tab')
      expect(await palette(page).evaluate(element => element.contains(document.activeElement))).toBe(true)
    }
    for (let step = 0; step < 4; step++) {
      await page.keyboard.press('Shift+Tab')
      expect(await palette(page).evaluate(element => element.contains(document.activeElement))).toBe(true)
    }
    await combobox(page).focus()
    await page.keyboard.press('Escape')
    await expect(palette(page)).toBeHidden()
    await expect(search).toBeFocused()
    await expect(page).toHaveURL(/#home$/)

    // From a field that is not the opener, and back again with the close button.
    await page.locator('main').getByRole('link').first().focus()
    const link = page.locator(':focus')
    await page.keyboard.press(`${MOD}+k`)
    await expect(palette(page)).toBeVisible()
    await palette(page).getByRole('button', { name: 'Close search' }).click()
    await expect(palette(page)).toBeHidden()
    await expect(link).toBeFocused()
  })

  test('typing groups fuzzy results by type, and the arrows and Enter open the chosen page', async ({ page }) => {
    const [id, title, pattern] = index.problems.find(([, name]) => name.length > 8)!
    await open(page, '#home')
    await searchButton(page).click()
    await expect(combobox(page)).toBeFocused()
    await combobox(page).fill(title)
    const problems = palette(page).getByRole('group', { name: /^Coding problems/ })
    await expect(problems).toBeVisible()
    const option = problems.getByRole('option').first()
    await expect(option).toHaveText(new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
    await expect(option).toContainText(pattern)
    await expect(palette(page).getByRole('status')).toHaveText(/\d+ results?/)
    const options = listbox(page).getByRole('option')
    const position = await options.evaluateAll((items, target) => items.findIndex(item => item.querySelector('.palette-option-title')!.textContent === target), title)
    expect(position).toBeGreaterThanOrEqual(0)
    await expect(options.nth(0)).toHaveAttribute('aria-selected', 'true')

    // Wrap up from the top, then come back down to the problem.
    const count = await options.count()
    await page.keyboard.press('ArrowUp')
    await expect(options.nth(count - 1)).toHaveAttribute('aria-selected', 'true')
    await expect(combobox(page)).toHaveAttribute('aria-activedescendant', (await options.nth(count - 1).getAttribute('id'))!)
    await page.keyboard.press('ArrowDown')
    for (let step = 0; step < position; step++) await page.keyboard.press('ArrowDown')
    await expect(options.nth(position)).toHaveAttribute('aria-selected', 'true')
    await expect(options.filter({ has: page.locator('[aria-selected="true"]') })).toHaveCount(0)
    await expect(listbox(page).locator('[aria-selected="true"]')).toHaveCount(1)
    await page.keyboard.press('Enter')
    await expect(palette(page)).toBeHidden()
    await expect(page).toHaveURL(new RegExp(`#code/${id}$`))
    await expect(heading(page)).toHaveText(title)
    await expect(heading(page)).toBeFocused()

    // It remembers where you went.
    await page.keyboard.press(`${MOD}+k`)
    await expect(palette(page).getByRole('group', { name: 'Recent' }).getByRole('option').first()).toHaveText(new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
    await page.keyboard.press('Escape')
    await expect(palette(page)).toBeHidden()
  })

  test('searches every kind of destination and says when nothing matches', async ({ page }) => {
    await open(page, '#home')
    await page.keyboard.press(`${MOD}+k`)
    const groups = palette(page).getByRole('group')
    const [guide] = index.guides.filter(([, , , kind]) => kind === 'guide')
    for (const [query, group] of [
      [index.patterns[0][1], /^Patterns/], [guide[1], /^Field Guide/], [index.cases[0][1], /^Design cases/],
      [index.companies[0][1], /^Companies/], [index.sql[0][1], /^SQL problems/], ['settings', /^Pages/],
      [index.antipatterns[0][1], /^Anti-patterns/], [index.decks[0][1], /^Flashcard decks/], [index.tracks[0][1], /^Tracks/],
    ] as const) {
      await combobox(page).fill(query)
      await expect(groups.filter({ hasText: group }).first(), query).toBeVisible()
    }
    await combobox(page).fill('zzqqxxjj')
    await expect(combobox(page)).toHaveAttribute('aria-expanded', 'false')
    await expect(combobox(page)).not.toHaveAttribute('aria-activedescendant')
    await expect(palette(page).getByRole('status')).toHaveText('No matches for “zzqqxxjj”.')
    await combobox(page).fill('site map')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/#map$/)
    await expect(heading(page)).toHaveText('Site map')
  })

  test('Ctrl+K works while typing in the code editor without changing the code', async ({ page }) => {
    const [id] = index.problems[0]
    await open(page, `#code/${id}`)
    const editor = page.locator('.cm-content').first()
    await editor.click()
    await page.keyboard.type('xy')
    const before = await editor.textContent()
    await page.keyboard.press(`${MOD}+k`)
    await expect(palette(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(palette(page)).toBeHidden()
    await expect(editor).toBeFocused()
    await page.keyboard.type('z')
    expect(await editor.textContent()).toBe(before!.replace('xy', 'xyz'))
  })
})

test.describe('site map', () => {
  test('shows every group, section progress and a diagram, with long lists folded', async ({ page }) => {
    await open(page, '#map')
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('listitem')).toHaveText(['Me', 'Site map'])
    const groups = page.locator('.map-group')
    await expect(groups.getByRole('heading', { level: 2 })).toHaveText(['Learn', 'Practise', 'Design', 'Interview', 'Me'])
    const diagram = page.getByRole('img', { name: /DevPREP at a glance/ }).locator('visible=true')
    await expect(diagram).toHaveCount(1)
    await expect(page.locator('figure.map-figure figcaption')).toBeVisible()
    for (const label of ['Learn', 'Practise', 'Design', 'Interview', 'Me']) await expect(diagram.locator('text', { hasText: new RegExp(`^${label}$`) })).toHaveCount(1)

    const problems = page.getByRole('progressbar', { name: 'Coding problems progress' })
    await expect(problems).toBeVisible()
    await expect(problems).toHaveAttribute('max', String(index.problems.length))
    const section = page.locator('.map-section').filter({ has: problems })
    await expect(section.locator('.map-count')).toHaveText(`0/${index.problems.length}`)
    const counts = await page.locator('.map-count').count()
    expect(counts).toBeGreaterThanOrEqual(7)
    await expect(page.locator('.map-groups').getByRole('progressbar')).toHaveCount(counts)
    for (const bar of await page.locator('.map-groups').getByRole('progressbar').all()) await expect(bar).toHaveAccessibleName(/ progress$/)

    const details = section.locator('details')
    await expect(details.locator('summary')).toHaveText(/^Show \d+ items$/)
    await expect(details.getByRole('link', { name: index.problems[0][1], exact: true })).toBeHidden()
    await details.locator('summary').click()
    const link = details.getByRole('link', { name: index.problems[0][1], exact: true })
    await expect(link).toBeVisible()
    await link.click()
    await expect(page).toHaveURL(new RegExp(`#code/${index.problems[0][0]}$`))
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })

  test('counts finished work in the bars, the diagram and the item lists', async ({ page }) => {
    const [id, title] = index.problems[0]
    const saved = serializeBackup(recordSolve(emptyProgress(), id, 'py'))
    await page.addInitScript(({ key, value }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, value) }, { key: STORAGE_KEY, value: saved })
    await open(page, '#map')
    const problems = page.getByRole('progressbar', { name: 'Coding problems progress' })
    await expect(problems).toHaveAttribute('value', '1')
    await expect(problems).toHaveAttribute('aria-valuetext', `1 of ${index.problems.length} done`)
    await expect(page.locator('.map-section').filter({ has: problems }).locator('.map-count')).toHaveText(`1/${index.problems.length}`)
    await expect(page.locator('.map-svg:visible text', { hasText: `1/${index.problems.length}` })).toHaveCount(1)
    const section = page.locator('.map-section').filter({ has: problems })
    await section.locator('summary').click()
    const item = section.locator('li', { has: page.getByRole('link', { name: title, exact: true }) }).last()
    await expect(item.locator('.map-done')).toHaveText('done')
  })
})
test.describe('palette and site map accessibility', () => {
  for (const width of [360, 768, 1440]) {
    for (const theme of ['light', 'dark']) {
      test(`axe finds no violations in the palette and site map at ${width}px ${theme}`, async ({ page }) => {
        test.slow()
        await page.setViewportSize({ width, height: 900 })
        await page.goto(`./?scoutTheme=${theme}#map`)
        await expect(heading(page)).toHaveText('Site map')
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
        await expect(page.getByRole('progressbar', { name: 'Coding problems progress' })).toBeVisible()
        for (const details of await page.locator('.map-details').all()) await details.locator('summary').click()
        expect(await axe(page), `#map at ${width} ${theme}`).toEqual([])

        await searchButton(page).click()
        await expect(palette(page)).toBeVisible()
        expect(await axe(page), `empty palette at ${width} ${theme}`).toEqual([])
        await combobox(page).fill(index.problems[0][1].slice(0, 4))
        await expect(palette(page).getByRole('group').first()).toBeVisible()
        await page.keyboard.press('ArrowDown')
        expect(await axe(page), `palette results at ${width} ${theme}`).toEqual([])
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      })
    }
  }
})

/** The contrast of an SVG text's fill against the fill of the shape it sits on. */
async function svgContrast(text: Locator, shape: Locator) {
  const [foreground, background] = await Promise.all([text.evaluate(element => getComputedStyle(element).fill), shape.evaluate(element => getComputedStyle(element).fill)])
  return contrast(color(foreground), color(background))
}

test.describe('palette and site map contrast', () => {
  for (const theme of ['light', 'dark']) {
    for (const accent of accents) {
      test(`text is readable in ${theme} ${accent.label}`, async ({ page }) => {
        await page.addInitScript(({ key, id }) => localStorage.setItem(key, id), { key: ACCENT_KEY, id: accent.id })
        await page.goto(`./?scoutTheme=${theme}#map`)
        await expect(heading(page)).toHaveText('Site map')
        const diagram = page.locator('.map-svg:visible')
        await expect(diagram.locator('.map-muted').first()).toBeVisible()
        for (const [text, shape] of [['.map-root-text', '.map-root'], ['.map-head-text', '.map-head'], ['.map-row-text', '.map-row'], ['.map-muted', '.map-row'], ['.map-muted', '.map-head']]) {
          expect(await svgContrast(diagram.locator(text).first(), diagram.locator(shape).first()), `${text} on ${shape}`).toBeGreaterThanOrEqual(4.5)
        }
        for (const check of [page.locator('.map-count').first(), page.locator('.map-details summary').first(), page.locator('.map-section h3 a').first(), page.locator('figure.map-figure figcaption')]) {
          expect(await textContrast(check), await check.evaluate(element => element.className || element.tagName)).toBeGreaterThanOrEqual(4.5)
        }

        await searchButton(page).click()
        await combobox(page).fill(index.problems[0][1].slice(0, 4))
        await expect(palette(page).locator('.palette-option-detail').first()).toBeVisible()
        for (const check of [
          searchButton(page).locator('kbd').first(),
          palette(page).locator('.palette-option[aria-selected="true"] .palette-option-title'),
          palette(page).locator('.palette-option[aria-selected="true"] .palette-option-detail').first(),
          palette(page).locator('.palette-option[aria-selected="false"] .palette-option-title').first(),
          palette(page).locator('.palette-option[aria-selected="false"] .palette-option-detail').first(),
          palette(page).locator('.palette-group-label').first(),
          palette(page).locator('.palette-hint'),
          combobox(page),
        ]) {
          if (!await check.count() || !await check.isVisible()) continue
          expect(await textContrast(check), await check.evaluate(element => element.className || element.tagName)).toBeGreaterThanOrEqual(4.5)
        }
      })
    }
  }
})
