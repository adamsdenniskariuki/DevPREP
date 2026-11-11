import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

const read = (path: string) => JSON.parse(readFileSync(new URL(`../content/${path}`, import.meta.url), 'utf8'))
const hashing = read(`patterns/${read('patterns/index.json').patterns[0]}.json`)
const problem = read('problems/count-pair-sums.json')
const tsTrack = read('typescript/track.json')
const tsLesson = read(`typescript/${tsTrack.lessons[0]}.json`)
const tsCore = tsLesson.lab.exercises.find((exercise: { id: string }) => exercise.id === 'core')

const total = (item: { tests: unknown[]; hiddenTests: unknown[] }) => item.tests.length + item.hiddenTests.length
/** A function that spends `ms` per call, so a run lasts long enough to watch, then returns a wrong answer. */
const slow = (name: string, ms: number, typed = false) =>
  `function ${name}(${typed ? '...args: unknown[]): unknown' : '...args)'} { const end = Date.now() + ${ms}; while (Date.now() < end) {} return '${'slow'}' }`
/** Keeps the whole run under about 2.5 s, well inside the 5 s JavaScript limit. */
const perCase = (count: number) => Math.max(120, Math.floor(2500 / count))

const bar = (page: Page, name = 'Test run progress') => page.getByRole('progressbar', { name })

async function openPattern(page: Page) {
  await page.goto(`./#patterns/${hashing.id}`)
  await expect(page.getByRole('heading', { level: 1, name: hashing.title })).toBeVisible()
  await page.getByRole('radio', { name: 'JavaScript', exact: true }).nth(2).check()
  return page.getByRole('textbox', { name: 'JavaScript code', exact: true })
}

async function watchRun(page: Page, count: number, limit: string) {
  const progress = bar(page)
  await expect(progress).toBeVisible()
  await expect(page.locator('.run-progress')).toContainText(`Running ${count} tests…`)
  await expect(page.locator('.run-progress')).toContainText(`stops after ${limit}`)
  await expect(progress).toHaveAttribute('aria-valuemax', String(count))
  await expect(progress).toHaveAttribute('aria-valuenow', /^[1-9]\d*$/)
  await expect(page.locator('.run-progress')).toContainText(new RegExp(`Test \\d+ of ${count}`))
  await expect(progress).toHaveCount(0, { timeout: 15_000 })
  await expect(page.locator('.run-summary')).toHaveText(`0 of ${count} tests passed.`)
}

test('a pattern Try it run shows test-by-test progress, then the results', async ({ page }) => {
  const editor = await openPattern(page)
  const count = total(hashing.exercise)
  await editor.fill(slow(hashing.exercise.function.js, perCase(count)))
  const run = page.getByRole('button', { name: 'Run tests' })
  await run.click()
  await expect(page.getByRole('button', { name: 'Running…' })).toHaveAttribute('aria-busy', 'true')
  await expect(page.getByRole('button', { name: 'Running…' })).toBeDisabled()
  await watchRun(page, count, '5 s')
  await expect(run).toBeEnabled()
  await expect(run).toHaveAttribute('aria-busy', 'false')
})

test('a coding problem run shows progress, and a timeout clears it before the message', async ({ page }) => {
  await page.goto(`./#code/${problem.id}`)
  await expect(page.getByRole('heading', { level: 1, name: problem.title })).toBeVisible()
  const editor = page.getByRole('textbox', { name: 'JavaScript code' })
  const count = total(problem)
  await editor.fill(slow(problem.function.js, perCase(count)))
  await page.getByRole('button', { name: 'Run tests' }).click()
  await watchRun(page, count, '5 s')
  await editor.fill(`function ${problem.function.js}() { while (true) {} }`)
  await page.getByRole('button', { name: 'Run tests' }).click()
  await expect(bar(page)).toBeVisible()
  await expect(bar(page)).toHaveAttribute('aria-valuenow', '0')
  await expect(page.locator('.run-results')).toContainText('Stopped after 5 seconds.', { timeout: 15_000 })
  await expect(bar(page)).toHaveCount(0)
})

test('a TypeScript lab shows loading, then test-by-test progress', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Runtime downloads are covered once.')
  test.setTimeout(180_000)
  await page.goto(`./#tracks/${tsLesson.track}`)
  await page.locator('article', { has: page.getByRole('heading', { name: tsLesson.title, exact: true }) }).getByRole('button', { name: /Start lesson|Resume/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: tsLesson.title })).toBeVisible()
  await page.getByRole('button', { name: 'Continue to practice' }).click()
  const count = total(tsCore)
  await page.getByRole('textbox', { name: /Your solution/ }).fill(slow(tsCore.function, perCase(count), true))
  await page.getByRole('button', { name: 'Run tests' }).click()
  await expect(bar(page)).toBeVisible()
  // The first run loads the compiler; the step names it and the bar has no value yet.
  await expect(page.locator('.run-progress')).toContainText(/Loading TypeScript \(first run downloads it; cached after\)…|Running \d+ tests…/)
  await expect(page.locator('.run-progress')).toContainText(`Running ${count} tests…`, { timeout: 150_000 })
  await expect(page.locator('.run-progress')).toContainText('stops after 6 s')
  await expect(bar(page)).toHaveAttribute('aria-valuenow', /^[1-9]\d*$/)
  await expect(bar(page)).toHaveCount(0, { timeout: 15_000 })
  await expect(page.locator('.run-results')).toContainText(`0 of ${count} tests passed.`)
})

test('a Playground run has an indeterminate bar that stays still with reduced motion', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Covered once.')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('./#playground')
  await expect(page.getByRole('heading', { level: 1, name: 'Playground' })).toBeVisible()
  await page.getByRole('textbox', { name: 'JavaScript code' }).fill('const end = Date.now() + 2500\nwhile (Date.now() < end) {}\nconsole.log("done")')
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  const progress = bar(page, 'Run progress')
  await expect(progress).toBeVisible()
  await expect(progress).not.toHaveAttribute('aria-valuenow', /.*/)
  await expect(page.locator('.run-progress')).toContainText('Running your code…')
  expect(await page.locator('.run-progress-fill').evaluate(node => getComputedStyle(node).animationName)).toBe('none')
  await expect(progress).toHaveCount(0, { timeout: 15_000 })
  await expect(page.locator('.playground-output')).toContainText('done')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await expect(progress).toBeVisible()
  expect(await page.locator('.run-progress-fill').evaluate(node => getComputedStyle(node).animationName)).toBe('run-progress-sweep')
})

for (const width of [360, 768, 1440]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`the run progress indicator is accessible and fits at ${width}px in ${theme}`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop', 'Widths are set here.')
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
      await page.setViewportSize({ width, height: 900 })
      const editor = await openPattern(page)
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      // Stuck in the first test until the 5 s limit, so the indicator stays up while axe runs.
      await editor.fill(`function ${hashing.exercise.function.js}() { while (true) {} }`)
      await page.getByRole('button', { name: 'Run tests' }).click()
      await expect(bar(page)).toBeVisible()
      await bar(page).scrollIntoViewIfNeeded()
      const box = await page.locator('.run-progress').boundingBox()
      expect(box!.x + box!.width).toBeLessThanOrEqual(width)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      const violations = (await new AxeBuilder({ page }).include('.pattern-exercise').exclude('.cm-scroller').analyze()).violations
      expect(violations.map(violation => ({ id: violation.id, targets: violation.nodes.map(node => node.target.join(' ')) })), `${width} ${theme}`).toEqual([])
    })
  }
}
