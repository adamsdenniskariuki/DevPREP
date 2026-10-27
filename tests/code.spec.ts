import { expect, test, type Page } from '@playwright/test'
import { expectCode } from './editor-helpers'
import { readFileSync } from 'node:fs'
import { expectInGroup, navTo } from './nav'

const PROGRESS_KEY = 'devprep.progress.v1'
const DRAFTS_KEY = 'devprep.code.v1'
const problem = JSON.parse(readFileSync(new URL('../content/problems/count-pair-sums.json', import.meta.url), 'utf8'))
const index: { id: string; title: string; pattern: string; difficulty: string; level: string; paths?: string[] }[] = JSON.parse(readFileSync(new URL('../src/generated/problem-index.json', import.meta.url), 'utf8'))

async function openProblem(page: Page) {
  await page.goto('./#practice')
  await page.getByRole('link', { name: /Coding problems/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Code runner' })).toBeFocused()
  await page.getByRole('link', { name: problem.title }).click()
  await expect(page.getByRole('heading', { level: 1, name: problem.title })).toBeFocused()
  await expectCode(page.getByRole('textbox', { name: 'JavaScript code' }), problem.starter.js)
}

test('a JavaScript solve passes visible and hidden tests, earns XP once and is saved in backups', async ({ page }) => {
  await openProblem(page)
  const editor = page.getByRole('textbox', { name: 'JavaScript code' })
  const results = page.locator('.run-results')

  await page.getByRole('button', { name: 'Run tests' }).click()
  await expect(results).toContainText(`0 of ${problem.tests.length + problem.hiddenTests.length} tests passed.`)
  await expect(results).toContainText('Expected')
  await expect(results.getByText('Hidden tests')).toBeVisible()

  await editor.fill(problem.solution.js.replace('return pairs', 'console.log("checked", values.length)\n  return pairs'))
  await page.getByRole('button', { name: 'Run tests' }).click()
  await expect(results).toContainText(/All \d+ tests passed · \+15 XP\./)
  await expect(results).toContainText('checked 5')
  await expect(page.locator('.page-heading .pill.solved')).toHaveText('JS')

  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), PROGRESS_KEY)
  expect(Object.keys(saved.solved)).toEqual([problem.id])
  expect(saved.solved[problem.id]).toHaveProperty('js')

  await page.getByRole('button', { name: 'Run tests' }).click()
  await expect(results.locator('.run-summary')).toHaveText(/^All \d+ tests passed\.$/)
  await page.getByRole('link', { name: /All problems/ }).click()
  await expect(page.locator('.page-heading .pill')).toHaveText(`1 of ${index.length} solved`)
  await expect(page.getByRole('combobox', { name: 'Pattern' }).locator('option', { hasText: `${problem.pattern} (1/` })).toHaveCount(1)
  await navTo(page, 'Progress')
  await expect(page.getByText('Green tests')).toBeVisible()
  const patternTotal = index.filter(item => item.pattern === problem.pattern).length
  await expect(page.getByRole('progressbar', { name: `${problem.pattern} problems solved` })).toHaveJSProperty('value', 1)
  await expect(page.getByRole('progressbar', { name: `${problem.pattern} problems solved` })).toHaveJSProperty('max', patternTotal)
})

test('the problem list filters by pattern, difficulty and path-core problems', async ({ page }) => {
  await page.goto('./#code')
  const rows = page.locator('.code-row')
  await expect(rows).toHaveCount(index.length)
  const pattern = index[index.length - 1].pattern
  await page.getByRole('combobox', { name: 'Pattern' }).selectOption(pattern)
  await expect(rows).toHaveCount(index.filter(item => item.pattern === pattern).length)
  await expect(page.locator('.code-group h2')).toHaveText([pattern])
  await page.getByRole('combobox', { name: 'Pattern' }).selectOption('all')
  await page.getByRole('radio', { name: 'Hard' }).check()
  await expect(rows).toHaveCount(index.filter(item => item.difficulty === 'stretch').length)
  await page.getByRole('radio', { name: 'All', exact: true }).first().check()
  await expect(page.getByRole('checkbox', { name: /core only/ })).toHaveCount(0)
  await page.goto('./#settings')
  await page.getByLabel('Target role').selectOption('swe')
  await page.goto('./#code')
  const core = index.filter(item => item.paths?.includes('swe'))
  await expect(page.locator('.pill.core')).toHaveCount(core.length)
  await page.getByRole('checkbox', { name: 'SE core only' }).check()
  await expect(rows).toHaveCount(core.length)
  if (!core.length) await expect(page.getByText('No problems match these filters.')).toBeVisible()
})

test('drafts survive a reload, reset asks first, and the language toggle keeps each draft', async ({ page }) => {
  await openProblem(page)
  const js = page.getByRole('textbox', { name: 'JavaScript code' })
  await js.fill('function countPairs() { return 42 }')
  await page.getByRole('radio', { name: 'Python' }).check()
  const py = page.getByRole('textbox', { name: 'Python code' })
  await expectCode(py, problem.starter.py)
  await py.fill('def count_pairs(values, target):\n    return 7')
  await page.reload()
  await expectCode(page.getByRole('textbox', { name: 'Python code' }), 'def count_pairs(values, target):\n    return 7')
  await page.getByRole('radio', { name: 'JavaScript' }).check()
  await expectCode(js, 'function countPairs() { return 42 }')

  page.once('dialog', dialog => dialog.dismiss())
  await page.getByRole('button', { name: 'Reset to starter' }).click()
  await expectCode(js, 'function countPairs() { return 42 }')
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Reset to starter' }).click()
  await expectCode(js, problem.starter.js)
  const drafts = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), DRAFTS_KEY)
  expect(drafts[problem.id].js).toBeUndefined()
  expect(drafts[problem.id].py).toContain('return 7')
  expect(await page.evaluate(key => localStorage.getItem(key), PROGRESS_KEY)).toBeNull()
})

test('Tab indents, Escape then Tab leaves the editor, and hints reveal one at a time', async ({ page }) => {
  await openProblem(page)
  const editor = page.getByRole('textbox', { name: 'JavaScript code' })
  await editor.fill('')
  await editor.focus()
  await page.keyboard.type('if (x) {')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Tab')
  // The Rich editor closes brackets and indents inside the block; Tab adds one more level.
  await expectCode(editor, 'if (x) {\n    \n}')
  await page.keyboard.press('Escape')
  await page.keyboard.press('Tab')
  await expect(editor).not.toBeFocused()

  await page.getByRole('button', { name: `Show hint 1 of ${problem.hints.length}` }).click()
  await expect(page.locator('.code-hints li')).toHaveCount(1)
  await expect(page.locator('.code-hints li').first()).toHaveText(problem.hints[0])
})

test('an infinite loop is stopped and the runner recovers', async ({ page }) => {
  await openProblem(page)
  const editor = page.getByRole('textbox', { name: 'JavaScript code' })
  await editor.fill('function countPairs() { while (true) {} }')
  await page.getByRole('button', { name: 'Run tests' }).click()
  await expect(page.getByRole('button', { name: 'Running…' })).toBeDisabled()
  await expect(page.locator('.run-results')).toContainText('Stopped after 5 seconds.', { timeout: 15_000 })
  await editor.fill(problem.solution.js)
  await page.getByRole('button', { name: 'Run tests' }).click()
  await expect(page.locator('.run-results')).toContainText(/All \d+ tests passed/)
})

test('syntax errors are reported without crashing the page', async ({ page }) => {
  await openProblem(page)
  await page.getByRole('textbox', { name: 'JavaScript code' }).fill('function countPairs( {')
  await page.getByRole('button', { name: 'Run tests' }).click()
  await expect(page.locator('.run-results')).toContainText('Your code didn’t run.')
})

test('Python loads lazily, solves, and earns the bilingual badge', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Pyodide download is covered once.')
  test.setTimeout(180_000)
  const pyodideRequests: string[] = []
  page.on('request', request => { if (request.url().includes('/pyodide/')) pyodideRequests.push(request.url()) })
  await openProblem(page)
  await page.getByRole('textbox', { name: 'JavaScript code' }).fill(problem.solution.js)
  await page.getByRole('button', { name: 'Run tests' }).click()
  await expect(page.locator('.run-results')).toContainText('+15 XP')
  expect(pyodideRequests).toEqual([])

  await page.getByRole('radio', { name: 'Python' }).check()
  const editor = page.getByRole('textbox', { name: 'Python code' })
  await editor.fill('def count_pairs(values, target):\n    print("hi from python")\n    return 1 // 0')
  await page.getByRole('button', { name: 'Run tests' }).click()
  await expect(page.locator('.run-results')).toContainText('ZeroDivisionError', { timeout: 150_000 })
  await expect(page.locator('.run-results')).toContainText('hi from python')
  expect(pyodideRequests.some(url => url.endsWith('pyodide.asm.wasm'))).toBe(true)

  await editor.fill(problem.solution.py)
  await page.getByRole('button', { name: 'Run tests' }).click()
  await expect(page.locator('.run-results')).toContainText(/All \d+ tests passed · \+5 XP\./)
  await navTo(page, 'Progress')
  await expect(page.locator('.badge.earned', { hasText: 'Bilingual' })).toBeVisible()
})

test('unknown problems are not found and narrow screens do not scroll sideways', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 })
  await page.goto('./#code/not-a-problem')
  await expect(page.getByRole('heading', { level: 1, name: 'This page isn’t on the roadmap.' })).toBeVisible()
  await page.goto('./#code')
  await expect(page.getByRole('heading', { level: 1, name: 'Code runner' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.goto(`./#code/${problem.id}`)
  await expect(page.getByRole('textbox', { name: 'JavaScript code' })).toBeVisible()
  await page.getByText('Solution and complexity').click()
  await page.getByRole('textbox', { name: 'JavaScript code' }).fill(problem.solution.js.replace('return pairs', 'return [values, "a-very-long-unbroken-value-that-should-wrap-inside-the-result-list-without-overflow"]'))
  await page.getByRole('button', { name: 'Run tests' }).click()
  await expect(page.locator('.run-results')).toContainText('Got')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await expectInGroup(page, 'Practise')
})
