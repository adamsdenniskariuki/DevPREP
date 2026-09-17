import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { lessons } from '../src/curriculum'
import { getLearningPath, pathLessonIds, selectPath } from '../src/learning-paths'
import type { PathId } from '../src/learning-paths'
import { beginSession, completeSession, emptyProgress, STORAGE_KEY } from '../src/progress'
import legacyBackup from './fixtures/v1-progress.json' with { type: 'json' }

const swe = getLearningPath('swe')!
const senior = getLearningPath('senior')!

async function choose(page: Page, id: PathId | '') {
  await page.getByLabel('Learning path', { exact: true }).selectOption(id)
}

async function saved(page: Page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY)
}

function completed(ids: string[], now = new Date()) {
  let value = emptyProgress(now)
  for (const id of ids) {
    value = beginSession(value, id, 'learn', now)
    value.session = { ...value.session!, phase: 'assess', draft: 'Worked through this lesson.' }
    value = completeSession(value, 'again', now)
  }
  return value
}

test('path selection is optional and old users keep their original state and next lesson', async ({ page }) => {
  await page.addInitScript(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key: STORAGE_KEY, data: legacyBackup })
  await page.goto('./')
  await expect(page.getByLabel('Learning path', { exact: true })).toHaveValue('')
  await expect(page.getByRole('button', { name: 'Resume session' })).toBeVisible()
  expect(await saved(page)).toEqual(legacyBackup)
  await page.getByRole('link', { name: 'Roadmap', exact: true }).click()
  await expect(page.getByRole('article')).toHaveCount(46)
  await expect(page.getByRole('button', { name: 'Selected path', exact: true })).toHaveCount(0)
})

test('SWE and Senior change Today deliberately and persist across reload', async ({ page }) => {
  await page.goto('./')
  await choose(page, 'swe')
  await expect(page.locator('.hero-copy h2')).toHaveText(lessons[0].title)
  await expect(page.getByRole('progressbar', { name: 'Selected path progress', exact: true })).toHaveAttribute('max', '29')
  await choose(page, 'senior')
  const first = lessons.find(lesson => lesson.id === pathLessonIds(senior)[0])!
  await expect(page.locator('.hero-copy h2')).toHaveText(first.title)
  await page.reload()
  await expect(page.getByLabel('Learning path', { exact: true })).toHaveValue('senior')
  await expect(page.locator('.hero-copy h2')).toHaveText(first.title)
  await page.getByRole('button', { name: 'Start today’s lesson' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(first.title)
  expect((await saved(page)).selectedPath).toBe('senior')
})

test('selected roadmaps show curated phases and allow all curriculum and optional ML without changing the path', async ({ page }) => {
  await page.goto('./#roadmap')
  for (const path of [swe, senior]) {
    await choose(page, path.id)
    await expect(page.getByRole('article')).toHaveCount(pathLessonIds(path).length)
    expect(await page.getByRole('article').getByRole('heading', { level: 3 }).allTextContents()).toEqual(
      pathLessonIds(path).map(id => lessons.find(lesson => lesson.id === id)!.title),
    )
    for (const phase of path.phases) await expect(page.getByRole('heading', { name: phase.title, exact: true })).toBeVisible()
  }
  await page.getByRole('button', { name: 'All curriculum', exact: true }).click()
  await expect(page.getByRole('article')).toHaveCount(46)
  await page.getByRole('button', { name: 'Machine learning', exact: true }).click()
  await expect(page.getByRole('article')).toHaveCount(9)
  expect((await saved(page)).selectedPath).toBe('senior')
  await page.getByRole('article').first().getByRole('button', { name: 'Start lesson' }).click()
  await expect(page.getByText('Supplemental lesson outside your selected path', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Pause session' }).click()
  await expect(page.getByText('Your unfinished session is outside this path.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Resume session' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(lessons.find(lesson => lesson.id === 'ml-data-preparation')!.title)
})

test('switching while studying preserves the whole notebook, bookmark, hints, checks and records', async ({ page }) => {
  const seed = { ...legacyBackup, session: { ...legacyBackup.session, readingSection: 'walkthrough-1' } }
  await page.addInitScript(({ key, data }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(data))
  }, { key: STORAGE_KEY, data: seed })
  await page.goto('./#study')
  for (const id of ['senior', 'swe', ''] as const) {
    await choose(page, id)
    await expect(page.getByRole('checkbox').first()).toBeChecked()
    const current = await saved(page)
    expect(current.session).toEqual(seed.session)
    expect(current.records).toEqual(seed.records)
    expect(current.activity).toEqual(seed.activity)
    expect(current.selectedPath).toBe(id || undefined)
  }
  await page.getByRole('button', { name: 'Learn', exact: false }).click()
  await expect(page.getByLabel('In this lesson')).toHaveValue('walkthrough-1')
  await page.reload()
  await expect(page.getByLabel('In this lesson')).toHaveValue('walkthrough-1')
  await page.getByRole('button', { name: 'Continue to practice' }).click()
  await expect(page.getByLabel('Your approach & answer')).toHaveValue(seed.session.draft)
})

test('global pending reviews remain visible and resumable after either path is selected', async ({ page }) => {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const seed = completed(['ml-data-preparation'], yesterday)
  await page.addInitScript(({ key, seed }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(seed))
  }, { key: STORAGE_KEY, seed })
  await page.goto('./#review')
  await choose(page, 'senior')
  await expect(page.getByRole('button', { name: 'Review now' })).toBeVisible()
  await page.getByRole('button', { name: 'Review now' }).click()
  await page.getByLabel('Your approach & answer').fill('Only use data available at prediction time.')
  await choose(page, 'swe')
  await page.getByRole('link', { name: 'Pause session' }).click()
  await page.getByRole('link', { name: 'Review', exact: false }).click()
  await page.getByRole('button', { name: 'Resume review' }).click()
  await expect(page.getByLabel('Your approach & answer')).toHaveValue('Only use data available at prediction time.')
  await page.getByRole('button', { name: 'Compare & reflect' }).click()
  await page.getByRole('button', { name: 'Getting there' }).click()
  const current = await saved(page)
  expect(current.selectedPath).toBe('swe')
  expect(current.records['ml-data-preparation'].attempts).toBe(2)
  await page.getByRole('link', { name: 'Review', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'You’re all caught up.' })).toBeVisible()
})

test('path and overall progress use distinct denominators and shared completions', async ({ page }) => {
  const seed = selectPath(completed(['arrays-prefix-foundations', 'ml-data-preparation']), 'swe')
  await page.addInitScript(({ key, seed }) => localStorage.setItem(key, JSON.stringify(seed)), { key: STORAGE_KEY, seed })
  await page.goto('./#progress')
  await expect(page.getByRole('progressbar', { name: 'Software Engineer path progress', exact: true })).toHaveAttribute('value', '1')
  await expect(page.getByRole('progressbar', { name: 'Software Engineer path progress', exact: true })).toHaveAttribute('max', '29')
  await expect(page.getByRole('progressbar', { name: 'Senior Software Engineer path progress', exact: true })).toHaveAttribute('value', '1')
  await expect(page.getByRole('progressbar', { name: 'Senior Software Engineer path progress', exact: true })).toHaveAttribute('max', '30')
  await expect(page.locator('.summary-grid .card').first()).toContainText('2 / 46')
})

test('path completion does not auto-enroll supplemental lessons and switching finds the next missing senior topic', async ({ page }) => {
  const seed = selectPath(completed(pathLessonIds(swe)), 'swe')
  await page.addInitScript(({ key, seed }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(seed))
  }, { key: STORAGE_KEY, seed })
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'Software Engineer path explored.', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Explore all lessons', exact: true }).click()
  await expect(page.getByRole('article')).toHaveCount(46)
  await choose(page, 'senior')
  await page.getByRole('link', { name: 'Today', exact: true }).click()
  await expect(page.locator('.hero-copy h2')).toHaveText(lessons.find(lesson => lesson.id === 'design-replication-partitioning')!.title)
  await expect(page.getByRole('progressbar', { name: 'Selected path progress', exact: true })).toHaveAttribute('value', '24')
})

test('senior extensions are reachable, honest self-reflection and do not create extra completions', async ({ page }) => {
  await page.goto('./')
  await choose(page, 'senior')
  await page.getByRole('button', { name: 'Start today’s lesson' }).click()
  await page.getByRole('button', { name: 'Continue to practice' }).click()
  const prompt = senior.prompts[0]
  await page.getByText(`Senior focus: ${prompt.title}`, { exact: true }).click()
  await expect(page.getByText(prompt.prompt, { exact: true })).toBeVisible()
  await expect(page.getByText(prompt.rubric[0], { exact: true })).toBeVisible()
  await page.getByText('One defensible discussion', { exact: true }).click()
  await expect(page.getByText(prompt.discussion, { exact: true })).toBeVisible()
  await page.getByLabel('Your approach & answer').fill('Core: estimate the bounded workload.\nSenior notes: negotiate scope and label assumptions.')
  await choose(page, 'swe')
  await expect(page.getByText(`Senior focus: ${prompt.title}`, { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Your approach & answer')).toHaveValue(/Senior notes/)
  await choose(page, 'senior')
  await page.getByRole('button', { name: 'Compare & reflect' }).click()
  await expect(page.getByText(`Senior focus: ${prompt.title}`, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Getting there' }).click()
  const current = await saved(page)
  expect(current.activity).toHaveLength(1)
  expect(Object.keys(current.records)).toEqual(['design-requirements-capacity'])
  expect(current.selectedPath).toBe('senior')
})

test('path selection exports and imports with the draft; legacy and unknown-path imports are handled explicitly', async ({ page }) => {
  await page.goto('./')
  await choose(page, 'senior')
  await page.getByRole('button', { name: 'Start today’s lesson' }).click()
  await page.getByLabel('In this lesson').selectOption('concept-1')
  await page.getByRole('button', { name: 'Continue to practice' }).click()
  await page.getByLabel('Your approach & answer').fill('Keep this path and draft.')
  await page.goto('./#progress')
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export backup' }).click()
  const download = await downloading
  const file = await download.path()
  const before = await saved(page)
  await choose(page, 'swe')
  await page.getByLabel('Import progress JSON').setInputFiles(file!)
  await expect(page.getByRole('dialog')).toContainText('Learning path after import: Senior Software Engineer')
  await page.getByRole('button', { name: 'Replace progress' }).click()
  expect(await saved(page)).toEqual(before)
  await expect(page.getByLabel('Learning path', { exact: true })).toHaveValue('senior')
  await page.goto('./#progress')
  await page.getByLabel('Import progress JSON').setInputFiles({ name: 'unknown.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...before, selectedPath: 'principal' })) })
  await expect(page.getByRole('alert')).toContainText('unknown learning path')
  expect(await saved(page)).toEqual(before)
  await page.getByLabel('Import progress JSON').setInputFiles({ name: 'legacy.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(legacyBackup)) })
  await expect(page.getByRole('dialog')).toContainText('All curriculum (no path selected)')
  await page.getByRole('button', { name: 'Replace progress' }).click()
  await expect(page.getByLabel('Learning path', { exact: true })).toHaveValue('')
  expect(await saved(page)).toEqual(legacyBackup)
})

test('failed path saves surface errors without losing existing data', async ({ page }) => {
  await page.goto('./')
  await choose(page, 'swe')
  const before = await saved(page)
  await page.evaluate(() => {
    Storage.prototype.setItem = () => { throw new DOMException('Storage full', 'QuotaExceededError') }
  })
  await choose(page, 'senior')
  await expect(page.getByRole('alert')).toContainText('only in memory')
  expect(await saved(page)).toEqual(before)
  await expect(page.getByLabel('Learning path', { exact: true })).toHaveValue('senior')
  await expect(page.getByRole('button', { name: 'Export current work' })).toBeVisible()
})

test('custom-domain root preserves path selection and refresh-safe navigation', async ({ page }) => {
  await page.goto('/')
  await choose(page, 'senior')
  await page.getByRole('link', { name: 'Roadmap', exact: true }).click()
  expect(new URL(page.url()).pathname).toBe('/')
  await expect(page).toHaveURL(/#roadmap$/)
  await page.reload()
  await expect(page.getByLabel('Learning path', { exact: true })).toHaveValue('senior')
  await expect(page.getByRole('article')).toHaveCount(30)
  await page.getByRole('article').first().getByRole('button', { name: 'Start lesson' }).click()
  expect(new URL(page.url()).pathname).toBe('/')
  await page.getByRole('button', { name: 'Continue to practice' }).click()
  await page.getByLabel('Your approach & answer').fill('Custom-domain path notebook.')
  await page.reload()
  await expect(page.getByLabel('Your approach & answer')).toHaveValue('Custom-domain path notebook.')
  await expect(page.getByLabel('Learning path', { exact: true })).toHaveValue('senior')
})

test('path selection and both roadmap scopes remain keyboard accessible and narrow-screen safe', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 780 })
  await page.goto('./')
  await page.getByLabel('Learning path', { exact: true }).focus()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await expect(page.getByLabel('Learning path', { exact: true })).toBeFocused()
  await expect(page.getByLabel('Learning path', { exact: true })).toHaveValue('senior')
  for (const id of ['swe', 'senior'] as const) {
    await choose(page, id)
    for (const route of ['today', 'roadmap', 'review', 'progress']) {
      await page.goto(`./#${route}`)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${id}/${route} overflows`).toBe(true)
    }
    await page.goto('./#roadmap')
    await page.getByRole('button', { name: 'All curriculum', exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('article')).toHaveCount(46)
    await page.getByRole('button', { name: 'Selected path', exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('article')).toHaveCount(pathLessonIds(getLearningPath(id)!).length)
  }
  await page.goto('./')
  await page.screenshot({ path: testInfo.outputPath('senior-today-320.png'), fullPage: true })
  await page.getByText('Compare paths & outcomes', { exact: true }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await expect(page.getByText('Paths are interview-preparation guidance', { exact: false })).toBeVisible()
  const select = await page.getByLabel('Learning path', { exact: true }).boundingBox()
  expect(select!.height).toBeGreaterThanOrEqual(44)
})
