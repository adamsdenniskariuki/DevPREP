import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { palettes } from '../src/appearance'
import { codeOf, expectCode } from './editor-helpers'
import { textContrast } from './contrast'

const PROGRESS_KEY = 'devprep.progress.v1'
const read = (path: string) => JSON.parse(readFileSync(new URL(`../content/patterns/${path}`, import.meta.url), 'utf8'))
const order: string[] = read('index.json').patterns
const pages = order.map(id => read(`${id}.json`))
const hashing = pages[0]
const SECTIONS = ['Recognise it', 'Picture it', 'Watch it run', 'Template', 'Try it', 'Complexity', 'Common mistakes', 'Quick check']

async function openPage(page: Page, item = hashing) {
  await page.goto(`./#patterns/${item.id}`)
  await expect(page.getByRole('heading', { level: 1, name: item.title })).toBeVisible()
  await expect(page.locator('.pv-stage')).toBeVisible()
}

const saved = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{}'), PROGRESS_KEY)
const activeLine = (page: Page) => page.locator('.pv-code [data-active-line]').getAttribute('data-active-line')

test('the course home lists pages in learning order and opens from Practice', async ({ page }) => {
  await page.goto('./#practice')
  await page.getByRole('link', { name: /^Patterns/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Algorithm patterns' })).toBeFocused()
  await expect(page.locator('.pattern-row h3')).toHaveText(pages.map(item => item.title))
  await expect(page.getByRole('link', { name: /Pattern picker/ })).toHaveAttribute('href', '#patterns/pick')
  await expect(page.getByRole('link', { name: /Cheat sheet/ })).toHaveAttribute('href', '#patterns/cheatsheet')
  await page.getByRole('link', { name: hashing.title, exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: hashing.title })).toBeFocused()
  await expect(page.getByRole('link', { name: 'Practice', exact: true }).first()).toHaveAttribute('class', /active/)
})

test('a pattern page shows all 8 sections in order', async ({ page }) => {
  await openPage(page)
  await expect(page.locator('.pattern-section > h2')).toHaveText(SECTIONS.map((title, i) => `${i + 1}${title}`))
  await expect(page.locator('.pattern-section .dg-figure')).toHaveCount(1)
  for (const link of hashing.problems) await expect(page.locator(`.pattern-problems a[href="#code/${link.id}"]`)).toBeVisible()
  expect(await page.evaluate(() => new Set([...document.querySelectorAll('[id]')].map(node => node.id)).size === document.querySelectorAll('[id]').length)).toBe(true)
})

test('the visualiser steps with the keyboard and buttons, moving the highlighted line and live text', async ({ page }) => {
  await openPage(page)
  const live = page.locator('.pv-text')
  const stage = page.getByTestId('pv-stage')
  const vis = page.locator('.pv')
  await expect(live).toHaveAttribute('aria-live', 'polite')
  await expect(live).toContainText('Step 1 of')
  const first = await activeLine(page)
  expect(Number(first)).toBeGreaterThan(0)
  await stage.focus()
  await page.keyboard.press('ArrowRight')
  await expect(live).toContainText('Step 2 of')
  await expect.poll(() => activeLine(page)).not.toBe(first)
  await page.keyboard.press('ArrowLeft')
  await expect(live).toContainText('Step 1 of')
  await expect.poll(() => activeLine(page)).toBe(first)
  await page.keyboard.press('End')
  await expect(page.locator('.pv-vars')).toContainText('Result')
  await vis.getByRole('button', { name: 'Reset', exact: true }).click()
  await expect(live).toContainText('Step 1 of')
  await vis.getByRole('button', { name: 'Step', exact: true }).click()
  await expect(live).toContainText('Step 2 of')
  await vis.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(live).toContainText('Step 1 of')
  await vis.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(live).toContainText('Step 2 of', { timeout: 10_000 })
  await vis.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect(vis.getByRole('button', { name: 'Play', exact: true })).toHaveAttribute('aria-pressed', 'false')

  await page.getByRole('radio', { name: 'JavaScript', exact: true }).first().check()
  await expect.poll(() => codeOf(page.locator('.pv-code .cm-content'))).toContain('function')
  await page.locator('.pv-all summary').click()
  await expect(page.locator('.pv-all li').first()).toBeVisible()
})

test('custom visualiser input is validated with inline errors', async ({ page }) => {
  await openPage(page)
  const numbers = page.getByLabel('Numbers', { exact: true })
  await numbers.fill('1, two, 3')
  await page.getByRole('button', { name: 'Visualise my input' }).click()
  await expect(numbers).toHaveAttribute('aria-invalid', 'true')
  await expect(page.locator('.field-error')).toContainText('not a whole number')
  await expect(numbers).toHaveAttribute('aria-describedby', /error/)
  await numbers.fill('2, 8, 5')
  await page.getByLabel('Target sum', { exact: true }).fill('13')
  await page.getByRole('button', { name: 'Visualise my input' }).click()
  await expect(page.locator('.field-error')).toHaveCount(0)
  await expect(page.locator('.pv-text')).toContainText('add up to 13')
  await expect(page.locator('.pv-cells').first().locator('.pv-value')).toHaveCount(3)
  await page.getByRole('button', { name: hashing.visualiser.examples[1].label }).click()
  await expect(page.getByLabel('Numbers', { exact: true })).toHaveValue(hashing.visualiser.examples[1].input.nums)
})

test('the exercise fails the starter, passes the solution and awards XP once', async ({ page }) => {
  await openPage(page)
  await page.getByRole('radio', { name: 'JavaScript', exact: true }).nth(2).check()
  const editor = page.getByRole('textbox', { name: 'JavaScript code', exact: true })
  await expectCode(editor, hashing.exercise.starter.js)
  await page.getByRole('button', { name: 'Run tests' }).click()
  await expect(page.locator('.run-summary.fail, .run-summary:not(.pass)').first()).toBeVisible()
  await editor.fill(hashing.exercise.solution.js)
  await page.getByRole('button', { name: 'Run tests' }).click()
  await expect(page.locator('.run-results')).toContainText(/All \d+ tests passed · \+15 XP/)
  expect((await saved(page)).patterns[hashing.id].exercise.js).toBeTruthy()
  await page.getByRole('button', { name: 'Run tests' }).click()
  await expect(page.locator('.run-summary')).toHaveText(/^All \d+ tests passed\.$/)
})

test('the quick check grades on submit, shows explanations and is saved', async ({ page }) => {
  await openPage(page)
  const questions = page.locator('.fg-questions > li')
  await expect(questions).toHaveCount(3)
  const submit = page.getByRole('button', { name: 'Check answers' })
  await expect(submit).toBeDisabled()
  for (const [i, item] of hashing.quiz.entries()) await questions.nth(i).getByRole('radio').nth(item.answer).check()
  await submit.click()
  await expect(page.locator('.fg-quiz-result')).toContainText('100% correct · +15 XP')
  await expect(page.locator('.fg-explain')).toHaveCount(3)
  expect((await saved(page)).patterns[hashing.id].quiz.best).toBe(100)
})

test('a picker round asks 10 questions, explains each and saves the result', async ({ page }) => {
  await page.goto('./#patterns/pick')
  await expect(page.getByRole('heading', { level: 1, name: 'Which pattern?' })).toBeVisible()
  for (let i = 1; i <= 10; i++) {
    await expect(page.getByText(`QUESTION ${i} OF 10`)).toBeVisible()
    await expect(page.getByRole('radio')).toHaveCount(4)
    await page.getByRole('radio').first().check()
    await expect(page.locator('.picker-explain')).toBeVisible()
    await page.getByRole('button', { name: i < 10 ? 'Next question' : 'See results' }).click()
  }
  await expect(page.getByRole('heading', { level: 2, name: /You got \d+ of 10 · \+5 XP/ })).toBeVisible()
  await expect(page.locator('.picker-review > li')).toHaveCount(10)
  expect((await saved(page)).patternPicker.rounds).toBe(1)
  await page.getByRole('button', { name: 'New round' }).click()
  await expect(page.getByText('QUESTION 1 OF 10')).toBeVisible()
})

test('the cheat sheet lists every page and prints without the app chrome', async ({ page }) => {
  await page.goto('./#patterns/cheatsheet')
  await expect(page.getByRole('heading', { level: 1, name: 'Pattern cheat sheet' })).toBeVisible()
  await expect(page.locator('.cheat-sheet tbody tr')).toHaveCount(order.length)
  await expect(page.locator('.cheat-sheet tbody th')).toHaveText(pages.map(item => item.title))
  await expect(page.getByRole('button', { name: 'Print' })).toBeVisible()
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.sidebar')).toBeHidden()
  await expect(page.locator('.topbar')).toBeHidden()
  await expect(page.getByRole('button', { name: 'Print' })).toBeHidden()
  await expect(page.locator('.cheat-sheet')).toBeVisible()
})

test('a problem links to the pattern that teaches it', async ({ page }) => {
  const problem = hashing.problems[0].id
  await page.goto(`./#code/${problem}`)
  await page.getByRole('link', { name: `Learn the pattern: ${hashing.title}` }).click()
  await expect(page.getByRole('heading', { level: 1, name: hashing.title })).toBeFocused()
})

test('unknown pattern ids are not found', async ({ page }) => {
  await page.goto('./#patterns/not-a-pattern')
  await expect(page.getByRole('heading', { level: 1, name: 'This page isn’t on the roadmap.' })).toBeVisible()
})

test('the visualiser stays readable in every palette, light and dark', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openPage(page, pages.find(item => item.id === 'sliding-window'))
  await page.getByTestId('pv-stage').focus()
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight')
  await expect(page.locator('.pv-cell.in-window').first()).toBeVisible()
  const selectors = ['.pv-text', '.pv-array-label', '.pv-index', '.pv-cell.in-window .pv-value', '.pv-cell:not(.in-window) .pv-value', '.pv-pointer', '.pv-vars dd', '.pv-vars dt', '.pv-controls button.primary']
  for (const palette of palettes) {
    for (const theme of ['light', 'dark'] as const) {
      await page.evaluate(({ palette, theme }) => { document.documentElement.dataset.palette = palette; document.documentElement.dataset.theme = theme }, { palette: palette.id, theme })
      for (const selector of selectors) {
        expect(await textContrast(page.locator(selector).first()), `${palette.id}/${theme} ${selector}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  }
  await openPage(page)
  await page.getByTestId('pv-stage').focus()
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight')
  await expect(page.locator('.pv-entry').first()).toBeVisible()
  for (const palette of palettes) {
    for (const theme of ['light', 'dark'] as const) {
      await page.evaluate(({ palette, theme }) => { document.documentElement.dataset.palette = palette; document.documentElement.dataset.theme = theme }, { palette: palette.id, theme })
      for (const selector of ['.pv-entry', '.pv-entry.active']) {
        if (await page.locator(selector).count() === 0) continue
        expect(await textContrast(page.locator(selector).first()), `${palette.id}/${theme} ${selector}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  }
})

test('linked-list and stack visualisers stay readable in every palette, light and dark', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const checks: [string, string[]][] = [
    ['in-place-reversal', ['.pv-node .pv-value', '.pv-node .pv-next', '.pv-pointer', '.pv-node.marked .pv-value']],
    ['linked-lists', ['.pv-node .pv-value', '.pv-node.dropped .pv-value', '.pv-node .pv-next', '.pv-pointer']],
    ['monotonic-stack', ['.pv-cell .pv-value', '.pv-cell.marked .pv-value', '.pv-pointer', '.pv-array-label']],
  ]
  for (const [id, selectors] of checks) {
    await openPage(page, pages.find(item => item.id === id))
    await page.getByTestId('pv-stage').focus()
    for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight')
    await expect(page.locator(selectors[0]).first()).toBeVisible()
    for (const palette of palettes) {
      for (const theme of ['light', 'dark'] as const) {
        await page.evaluate(({ palette, theme }) => { document.documentElement.dataset.palette = palette; document.documentElement.dataset.theme = theme }, { palette: palette.id, theme })
        for (const selector of selectors) {
          if (await page.locator(selector).count() === 0) continue
          expect(await textContrast(page.locator(selector).first()), `${id} ${palette.id}/${theme} ${selector}`).toBeGreaterThanOrEqual(4.5)
        }
      }
    }
  }
})

test('sub-pattern pages link back to their parent and the parent lists them', async ({ page }) => {
  const parent = pages.find(item => item.id === 'stack')
  const children = pages.filter(item => item.parent === 'stack')
  expect(children.map(item => item.id)).toEqual(['basic-stack', 'monotonic-stack'])
  await openPage(page, parent)
  for (const child of children) await expect(page.locator(`a[href="#patterns/${child.id}"]`).first()).toBeVisible()
  await openPage(page, children[1])
  await expect(page.locator('a[href="#patterns/stack"]').first()).toBeVisible()
})

for (const width of [360, 768, 1440]) {
  test(`Patterns fit without sideways scrolling at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    for (const hash of ['#patterns', ...order.map(id => `#patterns/${id}`), '#patterns/pick', '#patterns/cheatsheet']) {
      await page.goto(`./${hash}`)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expect(page.getByText('Loading pattern…')).toHaveCount(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${hash} at ${width}`).toBe(true)
    }
  })
}
