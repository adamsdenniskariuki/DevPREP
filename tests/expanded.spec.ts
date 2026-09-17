import { expect, test } from '@playwright/test'
import { lessons, tracks } from '../src/curriculum'
import { beginSession, completeSession, emptyProgress, parseBackup, STORAGE_KEY } from '../src/progress'
import { lessonSections } from '../src/lesson-sections'
import legacyBackup from './fixtures/v1-progress.json' with { type: 'json' }

test('real MVP backup resumes its original answer, checklist, hints, and review schedule', async ({ page }) => {
  await page.goto('./#progress')
  await page.getByLabel('Import progress JSON').setInputFiles({
    name: 'v1-progress.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(legacyBackup)),
  })
  await page.getByRole('button', { name: 'Replace progress' }).click()
  await page.getByRole('button', { name: 'Resume session' }).click()
  await expect(page.getByRole('heading', { name: 'Explain it. Then be honest.' })).toBeVisible()
  await expect(page.getByText(legacyBackup.session.draft, { exact: true })).toBeVisible()
  await expect(page.getByRole('checkbox').first()).toBeChecked()
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY)).toEqual(legacyBackup)
  await page.getByRole('button', { name: 'Back to my answer' }).click()
  const lesson = lessons.find(item => item.id === legacyBackup.session.lessonId)!
  for (const hint of lesson.hints) await expect(page.getByText(hint, { exact: true })).toBeVisible()
  await expect(page.getByText(lesson.solution, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Compare & reflect' }).click()
  await page.getByRole('button', { name: 'Needs practice' }).click()
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY)
  expect(saved.records['hash-map-complements']).toEqual(legacyBackup.records['hash-map-complements'])
  expect(saved.records['two-pointers-sorted-pairs'].attempts).toBe(1)
  expect(saved.session).toBeNull()
})

test('reading bookmarks survive reload, pause, export/import and phase changes without changing a draft', async ({ page }) => {
  await page.addInitScript(({ key, data }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(data))
  }, { key: STORAGE_KEY, data: legacyBackup })
  await page.goto('./#study')
  await page.getByRole('button', { name: 'Learn', exact: false }).click()
  await page.getByLabel('In this lesson').selectOption('walkthrough-1')
  const lesson = lessons.find(item => item.id === legacyBackup.session.lessonId)!
  await expect(page.getByRole('heading', { name: lesson.walkthrough[1].title, exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('In this lesson')).toHaveValue('walkthrough-1')
  await page.getByRole('link', { name: 'Pause session' }).click()
  await page.getByRole('button', { name: 'Resume session' }).click()
  await expect(page.getByLabel('In this lesson')).toHaveValue('walkthrough-1')
  await page.getByRole('button', { name: 'Continue to practice' }).click()
  await expect(page.getByLabel('Your approach & answer')).toHaveValue(legacyBackup.session.draft)
  const saved = await page.evaluate(key => localStorage.getItem(key)!, STORAGE_KEY)
  const imported = parseBackup(saved)
  expect(imported.session?.readingSection).toBe('walkthrough-1')
  expect(imported.records).toEqual(legacyBackup.records)
  expect(imported.session?.checks).toEqual(legacyBackup.session.checks)
  expect(imported.session?.hintsRevealed).toBe(2)
})

test('optional warm-up and stretch have hints and rubrics while sharing the saved notebook', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Start today’s lesson' }).click()
  await page.getByRole('button', { name: 'Continue to practice' }).click()
  const lesson = lessons[0]
  await page.getByLabel('Your approach & answer').fill('Core approach: explain the invariant.\nWarm-up notes: work through a small example.')
  for (const exercise of lesson.extraPractice) {
    await page.getByRole('button', { name: exercise.id === 'warmup' ? 'Warm-up' : 'Stretch', exact: true }).click()
    await expect(page.getByText(exercise.prompt, { exact: true })).toBeVisible()
    await page.getByRole('button', { name: `Show ${exercise.id} hint 1` }).click()
    await expect(page.getByText(exercise.hints[0], { exact: true })).toBeVisible()
    await page.getByRole('button', { name: `Show ${exercise.id} hint 2` }).click()
    await expect(page.getByText(exercise.hints[1], { exact: true })).toBeVisible()
    await page.getByText(`${exercise.id === 'warmup' ? 'Warm-up' : 'Stretch'} worked answer & rubric`, { exact: true }).click()
    await expect(page.getByText(exercise.solution, { exact: true })).toBeVisible()
    await expect(page.getByText(exercise.checklist[0], { exact: true })).toBeVisible()
    await expect(page.getByLabel('Your approach & answer')).toHaveValue(/Core approach: explain the invariant/)
  }
  await page.getByRole('button', { name: 'Core task', exact: true }).click()
  await expect(page.getByText(lesson.task, { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Your approach & answer')).toHaveValue(/Warm-up notes/)
  await page.getByRole('button', { name: 'Compare & reflect' }).click()
  await page.getByText(lesson.followUps[0].question, { exact: true }).click()
  await expect(page.getByText(lesson.followUps[0].answer, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Getting there' }).click()
  const progress = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY)
  expect(progress.activity).toHaveLength(1)
  expect(progress.records[lesson.id].attempts).toBe(1)
})

test('prerequisites are reachable but cannot discard an unfinished notebook without confirmation', async ({ page }) => {
  const lesson = lessons.find(item => item.prerequisites.length > 0)!
  const seed = beginSession(emptyProgress(), lesson.id, 'learn')
  seed.session!.draft = 'Keep this notebook safe.'
  await page.addInitScript(({ key, seed }) => localStorage.setItem(key, JSON.stringify(seed)), { key: STORAGE_KEY, seed })
  await page.goto('./#study')
  const prerequisite = lessons.find(item => item.id === lesson.prerequisites[0])!
  page.once('dialog', dialog => dialog.dismiss())
  await page.getByRole('button', { name: prerequisite.title, exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(lesson.title)
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).session.draft, STORAGE_KEY)).toBe('Keep this notebook safe.')
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: prerequisite.title, exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(prerequisite.title)
})

test('Today suggests added material without resetting a completed original roadmap', async ({ page }) => {
  let seed = emptyProgress()
  const originalIds = [
    'hash-map-complements', 'two-pointers-sorted-pairs', 'sliding-window-distinct',
    'binary-search-lower-bound', 'stack-balanced-delimiters', 'graph-bfs-shortest-hops',
    'design-requirements-capacity', 'design-cache-data-flow', 'ml-evaluation-leakage',
    'ml-bias-variance', 'behavioral-star-evidence', 'behavioral-tradeoffs-conflict',
  ]
  for (const id of originalIds) {
    seed = beginSession(seed, id, 'learn')
    seed.session = { ...seed.session!, phase: 'assess', draft: 'Earlier study' }
    seed = completeSession(seed, 'confident')
  }
  await page.addInitScript(({ key, seed }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(seed))
  }, { key: STORAGE_KEY, seed })
  await page.goto('./')
  const next = lessons.find(item => !originalIds.includes(item.id))!
  await expect(page.getByRole('heading', { name: next.title, exact: true })).toBeVisible()
  await expect(page.getByRole('progressbar', { name: 'Overall progress' })).toHaveAttribute('value', '12')
  await expect(page.getByRole('progressbar', { name: 'Overall progress' })).toHaveAttribute('max', String(lessons.length))
  await page.getByRole('button', { name: 'Study another lesson' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(next.title)
  expect(await page.evaluate(key => Object.keys(JSON.parse(localStorage.getItem(key)!).records).length, STORAGE_KEY)).toBe(12)
})

test('section navigation works by keyboard and does not change the refresh-safe route', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Start today’s lesson' }).click()
  await page.getByRole('button', { name: 'Next section', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: lessons[0].concepts[0].title, exact: true })).toBeFocused()
  await expect(page).toHaveURL(/#study$/)
  await page.getByLabel('In this lesson').selectOption('takeaways')
  await expect(page.getByRole('button', { name: 'Next section', exact: true })).toBeDisabled()
  await page.reload()
  await expect(page.getByLabel('In this lesson')).toHaveValue('takeaways')
})

for (const track of tracks) {
  test(`${track.title}: every lesson has reachable, narrow-screen-safe learning and practice`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.setViewportSize({ width: 320, height: 780 })
    await page.goto('./#roadmap')
    await page.getByRole('button', { name: track.title, exact: true }).click()
    const trackLessons = lessons.filter(lesson => lesson.track === track.id)
    await expect(page.getByRole('article')).toHaveCount(trackLessons.length)
    const titles = await page.getByRole('article').getByRole('heading', { level: 3 }).allTextContents()
    expect(titles).toEqual(trackLessons.map(lesson => lesson.title))
    page.on('dialog', dialog => dialog.accept())
    for (const lesson of trackLessons) {
      const row = page.getByRole('article').filter({ has: page.getByRole('heading', { name: lesson.title, exact: true }) })
      await row.getByRole('button', { name: 'Start lesson' }).click()
      await expect(page.getByRole('heading', { name: lesson.title, exact: true })).toBeVisible()
      await expect(page.getByText(lesson.prerequisiteNotes, { exact: true })).toBeVisible()
      await expect(page.getByLabel('In this lesson').locator('option')).toHaveCount(lessonSections(lesson).length)
      for (const sectionId of ['concept-0', 'example', 'walkthrough-1', 'pitfalls', 'takeaways']) {
        await page.getByLabel('In this lesson').selectOption(sectionId)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${lesson.id}/${sectionId} overflows`).toBe(true)
      }
      await expect(page.getByText(lesson.takeaways[0], { exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'Continue to practice' }).click()
      await expect(page.getByText(lesson.task, { exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'Stretch', exact: true }).click()
      await expect(page.getByText(lesson.extraPractice[1].prompt, { exact: true })).toBeVisible()
      await page.getByText('Stretch worked answer & rubric', { exact: true }).click()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await page.getByRole('link', { name: 'Roadmap', exact: true }).click()
    }
  })
}

test('capture chunked reading and staged practice for visual review', async ({ page }, testInfo) => {
  const lesson = lessons[0]
  const seeded = beginSession(emptyProgress(), lesson.id, 'learn')
  const codeIndex = lesson.concepts.findIndex(section => section.code)
  seeded.session!.readingSection = codeIndex >= 0 ? `concept-${codeIndex}` : 'walkthrough-0'
  await page.addInitScript(({ key, seeded }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(seeded))
  }, { key: STORAGE_KEY, seeded })
  await page.goto('./?scoutTheme=light#study')
  await page.screenshot({ path: testInfo.outputPath('reading-light.png'), fullPage: true })
  await page.getByRole('button', { name: 'Continue to practice' }).click()
  await page.getByRole('button', { name: 'Stretch', exact: true }).click()
  await page.getByRole('button', { name: 'Show stretch hint 1' }).click()
  await page.getByText('Stretch worked answer & rubric', { exact: true }).click()
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: testInfo.outputPath('stretch-light.png'), fullPage: true })
})
