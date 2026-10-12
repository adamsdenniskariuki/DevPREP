import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

const PROGRESS_KEY = 'devprep.progress.v1'
const DRAFTS_KEY = 'devprep.code.v1'
const problem = JSON.parse(readFileSync(new URL('../content/problems/count-pair-sums.json', import.meta.url), 'utf8'))

async function openProblem(page: Page) {
  await page.goto('./#practice')
  await page.getByRole('link', { name: /Code runner/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Code runner' })).toBeFocused()
  await page.getByRole('link', { name: problem.title }).click()
  await expect(page.getByRole('heading', { level: 1, name: problem.title })).toBeFocused()
  await expect(page.getByRole('textbox', { name: 'JavaScript code' })).toHaveValue(problem.starter.js)
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
  await expect(page.locator('.page-heading .pill')).toHaveText(`1 of 32 solved`)
  await page.getByRole('link', { name: 'Progress', exact: true }).first().click()
  await expect(page.getByText('Green tests')).toBeVisible()
})

test('drafts survive a reload, reset asks first, and the language toggle keeps each draft', async ({ page }) => {
  await openProblem(page)
  const js = page.getByRole('textbox', { name: 'JavaScript code' })
  await js.fill('function countPairs() { return 42 }')
  await page.getByRole('radio', { name: 'Python' }).check()
  const py = page.getByRole('textbox', { name: 'Python code' })
  await expect(py).toHaveValue(problem.starter.py)
  await py.fill('def count_pairs(values, target):\n    return 7')
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Python code' })).toHaveValue('def count_pairs(values, target):\n    return 7')
  await page.getByRole('radio', { name: 'JavaScript' }).check()
  await expect(js).toHaveValue('function countPairs() { return 42 }')

  page.once('dialog', dialog => dialog.dismiss())
  await page.getByRole('button', { name: 'Reset to starter' }).click()
  await expect(js).toHaveValue('function countPairs() { return 42 }')
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Reset to starter' }).click()
  await expect(js).toHaveValue(problem.starter.js)
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
  await expect(editor).toHaveValue('if (x) {\n    ')
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
  await page.getByRole('link', { name: 'Progress', exact: true }).first().click()
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
  await expect(page.getByRole('link', { name: 'Practice', exact: true }).first()).toHaveAttribute('class', /active/)
})
