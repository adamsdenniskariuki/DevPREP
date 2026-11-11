import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

const read = (path: string) => JSON.parse(readFileSync(new URL(`../content/${path}`, import.meta.url), 'utf8'))
const skillTest = read('skill-tests/typescript.json')
const plan = read('plans/typescript-skill-test-1wk.json')
const track = read('typescript/track.json') as { lessons: string[] }
const heading = (page: Page) => page.getByRole('heading', { level: 1 })

test('the TypeScript track links to its plan and timed skill test', async ({ page }) => {
  await page.goto('./#tracks/typescript')
  await expect(page.getByRole('link', { name: 'timed TypeScript skill test' })).toHaveAttribute('href', '#skilltest/typescript')
  await page.getByRole('link', { name: 'one-week TypeScript plan' }).click()
  await expect(heading(page)).toHaveText(plan.title)
})

test('a TypeScript lesson deep link opens the lesson in its track', async ({ page }) => {
  const id = track.lessons.at(-1)
  await page.goto(`./#tracks/typescript/${id}`)
  await expect(page).toHaveURL(new RegExp(`#tracks/typescript/${id}$`))
  await expect(page.locator(`#lesson-${id}`)).toBeVisible()
})

test('Ctrl+K finds the TypeScript skill test and it runs both tasks', async ({ page }) => {
  await page.goto('./#home')
  await expect(heading(page)).toBeVisible()
  await page.keyboard.press(`${process.platform === 'darwin' ? 'Meta' : 'Control'}+k`)
  const palette = page.getByRole('dialog', { name: 'Search DevPREP' })
  await palette.getByRole('combobox').fill(skillTest.title)
  await expect(palette.getByRole('option', { name: new RegExp(skillTest.title) }).first()).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#skilltest\/typescript$/)
  await expect(heading(page)).toHaveText(skillTest.title)
  await page.getByRole('button', { name: 'Start the test' }).click()
  await expect(page.locator('fieldset.skill-question')).toHaveCount(skillTest.pick)
  await expect(page.locator('.skill-task .task-workspace')).toHaveCount(skillTest.tasks.length)
})