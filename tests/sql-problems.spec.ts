import { expect, test } from '@playwright/test'
import { expectCode } from './editor-helpers'
import { readFileSync } from 'node:fs'

const PROGRESS_KEY = 'devprep.progress.v1'
const read = (path: string) => JSON.parse(readFileSync(new URL(`../content/sql-problems/${path}`, import.meta.url), 'utf8'))
const order: string[] = read('index.json').problems
const problems = order.map(id => read(`${id}.json`))
const runnable = problems.find(problem => !problem.exercise.ordered && !problem.exercise.check)!
const fits = () => document.documentElement.scrollWidth <= innerWidth

test('the SQL problem list filters by topic and difficulty and links from Practice', async ({ page }) => {
  await page.goto('./#practice')
  await page.getByRole('link', { name: /SQL problems/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'SQL problems' })).toBeVisible()
  await expect(page.locator('.code-row')).toHaveCount(problems.length)
  const topic = runnable.topic
  await page.getByLabel('Topic').selectOption(topic)
  await expect(page.locator('.code-row')).toHaveCount(problems.filter(problem => problem.topic === topic).length)
  await page.getByRole('group', { name: 'Difficulty' }).getByText('Hard').click()
  await expect(page.locator('.code-row')).toHaveCount(problems.filter(problem => problem.topic === topic && problem.difficulty === 'stretch').length)
  await page.getByRole('group', { name: 'Level' }).getByText('SSE stretch').click()
  const hardSse = problems.filter(problem => problem.topic === topic && problem.difficulty === 'stretch' && problem.level === 'sse').length
  if (hardSse) await expect(page.locator('.code-row')).toHaveCount(hardSse)
  else await expect(page.getByText('No problems match these filters.')).toBeVisible()
})

test('a SQL problem fails its starter, passes its solution, awards XP and keeps the draft', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Runtime downloads are covered once.')
  test.setTimeout(180_000)
  await page.goto(`./#sql/${runnable.id}`)
  await expect(page.getByRole('heading', { level: 1, name: runnable.title })).toBeVisible()
  await expect(page.getByRole('region', { name: /Expected result/ })).toBeVisible()
  await page.getByRole('button', { name: 'Show hint 1 of' + ` ${runnable.hints.length}` }).click()
  await expect(page.getByText(runnable.hints[0])).toBeVisible()
  const results = page.locator('.run-results')
  await page.getByRole('button', { name: 'Run tests' }).click()
  await expect(results).toContainText(/\d+ of \d+ tests passed/, { timeout: 150_000 })
  await expect(results).not.toContainText('All ')
  await page.getByRole('textbox', { name: /Your query/ }).fill(runnable.exercise.solution)
  await page.getByRole('button', { name: 'Run tests' }).click()
  const total = runnable.exercise.tests.length + runnable.exercise.hiddenTests.length
  await expect(results).toContainText(`All ${total} tests passed · +15 XP.`)
  await expect(page.locator('.page-heading .pill.solved')).toBeVisible()
  const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{}'), PROGRESS_KEY)
  expect(Object.keys(stored.sqlSolved ?? {})).toEqual([runnable.id])
  await page.reload()
  await expectCode(page.getByRole('textbox', { name: /Your query/ }), runnable.exercise.solution)
  await page.getByRole('link', { name: 'All SQL problems' }).click()
  await expect(page.locator('.code-row', { hasText: runnable.title }).locator('.pill.solved')).toBeVisible()
})

for (const width of [360, 768, 1440]) test(`SQL problems fit without sideways scrolling at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  await page.goto('./#sql')
  await expect(page.locator('.code-row').first()).toBeVisible()
  expect(await page.evaluate(fits)).toBe(true)
  const widest = problems.reduce((best, problem) => problem.exercise.tests[0].expected.columns.length > best.exercise.tests[0].expected.columns.length ? problem : best)
  for (const problem of [runnable, widest]) {
    await page.goto(`./#sql/${problem.id}`)
    await expect(page.getByRole('textbox', { name: /Your query/ })).toBeVisible()
    await page.getByText('Solution and notes').click()
    await page.getByText('Tables and test data').click()
    expect(await page.evaluate(fits), `${problem.id} at ${width}`).toBe(true)
  }
})
