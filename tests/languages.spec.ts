import { expect, test, type Page } from '@playwright/test'
import { readdirSync, readFileSync } from 'node:fs'
import { palettes } from '../src/appearance'
import { color, contrast, over } from './contrast'

const PROGRESS_KEY = 'devprep.progress.v1'
const LANGUAGES = ['python', 'typescript']
const read = (path: string) => JSON.parse(readFileSync(new URL(`../content/${path}`, import.meta.url), 'utf8'))
const languageTracks = LANGUAGES.map(id => read(`${id}/track.json`))
const lessons = LANGUAGES.flatMap(id => readdirSync(new URL(`../content/${id}/`, import.meta.url)).filter(file => file !== 'track.json').map(file => read(`${id}/${file}`)))
const firstOf = (track: { lessons: string[] }) => lessons.find(lesson => lesson.id === track.lessons[0])!
const python = languageTracks[0]
const first = firstOf(python)

async function openLesson(page: Page, lesson = first) {
  await page.goto(`./#tracks/${lesson.track}`)
  await page.locator('article', { has: page.getByRole('heading', { name: lesson.title, exact: true }) }).getByRole('button', { name: /Start lesson|Resume/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: lesson.title })).toBeVisible()
}

/** Visits every reading section and returns the diagram ids it drew. */
async function diagramsShown(page: Page) {
  const picker = page.getByRole('combobox', { name: 'In this lesson' })
  const count = await picker.locator('option').count()
  const seen: string[] = []
  for (let index = 0; index < count; index++) {
    await picker.selectOption({ index })
    await expect(page.getByText('Loading…')).toHaveCount(0)
    seen.push(...await page.locator('.dg-figure').evaluateAll(nodes => nodes.map(node => node.id.replace(/^fig-/, ''))))
  }
  return seen
}

for (const track of languageTracks) {
  test(`${track.title} is listed apart from interview tracks with SE/SSE core tags`, async ({ page }) => {
    await page.goto('./#tracks')
    await page.getByRole('button', { name: track.title, exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Languages' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 3 })).toHaveCount(track.lessons.length)
    await expect(page.locator('.pill', { hasText: 'SE core' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Take placement check' })).toBeVisible()
  })

  test(`a ${track.title} lesson draws every diagram once and checks predict-the-output answers`, async ({ page }) => {
    const first = firstOf(track)
    await openLesson(page, first)
    const seen = await diagramsShown(page)
    expect(seen.sort()).toEqual(first.lab.diagrams.map((diagram: { id: string }) => diagram.id).sort())
    const picker = page.getByRole('combobox', { name: 'In this lesson' })
    await picker.selectOption({ label: await picker.locator('option', { hasText: 'Predict the output' }).innerText() })
    for (const [index, item] of first.lab.predict.entries()) {
      await page.getByRole('group', { name: `Snippet ${index + 1}: what does it print?` }).getByRole('radio', { name: item.choices[item.answer], exact: true }).check()
    }
    await page.getByRole('button', { name: 'Check answers' }).click()
    await expect(page.getByText(`${first.lab.predict.length} of ${first.lab.predict.length}`)).toBeVisible()
  })
}

for (const track of languageTracks) test(`the core exercise runs in ${track.title}, fails the starter and passes the solution`, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Runtime downloads are covered once.')
  test.setTimeout(180_000)
  const first = firstOf(track)
  const core = first.lab.exercises.find((exercise: { id: string }) => exercise.id === 'core')
  await openLesson(page, first)
  await page.getByRole('button', { name: 'Continue to practice' }).click()
  const results = page.locator('.run-results')
  await page.getByRole('button', { name: 'Run tests' }).click()
  await expect(results).toContainText(/0 of \d+ tests passed|\d+ of \d+ tests passed/, { timeout: 150_000 })
  await expect(results).not.toContainText('All ')
  await page.getByRole('textbox', { name: /Your solution/ }).fill(core.solution)
  await page.getByRole('button', { name: 'Run tests' }).click()
  await expect(results).toContainText(`All ${core.tests.length + core.hiddenTests.length} tests passed.`)
  if (first.lab.lang === 'ts') {
    await expect(results.locator('.type-errors')).toHaveCount(0)
    const typo = `${core.solution}\nconst typeCheckProbe: number = 'not a number'\n`
    await page.getByRole('textbox', { name: /Your solution/ }).fill(typo)
    await page.getByRole('button', { name: 'Run tests' }).click()
    await expect(results.locator('.type-errors summary')).toHaveText('1 type error · the code still ran')
    await expect(results).toContainText(`All ${core.tests.length + core.hiddenTests.length} tests passed.`)
    await expect(results.locator('.type-errors')).toContainText("Type 'string' is not assignable to type 'number'.")
    await page.getByRole('textbox', { name: /Your solution/ }).fill(core.solution)
  }
  await page.reload()
  await expect(page.getByRole('textbox', { name: /Your solution/ })).toHaveValue(core.solution)
})

test('a TypeScript type-level exercise shows its type checks and only passes when they do', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Runtime downloads are covered once.')
  test.setTimeout(180_000)
  const lesson = lessons.find(item => item.id === 'ts-narrowing-unions')!
  const core = lesson.lab.exercises.find((exercise: { id: string }) => exercise.id === 'core')
  expect(core.typeChecks).toBeTruthy()
  await openLesson(page, lesson)
  await page.getByRole('navigation', { name: 'Study steps' }).getByRole('button', { name: 'Practice' }).click()
  await expect(page.locator('.type-checks summary')).toHaveText('Type checks your types must pass')
  const results = page.locator('.run-results')
  await page.getByRole('button', { name: 'Run tests' }).click()
  await expect(results.locator('li', { hasText: 'Type checks' })).toHaveClass(/fail/, { timeout: 150_000 })
  await expect(results).not.toContainText('All ')
  await page.getByRole('textbox', { name: /Your solution/ }).fill(core.solution)
  await page.getByRole('button', { name: 'Run tests' }).click()
  await expect(results).toContainText(`All ${core.tests.length + core.hiddenTests.length} tests and the type checks passed.`)
  await expect(results.locator('li', { hasText: 'Type checks' })).toHaveClass(/pass/)
})

for (const track of languageTracks) test(`the ${track.title} placement check marks known lessons, saves them and earns its badge`, async ({ page }) => {
  await page.goto(`./#tracks/${track.id}`)
  await page.getByRole('button', { name: 'Take placement check' }).click()
  const questions = track.placement
  for (const [index, question] of questions.entries()) {
    const choice = question.choices[question.answer].replace(/`/g, '')
    await page.locator('.placement .fg-questions > li').nth(index).getByRole('radio', { name: choice, exact: true }).check()
  }
  await page.getByRole('button', { name: 'Check answers' }).click()
  const known = new Set(questions.flatMap((question: { lessons: string[] }) => question.lessons))
  await expect(page.getByRole('status').filter({ hasText: '100%' })).toContainText(`${known.size} lesson`)
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('button', { name: 'Retake placement check' })).toBeVisible()
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), PROGRESS_KEY)
  expect(new Set(saved.placements[track.id].known)).toEqual(known)
  await page.getByRole('link', { name: 'Progress', exact: true }).first().click()
  await expect(page.locator('.badge.earned', { hasText: `${track.title} placed` })).toBeVisible()
})

test('lesson diagrams stay readable in every palette, light and dark', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openLesson(page)
  const picker = page.getByRole('combobox', { name: 'In this lesson' })
  await picker.selectOption({ index: 1 })
  await expect(page.locator('.dg-svg').first()).toBeVisible()
  for (const palette of palettes) {
    for (const theme of ['light', 'dark'] as const) {
      const sample = await page.evaluate(({ palette, theme }) => {
        const root = document.documentElement
        root.dataset.palette = palette
        root.dataset.theme = theme
        const surface = getComputedStyle(document.querySelector('.dg-scroll')!).backgroundColor
        const texts = [...document.querySelectorAll('.dg-svg text')].map(node => {
          const holder = node.closest('.dg-node')?.querySelector('.dg-box') ?? node.closest('.dg-badge')?.querySelector('circle')
          return { name: `${node.getAttribute('class')} "${node.textContent}"`, fill: getComputedStyle(node).fill, behind: holder ? getComputedStyle(holder).fill : surface }
        })
        const lines = [...document.querySelectorAll('.dg-edge:not(.is-dim) .dg-line, .dg-head:not(.is-dim *)')].map(node => ({ name: node.getAttribute('class')!, paint: node.classList.contains('dg-head') ? getComputedStyle(node).fill : getComputedStyle(node).stroke }))
        return { surface, texts, lines }
      }, { palette: palette.id, theme })
      const label = `${palette.id}/${theme}`
      const surface = color(sample.surface)
      expect(sample.texts.length).toBeGreaterThan(3)
      for (const text of sample.texts) {
        const behind = over(color(text.behind === 'none' ? sample.surface : text.behind), surface)
        expect(contrast(over(color(text.fill), behind), behind), `${label} ${text.name}`).toBeGreaterThanOrEqual(4.5)
      }
      for (const line of sample.lines) expect(contrast(over(color(line.paint), surface), surface), `${label} ${line.name}`).toBeGreaterThanOrEqual(3)
    }
  }
})

for (const width of [360, 768, 1440]) for (const python of languageTracks) {
  test(`${python.title} lessons fit without sideways scrolling at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(`./#tracks/${python.id}`)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.getByRole('button', { name: 'Take placement check' }).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await openLesson(page, firstOf(python))
    const picker = page.getByRole('combobox', { name: 'In this lesson' })
    const count = await picker.locator('option').count()
    for (let index = 0; index < count; index++) {
      await picker.selectOption({ index })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `section ${index} at ${width}`).toBe(true)
    }
    await page.getByRole('button', { name: 'Continue to practice' }).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `practice at ${width}`).toBe(true)
  })
}

for (const track of languageTracks) test(`every ${track.title} lesson draws each of its diagrams exactly once at 360px`, async ({ page }) => {
  test.setTimeout(480_000)
  await page.setViewportSize({ width: 360, height: 800 })
  for (const lesson of lessons.filter(item => item.track === track.id)) {
    await openLesson(page, lesson)
    const seen = await diagramsShown(page)
    expect(seen.sort(), lesson.id).toEqual(lesson.lab.diagrams.map((diagram: { id: string }) => diagram.id).sort())
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), lesson.id).toBe(true)
    await page.evaluate(() => localStorage.clear())
    await page.reload()
  }
})
