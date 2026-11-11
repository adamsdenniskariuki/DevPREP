import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { expectCode, useEditor } from './editor-helpers'
import { navTo } from './nav'

const read = (path: string) => readFileSync(new URL(`../content/${path}`, import.meta.url), 'utf8')
const index = JSON.parse(read('node/index.json')) as { lessons: string[]; exercises: string[] }
const lesson = JSON.parse(read('node/lessons/node-event-loop.json'))
const exercise = JSON.parse(read('node/exercises/event-loop-order.json'))
const starter = read('node/exercises/event-loop-order.starter.ts')
const solution = read('node/exercises/event-loop-order.solution.ts')
const skillTest = JSON.parse(read('skill-tests/node.json'))
const plan = JSON.parse(read('plans/node-skill-test-2wk.json'))
const DRAFTS_KEY = 'devprep.node.drafts.v1'
const heading = (page: Page) => page.getByRole('heading', { level: 1 })
const axe = async (page: Page) => (await new AxeBuilder({ page }).exclude('.cm-scroller').analyze()).violations.map(violation => ({ id: violation.id, targets: violation.nodes.map(node => node.target.join(' ')) }))
const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)

test('the Node.js index lists every lesson and exercise and links to the plan and skill test', async ({ page }) => {
  await page.goto('./#node')
  await expect(heading(page)).toHaveText('Node.js')
  await expect(heading(page)).toBeFocused()
  await expect(page.locator('.node-list > li')).toHaveCount(index.lessons.length)
  await expect(page.getByRole('region', { name: 'Exercises' }).locator('.node-exercise-list > li')).toHaveCount(index.exercises.length)
  await expect(page.locator('.page-heading .pill')).toHaveText(`0 of ${index.exercises.length} exercises passed`)
  await expect(page.getByRole('heading', { name: 'What runs here' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'timed Node.js skill test' })).toHaveAttribute('href', '#skilltest/node')
  await page.getByRole('link', { name: 'two-week Node.js plan' }).click()
  await expect(heading(page)).toHaveText(plan.title)
  await page.goto('./#node')
  await page.getByRole('link', { name: lesson.title, exact: true }).click()
  await expect(page).toHaveURL(/#node\/node-event-loop$/)
  expect(await noOverflow(page)).toBe(true)
})

test('a Node.js lesson shows its sections, pitfalls and gotchas', async ({ page }) => {
  await page.goto('./#node/node-event-loop')
  await expect(heading(page)).toHaveText(lesson.title)
  await expect(page.getByRole('heading', { name: 'Common pitfalls' })).toBeVisible()
  const gotcha = page.locator('.node-gotcha').first()
  await gotcha.locator('summary').click()
  await expect(gotcha).toHaveAttribute('open', '')
  await page.getByRole('link', { name: /^Next: / }).click()
  await expect(page).toHaveURL(new RegExp(`#node/${index.lessons[1]}$`))
  await page.goto(`./#node/${exercise.lesson}`)
  await expect(page.getByRole('link', { name: exercise.title })).toBeVisible()
  await page.goto(`./#node/${index.lessons.at(-1)}`)
  await expect(page.getByRole('link', { name: 'Take the Node.js skill test' })).toHaveAttribute('href', '#skilltest/node')
})

test('an unknown Node.js id shows a not-found message', async ({ page }) => {
  await page.goto('./#node/nope')
  await expect(heading(page)).toHaveText(/^(Page not found|This page isn’t on the roadmap\.)$/)
})

test('a Node.js exercise runs with progress, fails the starter, passes the solution and keeps the draft', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The compiler download is covered once.')
  test.setTimeout(180_000)
  await useEditor(page, 'plain')
  await page.goto(`./#node/${exercise.id}`)
  await expect(heading(page)).toHaveText(exercise.title)
  const editor = page.getByRole('textbox', { name: 'index.ts', exact: true })
  await expectCode(editor, starter)
  await expect(page.locator('.task-preview')).toHaveCount(0)

  await page.getByRole('button', { name: 'Run tests' }).click()
  await expect(page.locator('.run-summary')).toHaveText(/^\d+ of \d+ tests passed\.$/, { timeout: 120_000 })

  await editor.fill(solution)
  await page.getByRole('button', { name: 'Run tests' }).click()
  await expect(page.locator('.run-summary')).toHaveText(/^All \d+ tests passed\.$/, { timeout: 60_000 })
  await expect(page.locator('.page-heading .pill.solved')).toHaveText('Passed')

  await page.reload()
  await expectCode(page.getByRole('textbox', { name: 'index.ts', exact: true }), solution)
  await page.goto('./#node')
  await expect(page.locator('.page-heading .pill')).toHaveText(`1 of ${index.exercises.length} exercises passed`)
  await page.evaluate(key => localStorage.removeItem(key), DRAFTS_KEY)
})

test('the Node.js skill test runs a coding task without a preview, and submits', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The compiler download is covered once.')
  test.setTimeout(180_000)
  await page.goto('./#skilltest')
  await page.getByRole('link', { name: skillTest.title }).click()
  await expect(heading(page)).toHaveText(skillTest.title)
  await page.getByRole('button', { name: 'Start the test' }).click()
  await expect(page.getByRole('timer')).toHaveText(/^(40:00|39:5\d)$/)
  await expect(page.locator('fieldset.skill-question')).toHaveCount(skillTest.pick)
  await expect(page.locator('.skill-task')).toHaveCount(skillTest.tasks.length)
  await expect(page.locator('.skill-task .task-workspace.no-preview')).toHaveCount(skillTest.tasks.length)
  await expect(page.locator('.skill-task .task-preview')).toHaveCount(0)
  await page.locator('.skill-task').first().getByRole('button', { name: 'Run tests' }).click()
  await expect(page.locator('.skill-task').first().locator('.run-summary')).toHaveText(/^\d+ of \d+ tests passed\.$/, { timeout: 120_000 })

  await page.getByRole('button', { name: 'Submit the test' }).click()
  await page.getByRole('button', { name: 'Submit now' }).click()
  await expect(heading(page)).toHaveText(`${skillTest.title}: results`)
  await expect(page.locator('.skill-answer')).toHaveCount(skillTest.pick)
})

test('the tree, Ctrl+K and the site map reach Node.js', async ({ page }) => {
  await page.goto('./#home')
  await expect(heading(page)).toBeVisible()
  await navTo(page, 'Node.js')
  await expect(page).toHaveURL(/#node$/)

  await page.keyboard.press(`${process.platform === 'darwin' ? 'Meta' : 'Control'}+k`)
  const palette = page.getByRole('dialog', { name: 'Search DevPREP' })
  await palette.getByRole('combobox').fill(exercise.title)
  await expect(palette.getByRole('option', { name: new RegExp(exercise.title) }).first()).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(new RegExp(`#node/${exercise.id}$`))
  await expect(heading(page)).toHaveText(exercise.title)

  await page.goto('./#map')
  await expect(heading(page)).toHaveText('Site map')
  await expect(page.locator('.map-section').getByRole('link', { name: 'Node.js', exact: true }).first()).toBeVisible()
})

test.describe('Node.js accessibility', () => {
  for (const width of [360, 768, 1440]) {
    for (const theme of ['light', 'dark']) {
      test(`axe finds no violations in the Node.js pages and its skill test at ${width}px ${theme}`, async ({ page }) => {
        test.slow()
        await page.setViewportSize({ width, height: 900 })
        await page.goto(`./?scoutTheme=${theme}#node`)
        await expect(heading(page)).toHaveText('Node.js')
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
        expect(await axe(page), `#node at ${width} ${theme}`).toEqual([])
        expect(await noOverflow(page)).toBe(true)

        await page.goto(`./?scoutTheme=${theme}#node/node-event-loop`)
        await expect(heading(page)).toHaveText(lesson.title)
        for (const summary of await page.locator('.node-gotcha summary').all()) await summary.click()
        expect(await axe(page), `lesson at ${width} ${theme}`).toEqual([])
        expect(await noOverflow(page)).toBe(true)

        await page.goto(`./?scoutTheme=${theme}#node/${exercise.id}`)
        await expect(heading(page)).toHaveText(exercise.title)
        await page.getByRole('button', { name: 'Show the solution' }).click()
        expect(await axe(page), `exercise at ${width} ${theme}`).toEqual([])
        expect(await noOverflow(page)).toBe(true)

        await page.goto(`./?scoutTheme=${theme}#skilltest/node`)
        await expect(heading(page)).toHaveText(skillTest.title)
        await page.getByRole('button', { name: 'Start the test' }).click()
        await page.locator('fieldset.skill-question').first().getByRole('radio').first().check()
        await expect(page.locator('.skill-task .task-workspace')).toHaveCount(skillTest.tasks.length)
        expect(await axe(page), `running test at ${width} ${theme}`).toEqual([])
        expect(await noOverflow(page)).toBe(true)

        await page.getByRole('button', { name: 'Submit the test' }).click()
        await page.getByRole('button', { name: 'Submit now' }).click()
        await expect(heading(page)).toHaveText(`${skillTest.title}: results`)
        expect(await axe(page), `results at ${width} ${theme}`).toEqual([])
        expect(await noOverflow(page)).toBe(true)
      })
    }
  }
})
