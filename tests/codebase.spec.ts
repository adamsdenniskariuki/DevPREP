import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { expectCode, useEditor } from './editor-helpers'

const read = (path: string) => readFileSync(new URL(`../content/codebase/${path}`, import.meta.url), 'utf8')
const guide = JSON.parse(read('guide.json'))
const cart = JSON.parse(read('cart/repo.json'))
const task = cart.tasks.find((item: { id: string }) => item.id === 'repeat-add')
const starterCart = read('cart/tasks/repeat-add/starter/src/cart.ts')
const solution = {
  'src/cart.ts': read('cart/tasks/repeat-add/solution/src/cart.ts'),
  'tests/cart.test.ts': read('cart/tasks/repeat-add/solution/tests/cart.test.ts'),
}
const DRAFTS_KEY = 'devprep.codebase.drafts.v1'
const heading = (page: Page) => page.getByRole('heading', { level: 1 })
const axe = async (page: Page) => (await new AxeBuilder({ page }).exclude('.cm-scroller').analyze()).violations.map(violation => ({ id: violation.id, targets: violation.nodes.map(node => node.target.join(' ')) }))
const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
const tree = (page: Page) => page.getByRole('tree', { name: 'Files' })
const editor = (page: Page, path: string) => page.getByRole('textbox', { name: path, exact: true })

async function openTask(page: Page) {
  await page.goto('./#codebase/cart/repeat-add')
  await expect(heading(page)).toHaveText(task.title)
}

test('the guide shows the steps, the rubric and every practice codebase', async ({ page }) => {
  await page.goto('./#codebase')
  await expect(heading(page)).toHaveText(guide.title)
  await expect(heading(page)).toBeFocused()
  await expect(page.getByRole('heading', { name: 'The seven steps' })).toBeVisible()
  await expect(page.locator('.codebase-steps > li')).toHaveCount(guide.steps.length)
  await expect(page.getByRole('heading', { name: 'How you are scored' })).toBeVisible()
  await expect(page.locator('.codebase-repo')).toHaveCount(6)
  await expect(page.locator('.page-heading > .pill')).toHaveText('0 of 12 completed')
  await page.getByRole('link', { name: task.title }).click()
  await expect(page).toHaveURL(/#codebase\/cart\/repeat-add$/)
  await expect(heading(page)).toHaveText(task.title)
  expect(await noOverflow(page)).toBe(true)
})

test('an unknown task falls back to the not-found page', async ({ page }) => {
  await page.goto('./#codebase/cart/nope')
  await expect(heading(page)).toHaveText('This page isn’t on the roadmap.')
})

test('the file tree opens files, marks changes and keeps drafts across a reload', async ({ page }) => {
  await useEditor(page, 'plain')
  await openTask(page)
  await expect(tree(page).getByRole('treeitem', { name: /^cart\.ts/ })).toHaveAttribute('aria-selected', 'true')
  await expectCode(editor(page, 'src/cart.ts'), starterCart)

  await tree(page).getByRole('treeitem', { name: 'README.md' }).click()
  await expect(editor(page, 'README.md')).toBeVisible()
  await tree(page).getByRole('treeitem', { name: 'README.md' }).focus()
  await page.keyboard.press('Home')
  await expect(tree(page).getByRole('treeitem').first()).toBeFocused()

  await tree(page).getByRole('treeitem', { name: /^cart\.ts/ }).click()
  await editor(page, 'src/cart.ts').fill(solution['src/cart.ts'])
  await expect(tree(page).getByRole('img', { name: 'changed' })).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Reset all' })).toBeEnabled()

  await page.reload()
  await expect(heading(page)).toHaveText(task.title)
  await expectCode(editor(page, 'src/cart.ts'), solution['src/cart.ts'])
  await page.getByRole('button', { name: 'Reset all' }).click()
  await page.getByRole('button', { name: 'Confirm: reset every file' }).click()
  await expectCode(editor(page, 'src/cart.ts'), starterCart)
})

test('the timer starts, pauses and survives a reload', async ({ page }) => {
  await openTask(page)
  const timer = page.getByRole('timer')
  await expect(timer).toHaveText(/^0:00/)
  await page.getByRole('button', { name: 'Start timer' }).click()
  await expect(timer).toHaveText(/^0:0[1-9]/, { timeout: 5_000 })
  await page.getByRole('button', { name: 'Pause' }).click()
  const paused = await timer.innerText()
  await page.reload()
  await expect(page.getByRole('timer')).toHaveText(paused)
  await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible()
  await page.getByRole('button', { name: 'Reset timer' }).click()
  await expect(page.getByRole('timer')).toHaveText(/^0:00/)
})

test('Run shows progress; Submit opens the walkthrough, and the self-review lands in a plan', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The TypeScript runtime download is covered once.')
  test.setTimeout(180_000)
  await openTask(page)
  await expect(page.getByRole('heading', { name: 'Model diff' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Show the walkthrough now' })).toBeVisible()

  await page.getByRole('button', { name: 'Run tests' }).click()
  await expect(page.locator('.run-summary')).toHaveText(/^\d+ of \d+ tests passed\.$/, { timeout: 120_000 })
  await expect(page.getByText(/Hidden review test/)).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Model diff' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Submit' }).click()
  await expect(page.locator('.run-summary')).toHaveText(/^Submitted: \d+ of \d+ tests passed\.$/, { timeout: 60_000 })
  await expect(page.getByText('Hidden review test 1')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Model diff' })).toBeVisible()

  await page.evaluate(({ key, files }) => localStorage.setItem(key, JSON.stringify({ 'cart/repeat-add': { files, submitted: true } })), { key: DRAFTS_KEY, files: solution })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Model diff' })).toBeVisible()
  await page.getByRole('button', { name: 'Submit' }).click()
  await expect(page.locator('.run-summary')).toHaveText(/^Submitted: all \d+ tests passed, including the hidden review tests\.$/, { timeout: 60_000 })
  await expect(page.locator('.page-heading .pill.solved')).toHaveText('Completed')

  for (const [index, area] of guide.rubric.entries()) await page.getByLabel(area.title, { exact: true }).selectOption(String(index === 0 ? 4 : 3))
  await page.getByRole('combobox', { name: 'Save to plan' }).selectOption({ index: 0 })
  await page.getByRole('button', { name: 'Save scorecard' }).click()
  await expect(page.getByText('Saved. Average 3.3 of 4.')).toBeVisible()
  await page.getByRole('link', { name: 'See it in the plan’s mock scorecards' }).click()
  await expect(page.getByRole('heading', { name: 'Mock scorecards' })).toBeVisible()
  await expect(page.getByRole('heading', { name: `${task.title} (${cart.title})` })).toContainText('Codebase')

  await page.goto('./#codebase')
  await expect(page.locator('.page-heading > .pill')).toHaveText('1 of 12 completed')
})

test('Ctrl+K and the site map reach the codebase tasks', async ({ page }) => {
  await page.goto('./#home')
  await expect(heading(page)).toBeVisible()
  await page.keyboard.press(`${process.platform === 'darwin' ? 'Meta' : 'Control'}+k`)
  const palette = page.getByRole('dialog', { name: 'Search DevPREP' })
  await palette.getByRole('combobox').fill(task.title)
  await expect(palette.getByRole('option', { name: new RegExp(task.title) }).first()).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#codebase\/cart\/repeat-add$/)
  await expect(heading(page)).toHaveText(task.title)

  await page.goto('./#map')
  await expect(heading(page)).toHaveText('Site map')
  const section = page.locator('.map-section').filter({ hasText: 'Codebase interviews' })
  await expect(section.getByRole('link', { name: 'Codebase interviews' }).first()).toBeVisible()
})

test.describe('codebase accessibility', () => {
  for (const width of [360, 768, 1440]) {
    for (const theme of ['light', 'dark']) {
      test(`axe finds no violations in the guide and a task at ${width}px ${theme}`, async ({ page }) => {
        test.slow()
        await page.setViewportSize({ width, height: 900 })
        await page.goto(`./?scoutTheme=${theme}#codebase`)
        await expect(heading(page)).toHaveText(guide.title)
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
        for (const summary of await page.locator('.codebase-steps summary').all()) await summary.click()
        expect(await axe(page), `#codebase at ${width} ${theme}`).toEqual([])
        expect(await noOverflow(page)).toBe(true)

        await page.goto(`./?scoutTheme=${theme}#codebase/cart/repeat-add`)
        await expect(heading(page)).toHaveText(task.title)
        await page.getByRole('button', { name: 'Show the walkthrough now' }).click()
        await expect(page.getByRole('heading', { name: 'Model diff' })).toBeVisible()
        for (const summary of await page.locator('.codebase-diff summary').all()) await summary.click()
        expect(await axe(page), `task at ${width} ${theme}`).toEqual([])
        expect(await noOverflow(page)).toBe(true)
      })
    }
  }
})
