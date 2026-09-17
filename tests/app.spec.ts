import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { lessons } from '../src/curriculum'
import { beginSession, completeSession, emptyProgress, STORAGE_KEY } from '../src/progress'

const first = lessons[0]

async function startPractice(page: Page) {
  await page.goto('./')
  await page.getByRole('button', { name: 'Start today’s lesson' }).click()
  await expect(page.getByRole('heading', { name: first.title, exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Continue to practice' }).click()
}

async function saved(page: Page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY)
}

function completedYesterday() {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  let progress = beginSession(emptyProgress(yesterday), first.id, 'learn', yesterday)
  progress.session = { ...progress.session!, phase: 'assess', draft: 'Previous attempt' }
  progress = completeSession(progress, 'again', yesterday)
  return progress
}

test('learn, practice, hint, resume, reflect, schedule, and daily completion', async ({ page }) => {
  await startPractice(page)
  await expect(page.getByRole('button', { name: 'Compare & reflect' })).toBeDisabled()
  await page.getByLabel('Your approach & answer').fill('Track what has been seen in a map. Explain each lookup and test edge cases.')
  await page.getByRole('button', { name: 'Need a hint?' }).click()
  await expect(page.getByText(first.hints[0], { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Pause session' }).click()
  await expect(page.getByRole('button', { name: 'Resume session' })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Resume session' }).click()
  await expect(page.getByLabel('Your approach & answer')).toHaveValue(/Track what has been seen/)
  await expect(page.getByText(first.hints[0], { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Reveal worked solution' }).click()
  await expect(page.getByText(first.solution, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Compare & reflect' }).click()
  await page.getByRole('checkbox').first().check()
  await page.reload()
  await expect(page.getByRole('checkbox').first()).toBeChecked()
  await page.getByRole('button', { name: 'Getting there' }).click()
  await expect(page.getByRole('status')).toContainText('Next review')
  await expect(page.getByRole('heading', { name: 'New idea, explored' })).toBeVisible()
  const progress = await saved(page)
  expect(progress.session).toBeNull()
  expect(progress.records[first.id].intervalDays).toBe(3)
  expect(progress.activity).toHaveLength(1)
  await page.getByRole('link', { name: 'Review', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'You’re all caught up.' })).toBeVisible()
  await expect(page.getByText(first.title, { exact: true })).toBeVisible()
})

test('due review is recall-first, resumable, and rescheduled without duplicate completion', async ({ page }) => {
  const seed = completedYesterday()
  await page.addInitScript(({ key, seed }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(seed))
  }, { key: STORAGE_KEY, seed })
  await page.goto('./#review')
  await page.getByRole('button', { name: 'Review now' }).click()
  await expect(page.getByLabel('Your approach & answer')).toHaveValue('')
  await page.getByLabel('Your approach & answer').fill('Explain the invariant from memory, and why it handles duplicate values.')
  await page.getByRole('link', { name: 'Pause session' }).click()
  await page.goto('./#review')
  await page.getByRole('button', { name: 'Resume review' }).click()
  await page.getByRole('button', { name: 'Compare & reflect' }).click()
  await page.getByRole('button', { name: 'Confident', exact: false }).click()
  const progress = await saved(page)
  expect(progress.records[first.id].attempts).toBe(2)
  expect(progress.records[first.id].intervalDays).toBe(2)
  expect(Object.keys(progress.records)).toHaveLength(1)
  expect(progress.activity.at(-1).mode).toBe('review')
  await expect(page.getByRole('heading', { name: 'Recall, reinforced' })).toBeVisible()
})

test('export and confirmed import restore draft, progress, and review dates', async ({ page }) => {
  await startPractice(page)
  await page.getByLabel('Your approach & answer').fill('Backup this unfinished answer.')
  await page.goto('./#progress')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export backup' }).click()
  const download = await downloadPromise
  const path = await download.path()
  expect(path).toBeTruthy()
  const before = await saved(page)
  await page.evaluate(key => localStorage.removeItem(key), STORAGE_KEY)
  await page.reload()
  await page.getByLabel('Import progress JSON').setInputFiles(path!)
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Cancel import' }).click()
  expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBeNull()
  await page.getByLabel('Import progress JSON').setInputFiles(path!)
  await page.getByRole('button', { name: 'Replace progress' }).click()
  expect(await saved(page)).toEqual(before)
  await page.getByRole('button', { name: 'Resume session' }).click()
  await expect(page.getByLabel('Your approach & answer')).toHaveValue('Backup this unfinished answer.')
})

test('invalid and oversized imports leave existing progress untouched', async ({ page }) => {
  await startPractice(page)
  await page.getByLabel('Your approach & answer').fill('Keep me safe.')
  const before = await saved(page)
  await page.goto('./#progress')
  await page.getByLabel('Import progress JSON').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"version":100}') })
  await expect(page.getByRole('alert')).toContainText('Existing progress was not changed')
  expect(await saved(page)).toEqual(before)
  await page.getByLabel('Import progress JSON').setInputFiles({ name: 'large.json', mimeType: 'application/json', buffer: Buffer.alloc(1_000_001, ' ') })
  await expect(page.getByRole('alert')).toContainText('1 MB')
  expect(await saved(page)).toEqual(before)
  const invalidReflection = { ...before, session: { ...before.session, phase: 'assess', draft: ' ' } }
  await page.getByLabel('Import progress JSON').setInputFiles({ name: 'empty-reflection.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(invalidReflection)) })
  await expect(page.getByRole('alert')).toContainText('reflection requires a written attempt')
  expect(await saved(page)).toEqual(before)
})

test('failed import does not replace in-memory or saved progress', async ({ page }) => {
  await startPractice(page)
  await page.getByLabel('Your approach & answer').fill('Keep this answer.')
  const before = await saved(page)
  await page.goto('./#progress')
  await page.evaluate(() => {
    Storage.prototype.setItem = () => { throw new DOMException('Storage is full', 'QuotaExceededError') }
  })
  await page.getByLabel('Import progress JSON').setInputFiles({ name: 'valid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(completedYesterday())) })
  await page.getByRole('button', { name: 'Replace progress' }).click()
  await expect(page.getByRole('alert')).toContainText('Backup was not applied')
  expect(await saved(page)).toEqual(before)
  await page.goto('./#study')
  await expect(page.getByLabel('Your approach & answer')).toHaveValue('Keep this answer.')
})

test('quota errors retain drafts in memory, warn, and can be retried', async ({ page }) => {
  await startPractice(page)
  await page.getByLabel('Your approach & answer').fill('Saved version')
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Object.defineProperty(window, 'restoreStorage', { value: () => { Storage.prototype.setItem = original } })
    Storage.prototype.setItem = () => { throw new DOMException('Storage is full', 'QuotaExceededError') }
  })
  await page.getByLabel('Your approach & answer').fill('Unsaved but recoverable')
  await expect(page.getByRole('alert')).toContainText('only in memory')
  expect((await saved(page)).session.draft).toBe('Saved version')
  await expect(page.getByLabel('Your approach & answer')).toHaveValue('Unsaved but recoverable')
  await page.evaluate(() => { (window as unknown as { restoreStorage: () => void }).restoreStorage() })
  await page.getByRole('button', { name: 'Retry saving' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect((await saved(page)).session.draft).toBe('Unsaved but recoverable')
})

test('corrupted saved data enters non-destructive recovery and can restore a backup', async ({ page }) => {
  await page.addInitScript(key => localStorage.setItem(key, '{broken'), STORAGE_KEY)
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'Let’s protect your progress.' })).toBeVisible()
  expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe('{broken')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download original data' }).click()
  expect((await downloadPromise).suggestedFilename()).toContain('recovery')
  await page.getByLabel('Import progress JSON').setInputFiles({ name: 'valid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(completedYesterday())) })
  await page.getByRole('button', { name: 'Replace progress' }).click()
  await expect(page.getByRole('heading', { name: 'A little better, every day.' })).toBeVisible()
  expect(Object.keys((await saved(page)).records)).toEqual([first.id])
})

test('unavailable storage is surfaced rather than silently resetting', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException('Storage disabled', 'SecurityError') }
  })
  await page.goto('./')
  await expect(page.getByRole('alert')).toContainText('Storage disabled')
  await expect(page.getByRole('heading', { name: 'Let’s protect your progress.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start today’s lesson' })).toHaveCount(0)
})

test('another tab cannot silently overwrite this tab’s progress', async ({ page, context }) => {
  await startPractice(page)
  await page.getByLabel('Your approach & answer').fill('First tab draft')
  const other = await context.newPage()
  await other.goto('./#study')
  await other.getByLabel('Your approach & answer').fill('Second tab saved draft')
  await expect(page.getByRole('alert')).toContainText('another tab')
  await page.getByLabel('Your approach & answer').fill('First tab unsaved changes')
  expect((await saved(page)).session.draft).toBe('Second tab saved draft')
  await expect(page.getByRole('alert')).toContainText('only in memory')
  await expect(page.getByRole('button', { name: 'Export current work' })).toBeVisible()
})

test('all tracks offer substantive, refresh-safe lessons and prompts', async ({ page }) => {
  await page.goto('./#roadmap')
  await expect(page.getByRole('heading', { name: 'Your learning roadmap' })).toBeVisible()
  page.on('dialog', dialog => dialog.accept())
  for (const track of ['dsa', 'system-design', 'ml', 'behavioral']) {
    const lesson = lessons.find(item => item.track === track)!
    const row = page.getByRole('article').filter({ has: page.getByRole('heading', { name: lesson.title, exact: true }) })
    await row.getByRole('button', { name: 'Start lesson' }).click()
    await page.reload()
    await expect(page.getByRole('heading', { name: lesson.title, exact: true })).toBeVisible()
    await page.getByLabel('In this lesson').selectOption('concept-0')
    await expect(page.getByText(lesson.concepts[0].body, { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Continue to practice' }).click()
    await expect(page.getByText(lesson.task, { exact: true })).toBeVisible()
    await expect(page.getByText('Nothing is executed or automatically graded.', { exact: false })).toBeVisible()
    await page.goto('./#roadmap')
  }
})

test('session replacement can be cancelled without losing an answer', async ({ page }) => {
  await startPractice(page)
  await page.getByLabel('Your approach & answer').fill('Do not lose my work.')
  await page.goto('./#roadmap')
  page.once('dialog', dialog => dialog.dismiss())
  const next = page.getByRole('article').filter({ has: page.getByRole('heading', { name: lessons[1].title, exact: true }) })
  await next.getByRole('button', { name: 'Start lesson' }).click()
  expect((await saved(page)).session.draft).toBe('Do not lose my work.')
  await page.getByRole('button', { name: 'Resume', exact: true }).click()
  await expect(page.getByLabel('Your approach & answer')).toHaveValue('Do not lose my work.')
})

test('explicit light and dark overrides win over the system preference', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('./?scoutTheme=light')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.getByRole('button', { name: 'Toggle color theme' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('./?scoutTheme=dark')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.goto('./?scoutTheme=invalid')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})

test('keyboard skip link and navigation reach focused content', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('link', { name: 'Skip to content' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('main')).toBeFocused()
  await page.getByRole('link', { name: 'Roadmap', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
  await expect(page).toHaveURL(/#roadmap$/)
})

test('narrow screens have no horizontal overflow and a single focused study step', async ({ page }) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (const route of ['today', 'roadmap', 'review', 'progress']) {
      await page.goto(`./#${route}`)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    }
  }
  await page.setViewportSize({ width: 320, height: 780 })
  await startPractice(page)
  await expect(page.locator('.lesson-content')).toBeHidden()
  await expect(page.locator('.practice-content')).toBeVisible()
  await page.getByLabel('Your approach & answer').fill('A'.repeat(400))
  await page.getByRole('button', { name: 'Compare & reflect' }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  for (const button of await page.locator('.rating-options button').all()) {
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  }
  await page.getByRole('button', { name: 'Learn', exact: false }).click()
  await expect(page.locator('.lesson-content')).toBeVisible()
  await expect(page.locator('.practice-content')).toBeHidden()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('GitHub Pages base and unknown hashes stay on the app shell', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('./#not-a-page')
  await expect(page.getByRole('heading', { name: 'This page isn’t on the roadmap.' })).toBeVisible()
  await page.getByRole('button', { name: 'Back to Today' }).click()
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('A little better, every day.')
  expect(errors).toEqual([])
  expect(await page.locator('script[src]').getAttribute('src')).toMatch(/^\/DevPREP\/assets\//)
})

test('capture key screens for visual inspection', async ({ page }, testInfo) => {
  await page.goto('./?scoutTheme=light')
  await page.screenshot({ path: testInfo.outputPath('today-light.png'), fullPage: true })
  await startPractice(page)
  await page.getByLabel('Your approach & answer').fill('Keep a map from value to index. Before inserting each number, look up its complement.\nThis prevents reusing the same position.')
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: testInfo.outputPath('practice-light.png'), fullPage: true })
  await page.getByRole('button', { name: 'Compare & reflect' }).click()
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: testInfo.outputPath('reflect-light.png'), fullPage: true })
  await page.goto('./?scoutTheme=dark#roadmap')
  await page.screenshot({ path: testInfo.outputPath('roadmap-dark.png'), fullPage: true })
})
