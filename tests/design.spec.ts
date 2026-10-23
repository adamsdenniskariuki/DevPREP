import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

const PROGRESS_KEY = 'devprep.progress.v1'
const DRAFTS_KEY = 'devprep.design.v1'
const item = JSON.parse(readFileSync(new URL('../content/cases/url-shortener.json', import.meta.url), 'utf8'))
const index = JSON.parse(readFileSync(new URL('../content/cases/index.json', import.meta.url), 'utf8'))

async function openCase(page: Page) {
  await page.goto('./#practice')
  await page.getByRole('link', { name: /System design/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Case studies' })).toBeFocused()
  await expect(page.locator('.code-row')).toHaveCount(index.cases.length)
  await page.getByRole('link', { name: item.title }).click()
  await expect(page.getByRole('heading', { level: 1, name: item.title })).toBeFocused()
  await expect(page.getByText(item.prompt)).toBeVisible()
}

test('the timer runs and pauses, and notes and the whiteboard survive a reload', async ({ page }) => {
  await openCase(page)
  const timer = page.getByRole('timer')
  await expect(timer).toHaveText(`${item.minutes}:00`)
  await page.getByRole('button', { name: 'Start timer' }).click()
  await expect(timer).not.toHaveText(`${item.minutes}:00`, { timeout: 3000 })
  await page.getByRole('button', { name: 'Pause' }).click()
  const paused = await timer.textContent()
  await page.waitForTimeout(1200)
  await expect(timer).toHaveText(paused!)

  await page.getByRole('textbox', { name: 'Requirements notes' }).fill('Shorten, redirect, 100:1 reads')

  await page.getByLabel('Type', { exact: true }).first().selectOption('client')
  await page.getByLabel('Label', { exact: true }).fill('Browser')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await page.getByLabel('Type', { exact: true }).first().selectOption('service')
  await page.getByLabel('Label', { exact: true }).fill('Link API')
  await page.getByLabel('Label', { exact: true }).press('Enter')
  const api = page.getByRole('button', { name: 'Link API, Service' })
  await expect(api).toBeVisible()
  await page.getByRole('button', { name: 'Browser, Client' }).click()
  await page.getByLabel('Connect to').selectOption({ label: 'Link API' })
  await page.getByLabel('Arrow label').fill('GET /abc')
  await page.getByRole('button', { name: 'Connect', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Connected Browser to Link API.' })).toBeAttached()

  const before = await api.getAttribute('transform')
  await api.focus()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Shift+ArrowRight')
  await expect(api).not.toHaveAttribute('transform', before!)

  await page.reload()
  await expect(page.getByRole('timer')).toHaveText(paused!)
  await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Requirements notes' })).toHaveValue('Shorten, redirect, 100:1 reads')
  await expect(page.getByRole('button', { name: 'Link API, Service' })).toHaveAttribute('transform', /translate\(232 32\)/)
  await page.getByText(/Connections and text description \(1\)/).click()
  await expect(page.locator('.wb-edges')).toContainText('Browser → Link API: GET /abc')
  const drafts = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), DRAFTS_KEY)
  expect(drafts[item.id].board.nodes).toHaveLength(2)

  await page.getByRole('button', { name: 'Link API, Service' }).focus()
  await page.keyboard.press('Delete')
  await expect(page.getByRole('button', { name: 'Link API, Service' })).toHaveCount(0)
  await expect(page.locator('.wb-details summary')).toContainText('(0)')
})

test('review shows the model answer, scores the rubric, earns XP once and lands in backups', async ({ page }) => {
  await openCase(page)
  await page.locator('.case-step summary', { hasText: 'API' }).click()
  await page.getByRole('textbox', { name: 'API notes' }).fill('POST /links returns a code')
  await page.getByRole('button', { name: 'Finish & review' }).click()
  await expect(page.getByRole('heading', { name: 'Review against the model answer' })).toBeFocused()
  await expect(page.getByText('POST /links returns a code')).toBeVisible()
  await expect(page.getByText(item.steps.api[0])).toBeVisible()
  await expect(page.getByRole('img', { name: /Model design for URL shortener/ })).toBeVisible()

  const scored = item.rubric.filter((rubric: { sse?: boolean }) => !rubric.sse).length
  await expect(page.getByText(`Mark all ${scored} scored items`)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save score' })).toBeDisabled()
  await expect(page.locator('.rubric-item .pill', { hasText: 'stretch' })).toHaveCount(item.rubric.length - scored)
  const groups = page.locator('.rubric-item')
  for (let i = 0; i < scored; i++) await groups.nth(i).getByText(i === 0 ? 'Partly' : 'Covered').click()
  const percent = Math.round((scored * 2 - 1) / (scored * 2) * 100)
  await expect(page.getByText(`Score: ${percent}%`)).toBeVisible()
  await page.getByRole('button', { name: 'Save score' }).click()
  await expect(page.getByText(`Saved ${percent}%. +35 XP`)).toBeVisible()
  await page.getByRole('button', { name: 'Save score' }).click()
  await expect(page.getByText(`Saved ${percent}%. Your best score is unchanged.`)).toBeVisible()

  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), PROGRESS_KEY)
  expect(saved.designs[item.id].best).toBe(percent)

  await page.getByRole('link', { name: /All case studies/ }).click()
  await expect(page.locator('.code-row', { hasText: item.title }).locator('.pill.solved')).toHaveText(`Best ${percent}%`)
  await page.getByRole('link', { name: 'Progress', exact: true }).first().click()
  await expect(page.locator('.badge.earned', { hasText: 'Architect' })).toBeVisible()

  await page.getByRole('link', { name: 'Settings', exact: true }).first().click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: /Export/ }).first().click()
  const backup = JSON.parse(readFileSync(await (await download).path(), 'utf8'))
  expect(backup.designs[item.id].best).toBe(percent)
})

test('the whiteboard list and case pages fit a 320px screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 })
  await page.goto('./#design/not-a-case')
  await expect(page.getByRole('heading', { level: 1, name: 'This page isn’t on the roadmap.' })).toBeVisible()
  await page.goto('./#design')
  await expect(page.getByRole('heading', { level: 1, name: 'Case studies' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('link', { name: /Whiteboards/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Whiteboards' })).toBeFocused()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'New board' }).click()
  await expect(page.getByTestId('excalidraw-canvas').locator('canvas').first()).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.goto(`./#design/${item.id}`)
  await expect(page.getByRole('heading', { level: 1, name: item.title })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await expect(page.getByRole('link', { name: 'Practice', exact: true }).first()).toHaveAttribute('class', /active/)
})
