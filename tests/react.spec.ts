import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { expectCode, useEditor } from './editor-helpers'
import { navTo } from './nav'

const read = (path: string) => readFileSync(new URL(`../content/${path}`, import.meta.url), 'utf8')
const index = JSON.parse(read('react/index.json')) as { lessons: string[]; exercises: string[] }
const lesson = JSON.parse(read('react/lessons/react-jsx.json'))
const exercise = JSON.parse(read('react/exercises/jsx-profile-card.json'))
const starter = read('react/exercises/jsx-profile-card.starter.tsx')
const solution = read('react/exercises/jsx-profile-card.solution.tsx')
const skillTest = JSON.parse(read('skill-tests/react.json'))
const plan = JSON.parse(read('plans/react-skill-test-2wk.json'))
const DRAFTS_KEY = 'devprep.react.drafts.v1'
const heading = (page: Page) => page.getByRole('heading', { level: 1 })
const axe = async (page: Page) => (await new AxeBuilder({ page }).exclude('.cm-scroller').exclude('.task-preview iframe').analyze()).violations.map(violation => ({ id: violation.id, targets: violation.nodes.map(node => node.target.join(' ')) }))
const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)

test('the React index lists every lesson and exercise and links to the plan and skill test', async ({ page }) => {
  await page.goto('./#react')
  await expect(heading(page)).toHaveText('React')
  await expect(heading(page)).toBeFocused()
  await expect(page.locator('.react-list > li')).toHaveCount(index.lessons.length)
  await expect(page.getByRole('region', { name: 'Exercises' }).locator('.react-exercise-list > li')).toHaveCount(index.exercises.length)
  await expect(page.locator('.page-heading .pill')).toHaveText(`0 of ${index.exercises.length} exercises passed`)
  await page.getByRole('link', { name: 'two-week React plan' }).click()
  await expect(heading(page)).toHaveText(plan.title)
  await page.goto('./#react')
  await page.getByRole('link', { name: lesson.title }).click()
  await expect(page).toHaveURL(/#react\/react-jsx$/)
  expect(await noOverflow(page)).toBe(true)
})

test('a lesson shows its sections, pitfalls and gotchas', async ({ page }) => {
  await page.goto('./#react/react-jsx')
  await expect(heading(page)).toHaveText(lesson.title)
  await expect(page.getByRole('heading', { name: 'Common pitfalls' })).toBeVisible()
  const gotcha = page.locator('.react-gotcha').first()
  await gotcha.locator('summary').click()
  await expect(gotcha).toHaveAttribute('open', '')
  await page.getByRole('link', { name: /^Next: / }).click()
  await expect(page).toHaveURL(new RegExp(`#react/${index.lessons[1]}$`))
  await page.goto(`./#react/${exercise.lesson}`)
  await expect(page.getByRole('link', { name: exercise.title })).toBeVisible()
})

test('unknown React and skill-test ids show a not-found message', async ({ page }) => {
  const notFound = /^(Page not found|Test not found|This page isn’t on the roadmap\.)$/
  await page.goto('./#react/nope')
  await expect(heading(page)).toHaveText(notFound)
  await page.goto('./#skilltest/nope')
  await expect(heading(page)).toHaveText(notFound)
})

test('an exercise runs with progress, fails the starter, passes the solution and keeps the draft', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The compiler download is covered once.')
  test.setTimeout(180_000)
  await useEditor(page, 'plain')
  await page.goto(`./#react/${exercise.id}`)
  await expect(heading(page)).toHaveText(exercise.title)
  const editor = page.getByRole('textbox', { name: 'App.tsx', exact: true })
  await expectCode(editor, starter)

  await page.getByRole('button', { name: 'Run tests' }).click()
  await expect(page.locator('.run-summary')).toHaveText(/^\d+ of \d+ tests passed\.$/, { timeout: 120_000 })

  await editor.fill(solution)
  await page.getByRole('button', { name: 'Run tests' }).click()
  await expect(page.locator('.run-summary')).toHaveText(/^All \d+ tests passed\.$/, { timeout: 60_000 })
  await expect(page.locator('.page-heading .pill.solved')).toHaveText('Passed')
  await expect(page.locator('.task-preview iframe')).toBeVisible()

  await page.reload()
  await expectCode(page.getByRole('textbox', { name: 'App.tsx', exact: true }), solution)
  await page.goto('./#react')
  await expect(page.locator('.page-heading .pill')).toHaveText(`1 of ${index.exercises.length} exercises passed`)
  await page.evaluate(key => localStorage.removeItem(key), DRAFTS_KEY)
})

test('the skill test starts, keeps answers across a reload, submits and shows results by topic', async ({ page }) => {
  await page.goto('./#skilltest')
  await expect(heading(page)).toHaveText('Skill tests')
  await page.getByRole('link', { name: skillTest.title }).click()
  await expect(heading(page)).toHaveText(skillTest.title)
  await page.getByRole('button', { name: 'Start the test' }).click()
  await expect(page.getByRole('timer')).toHaveText(/^(40:00|39:5\d)$/)
  const questions = page.locator('fieldset.skill-question')
  await expect(questions).toHaveCount(skillTest.pick)
  for (const fieldset of (await questions.all()).slice(0, 5)) await fieldset.getByRole('radio').first().check()
  await expect(page.getByText(`5 of ${skillTest.pick} answered`)).toBeVisible()

  await page.reload()
  await expect(page.getByText(`5 of ${skillTest.pick} answered`)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Coding tasks' })).toBeVisible()
  await expect(page.locator('.skill-task')).toHaveCount(skillTest.tasks.length)

  await page.getByRole('button', { name: 'Submit the test' }).click()
  await expect(page.getByText(`${skillTest.pick - 5} questions are still unanswered.`, { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Submit now' }).click()
  await expect(heading(page)).toHaveText(`${skillTest.title}: results`)
  await expect(page.getByRole('heading', { name: 'Score by topic' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Review next' })).toBeVisible()
  await expect(page.locator('.skill-answer')).toHaveCount(skillTest.pick)
  await expect(page.locator('.skill-weak a').first()).toHaveAttribute('href', /^#/)

  await page.goto('./#skilltest')
  await expect(page.locator('.skill-test-list .pill').filter({ hasText: /^Last: \d+% on / })).toBeVisible()
})

test('the tree, Ctrl+K and the site map reach React and the skill tests', async ({ page }) => {
  await page.goto('./#home')
  await expect(heading(page)).toBeVisible()
  await navTo(page, 'React')
  await expect(page).toHaveURL(/#react$/)
  await navTo(page, 'Skill tests')
  await expect(page).toHaveURL(/#skilltest$/)

  await page.keyboard.press(`${process.platform === 'darwin' ? 'Meta' : 'Control'}+k`)
  const palette = page.getByRole('dialog', { name: 'Search DevPREP' })
  await palette.getByRole('combobox').fill(exercise.title)
  await expect(palette.getByRole('option', { name: new RegExp(exercise.title) }).first()).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(new RegExp(`#react/${exercise.id}$`))
  await expect(heading(page)).toHaveText(exercise.title)

  await page.goto('./#map')
  await expect(heading(page)).toHaveText('Site map')
  await expect(page.locator('.map-section').getByRole('link', { name: 'React', exact: true }).first()).toBeVisible()
  await expect(page.locator('.map-section').getByRole('link', { name: 'Skill tests', exact: true }).first()).toBeVisible()
})

test.describe('React and skill test accessibility', () => {
  for (const width of [360, 768, 1440]) {
    for (const theme of ['light', 'dark']) {
      test(`axe finds no violations in the React pages and the skill test at ${width}px ${theme}`, async ({ page }) => {
        test.slow()
        await page.setViewportSize({ width, height: 900 })
        await page.goto(`./?scoutTheme=${theme}#react`)
        await expect(heading(page)).toHaveText('React')
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
        expect(await axe(page), `#react at ${width} ${theme}`).toEqual([])
        expect(await noOverflow(page)).toBe(true)

        await page.goto(`./?scoutTheme=${theme}#react/react-jsx`)
        await expect(heading(page)).toHaveText(lesson.title)
        for (const summary of await page.locator('.react-gotcha summary').all()) await summary.click()
        expect(await axe(page), `lesson at ${width} ${theme}`).toEqual([])
        expect(await noOverflow(page)).toBe(true)

        await page.goto(`./?scoutTheme=${theme}#react/${exercise.id}`)
        await expect(heading(page)).toHaveText(exercise.title)
        await page.getByRole('button', { name: 'Show the solution' }).click()
        expect(await axe(page), `exercise at ${width} ${theme}`).toEqual([])
        expect(await noOverflow(page)).toBe(true)

        await page.goto(`./?scoutTheme=${theme}#skilltest/react`)
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
