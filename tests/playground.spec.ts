import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { codeOf, expectCode } from './editor-helpers'

const PLAYGROUND_KEY = 'devprep.playground.v1'
const problem = JSON.parse(readFileSync(new URL('../content/problems/count-pair-sums.json', import.meta.url), 'utf8'))
const fits = () => document.documentElement.scrollWidth <= innerWidth
const settle = (page: Page) => page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => undefined))))
const output = (page: Page) => page.getByRole('status', { name: 'Output' })
const runButton = (page: Page) => page.getByRole('button', { name: 'Run', exact: true })
const stored = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '[]') as { name: string; lang: string; code: string }[], PLAYGROUND_KEY)

async function open(page: Page, hash = '#playground') {
  await page.goto(`./${hash}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Playground' })).toBeVisible()
}

test('a first visit starts a JavaScript snippet that runs with stdin and shows the return value', async ({ page }) => {
  await open(page)
  await expect(page.getByLabel('Snippet name')).toHaveValue('JavaScript snippet')
  await expect(page.getByRole('radio', { name: 'JavaScript' })).toBeChecked()
  await expect(page.getByLabel('Input (stdin)')).toHaveValue('Ada\n')
  await runButton(page).click()
  await expect(output(page)).toContainText('Finished')
  await expect(output(page)).toContainText('Hello, Ada!')
  await expect(page.locator('.playground-value')).toHaveText('[1, 4, 9, 16]')
  await page.getByLabel('Input (stdin)').fill('Grace')
  await runButton(page).click()
  await expect(output(page)).toContainText('Hello, Grace!')
  expect(await page.evaluate(fits)).toBe(true)
})

test('Ctrl+Enter runs from the editor, errors show their line, and network access is refused', async ({ page }) => {
  await open(page)
  const editor = page.getByRole('textbox', { name: 'JavaScript code' })
  await editor.fill('console.log("first")\nnull.boom')
  await editor.press('Control+Enter')
  await expect(output(page)).toContainText('Error on line 2')
  await expect(output(page)).toContainText('first')
  await editor.fill('await fetch("https://example.com")')
  await editor.press('Control+Enter')
  await expect(output(page)).toContainText('Network access is turned off in the Playground.')
})

test('an endless loop is stopped and the runner recovers for the next run', async ({ page }) => {
  test.slow()
  await open(page)
  const editor = page.getByRole('textbox', { name: 'JavaScript code' })
  await editor.fill('while (true) {}')
  await runButton(page).click()
  await expect(output(page)).toContainText('Stopped after 5 seconds.', { timeout: 20_000 })
  await editor.fill('console.log("back again")')
  await runButton(page).click()
  await expect(output(page)).toContainText('back again')
})

test('snippets can be created, renamed, duplicated and deleted, and survive a reload', async ({ page }) => {
  await open(page)
  await page.getByLabel('New snippet in').selectOption('ts')
  await page.getByRole('button', { name: 'New snippet' }).click()
  await expect(page).toHaveURL(/#playground\/[a-z0-9-]+$/)
  await expect(page.getByRole('radio', { name: 'TypeScript' })).toBeChecked()
  await page.getByLabel('Snippet name').fill('Distances')
  await page.getByLabel('Snippet name').press('Enter')
  await page.getByRole('textbox', { name: 'TypeScript code' }).fill('const n: number = 2\nreturn n * 21')
  const list = page.getByRole('navigation', { name: /Snippets/ })
  await expect(list.getByRole('link', { name: /Distances/ })).toHaveAttribute('aria-current', 'page')
  await expect.poll(async () => (await stored(page)).map(snippet => snippet.name).sort()).toEqual(['Distances', 'JavaScript snippet'])
  const url = page.url()

  await page.reload()
  await expect(page.getByLabel('Snippet name')).toHaveValue('Distances')
  await expectCode(page.getByRole('textbox', { name: 'TypeScript code' }), 'const n: number = 2\nreturn n * 21')

  await page.getByRole('button', { name: 'Duplicate' }).click()
  await expect(page.getByLabel('Snippet name')).toHaveValue('Distances copy')
  expect(page.url()).not.toBe(url)
  await expect(list.getByRole('link')).toHaveCount(3)

  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(list.getByRole('link')).toHaveCount(2)
  await expect(list.getByRole('link', { name: /Distances copy/ })).toHaveCount(0)
  await expect.poll(async () => (await stored(page)).length).toBe(2)

  await page.goto('./#playground/not-a-real-snippet')
  await expect(page.getByRole('heading', { level: 2, name: 'That snippet isn’t on this device.' })).toBeVisible()
})

test('snippets are found by the command palette', async ({ page }) => {
  await open(page)
  await page.getByLabel('Snippet name').fill('Unique palette probe')
  await page.getByLabel('Snippet name').press('Enter')
  await expect.poll(async () => (await stored(page))[0]?.name).toBe('Unique palette probe')
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k')
  const palette = page.getByRole('dialog', { name: 'Search DevPREP' })
  await palette.getByRole('combobox').fill('Unique palette probe')
  const option = palette.getByRole('group', { name: /^Playground snippets/ }).getByRole('option').first()
  await expect(option).toContainText('Unique palette probe')
  await option.click()
  await expect(page).toHaveURL(/#playground\/[a-z0-9-]+$/)
})

test('a coding problem opens in the Playground as a new snippet', async ({ page }) => {
  await page.goto(`./#code/${problem.id}`)
  await page.getByRole('textbox', { name: 'JavaScript code' }).fill(problem.solution.js)
  await page.getByRole('button', { name: 'Open in Playground' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Playground' })).toBeVisible()
  await expect(page.getByLabel('Snippet name')).toHaveValue(problem.title)
  await expect.poll(() => codeOf(page.getByRole('textbox', { name: 'JavaScript code' }))).toBe(problem.solution.js)
})

test('TypeScript lists type errors and still runs', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Runtime downloads are covered once.')
  test.setTimeout(180_000)
  await open(page)
  await page.getByRole('radio', { name: 'TypeScript' }).check()
  await page.getByRole('textbox', { name: 'TypeScript code' }).fill('const n: number = "two"\nconsole.log(n)')
  await runButton(page).click()
  await expect(output(page)).toContainText('1 type error · the code still ran', { timeout: 150_000 })
  await expect(output(page)).toContainText('Line 1:')
  await expect(page.locator('.playground-stdout')).toHaveText('two')
})

test('Python reads stdin and shows the last expression', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Runtime downloads are covered once.')
  test.setTimeout(240_000)
  await open(page)
  await page.getByLabel('New snippet in').selectOption('py')
  await page.getByRole('button', { name: 'New snippet' }).click()
  await page.getByLabel('Input (stdin)').fill('Linus\n')
  await runButton(page).click()
  await expect(output(page)).toContainText('Hello, Linus!', { timeout: 200_000 })
  await expect(page.locator('.playground-value')).toHaveText("[('i', 4), ('s', 4)]")
})

test('SQL loads sample data, shows result tables, and keeps its database across reloads', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Runtime downloads are covered once.')
  test.setTimeout(240_000)
  await open(page)
  await page.getByLabel('New snippet in').selectOption('sql')
  await page.getByRole('button', { name: 'New snippet' }).click()
  await expect(page.getByLabel('Input (stdin)')).toHaveCount(0)
  await page.getByRole('button', { name: 'Load sample data' }).click()
  await expect(page.getByText(/Loaded the sample tables/).first()).toBeAttached({ timeout: 200_000 })
  await runButton(page).click()
  const table = output(page).getByRole('table').first()
  await expect(table).toContainText('Dev Patel')
  await expect(output(page)).toContainText(/Result 1 · SELECT · \d+ rows?/)

  const editor = page.getByRole('textbox', { name: 'SQL code' })
  await editor.fill('CREATE TABLE IF NOT EXISTS kept (note text);\nINSERT INTO kept VALUES (\'still here\');')
  await runButton(page).click()
  await expect(output(page)).not.toContainText('Error')
  await expect(output(page)).toContainText('INSERT')

  await page.reload()
  await expect(page.getByRole('textbox', { name: 'SQL code' })).toBeVisible()
  await page.getByRole('textbox', { name: 'SQL code' }).fill('SELECT note FROM kept;')
  await runButton(page).click()
  await expect(output(page).getByRole('table').first()).toContainText('still here', { timeout: 120_000 })

  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Reset database' }).click()
  await expect(page.getByText('The Playground database is empty.').first()).toBeAttached()
  await runButton(page).click()
  await expect(output(page)).toContainText('does not exist')
})

for (const scheme of ['light', 'dark'] as const) for (const width of [360, 768, 1440]) {
  test(`the Playground passes axe and fits at ${width}px in ${scheme} mode`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(`./?scoutTheme=${scheme}#playground`)
    await expect(page.getByRole('heading', { level: 1, name: 'Playground' })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('data-theme', scheme)
    await runButton(page).click()
    await expect(output(page)).toContainText('Finished')
    await page.getByText('How the Playground works, and its limits').click()
    await settle(page)
    expect(await page.evaluate(fits)).toBe(true)
    // CodeMirror's scroller holds the focusable editor content; axe misreads it, as in nav.spec.ts.
    expect((await new AxeBuilder({ page }).exclude('.cm-scroller').analyze()).violations).toEqual([])
  })
}
