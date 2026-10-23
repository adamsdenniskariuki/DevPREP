import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

const PROGRESS_KEY = 'devprep.progress.v1'
const item = JSON.parse(readFileSync(new URL('../content/cases/url-shortener.json', import.meta.url), 'utf8'))
const problem = JSON.parse(readFileSync(new URL('../content/problems/count-pair-sums.json', import.meta.url), 'utf8'))

interface StoredBoard {
  id: string; title: string; kind: string; caseId?: string; problemId?: string
  elements: { type: string; isDeleted?: boolean }[]
  practice?: { minutes: number; spentMs: number; runningSince?: number; finishedAt?: string; checks: boolean[] }
}

function stored(page: Page): Promise<StoredBoard[]> {
  return page.evaluate(() => new Promise<StoredBoard[]>((resolve, reject) => {
    const open = indexedDB.open('devprep-boards')
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const db = open.result
      const request = db.transaction('boards').objectStore('boards').getAll()
      request.onsuccess = () => { db.close(); resolve(request.result) }
      request.onerror = () => { db.close(); reject(request.error) }
    }
  }))
}

const live = (board: StoredBoard | undefined) => board?.elements.filter(element => !element.isDeleted) ?? []
const fits = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
const canvas = (page: Page) => page.getByTestId('excalidraw-canvas').locator('canvas.interactive')
const timer = (page: Page) => page.getByRole('timer')
const axe = (page: Page) => new AxeBuilder({ page }).exclude('[data-testid="excalidraw-canvas"]').analyze()

async function drawRectangle(page: Page) {
  await page.getByTestId('excalidraw-canvas').evaluate(element => element.scrollIntoView({ block: 'center' }))
  const box = (await canvas(page).boundingBox())!
  const x = box.x + box.width * 0.3
  const y = box.y + box.height * 0.45
  await page.mouse.click(x - 40, y - 40)
  await page.keyboard.press('r')
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 60, y + 40, { steps: 4 })
  await page.mouse.move(x + 140, y + 90, { steps: 4 })
  await page.mouse.up()
}

async function startPractice(page: Page, minutes: 35 | 45 = 35) {
  await page.goto(`./#design/${item.id}`)
  await expect(page.getByRole('heading', { level: 2, name: 'Whiteboard practice' })).toBeVisible()
  await page.getByRole('button', { name: `Start ${minutes} min` }).click()
  await expect(page).toHaveURL(/#board\/[a-z0-9-]+$/)
  await expect(page.getByRole('heading', { level: 1, name: `${item.title} practice` })).toBeVisible()
  await expect(canvas(page)).toBeVisible()
  return page.url().split('#board/')[1]
}

test('timed practice: draw, warn, survive a reload, finish, compare, tick and list the attempt', async ({ page }) => {
  await page.clock.install()
  const id = await startPractice(page)
  await expect(page.getByRole('link', { name: item.title })).toHaveAttribute('href', `#design/${item.id}`)
  await expect(timer(page)).toHaveText(/^3[45]:\d\d$/)
  await expect(timer(page)).toHaveAccessibleName('Time remaining')
  await drawRectangle(page)
  await expect.poll(async () => live((await stored(page)).find(board => board.id === id)).map(element => element.type)).toEqual(['rectangle'])

  await page.clock.fastForward('30:05')
  await expect(page.getByRole('status').filter({ hasText: 'Five minutes left.' })).toBeAttached()
  await expect(timer(page)).toHaveText(/^4:[0-5]\d$/)
  await expect(timer(page)).toHaveClass(/warn/)

  await page.reload()
  await expect(canvas(page)).toBeVisible()
  await expect(timer(page)).toHaveText(/^4:[0-5]\d$/)
  expect(live((await stored(page)).find(board => board.id === id))).toHaveLength(1)

  await page.getByRole('button', { name: 'Pause' }).click()
  await expect.poll(async () => (await stored(page)).find(board => board.id === id)?.practice?.runningSince).toBeUndefined()
  const paused = await timer(page).textContent()
  await page.clock.fastForward('10:00')
  await expect(timer(page)).toHaveText(paused!)
  await page.getByRole('button', { name: 'Resume' }).click()
  await page.clock.fastForward('05:30')
  await expect(page.getByRole('status').filter({ hasText: 'Time’s up.' })).toBeAttached()
  await expect(timer(page)).toHaveText(/^\+\d:\d\d$/)
  await expect(timer(page)).toHaveAccessibleName('Time over')

  await page.getByRole('button', { name: 'Finish & review' }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'Review your design' })).toBeFocused()
  await expect(page.getByText(/Time taken: 3\d min( \d+ s)? of 35 min \(over time\)/)).toBeVisible()
  await expect(page.getByText('Practice saved · +20 XP')).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Your board' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Reference design' })).toBeVisible()
  await expect(page.getByRole('figure', { name: `Reference design for ${item.title}` })).toBeVisible()
  await expect(page.getByRole('timer')).toHaveCount(0)
  const checklist = page.getByRole('group', { name: 'Self-review' })
  await expect(checklist.getByRole('checkbox')).toHaveCount(7)
  await checklist.getByRole('checkbox', { name: 'Requirements' }).check()
  await checklist.getByRole('checkbox', { name: 'API' }).check()
  await expect(checklist.getByText('2 of 7 ticked')).toBeVisible()
  await expect.poll(async () => (await stored(page)).find(board => board.id === id)?.practice?.checks).toEqual([true, false, true, false, false, false, false])
  const saved = (await stored(page)).find(board => board.id === id)!
  expect(saved).toMatchObject({ kind: 'practice', caseId: item.id, practice: { minutes: 35 } })
  expect(saved.practice!.finishedAt).toBeTruthy()
  expect(saved.practice!.spentMs).toBeGreaterThan(35 * 60_000)

  await page.reload()
  await expect(page.getByRole('heading', { level: 2, name: 'Review your design' })).toBeVisible()
  await expect(canvas(page)).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Requirements' })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: 'Estimates' })).not.toBeChecked()
  expect(live((await stored(page)).find(board => board.id === id))).toHaveLength(1)

  const progress = await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{}'), PROGRESS_KEY)
  expect(Object.keys(progress.whiteboard.practised)).toEqual([item.id])

  await page.getByRole('link', { name: item.title }).click()
  await expect(page.getByRole('heading', { level: 3, name: 'Past attempts' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Attempt 1' })).toHaveAttribute('href', `#board/${id}`)
  await expect(page.getByText(/of 35 min · 2 of 7 ticked/)).toBeVisible()

  await page.goto('./#board')
  await expect(page.getByText('No boards yet')).toBeVisible()
  await page.getByRole('radio', { name: /Practice/ }).check()
  await expect(page.getByRole('list', { name: 'Practice boards' }).getByRole('link', { name: `${item.title} practice` })).toBeVisible()

  await page.goto('./#progress')
  await expect(page.locator('.badge.earned').filter({ hasText: 'Against the clock' })).toBeVisible()
  await expect(page.locator('.badge.earned').filter({ hasText: 'Whiteboard regular' })).toHaveCount(0)
})

test('a second attempt of the same case earns no extra practice XP, and the old case tools still work', async ({ page }) => {
  await startPractice(page, 45)
  await expect(timer(page)).toHaveText(/^4[45]:\d\d$/)
  await page.getByRole('button', { name: 'Finish & review' }).click()
  await expect(page.getByText('Practice saved · +20 XP')).toBeVisible()
  await startPractice(page, 35)
  await page.getByRole('button', { name: 'Finish & review' }).click()
  await expect(page.getByText('Practice saved.', { exact: true })).toBeVisible()
  await page.goto(`./#design/${item.id}`)
  await expect(page.getByRole('link', { name: /^Attempt \d$/ })).toHaveCount(2)
  await expect(page.getByRole('link', { name: 'Attempt 2' })).toBeVisible()
  // The case page's own timer and answer tools are unchanged.
  await expect(page.getByRole('timer')).toHaveText(`${item.minutes}:00`)
  await page.getByRole('button', { name: 'Start timer' }).click()
  await expect(page.getByRole('timer')).not.toHaveText(`${item.minutes}:00`, { timeout: 3000 })
})

test('the scratchpad loads only when opened, saves per problem and restores after a reload', async ({ page }) => {
  const canvasChunks: string[] = []
  page.on('request', request => { if (/BoardCanvas|Scratchpad/.test(request.url())) canvasChunks.push(request.url()) })
  await page.goto(`./#code/${problem.id}`)
  await expect(page.getByRole('heading', { level: 1, name: problem.title })).toBeVisible()
  const panel = page.locator('details.scratchpad')
  await expect(panel).not.toHaveAttribute('open')
  await page.waitForTimeout(300)
  expect(canvasChunks).toEqual([])

  await panel.locator('summary').click()
  await expect(canvas(page)).toBeVisible()
  expect(canvasChunks.some(url => url.includes('BoardCanvas'))).toBe(true)
  await expect(page.getByRole('region', { name: 'Scratchpad drawing area' })).toBeVisible()
  expect((await stored(page)).filter(board => board.kind === 'scratch')).toEqual([])
  await drawRectangle(page)
  await expect.poll(async () => live((await stored(page)).find(board => board.kind === 'scratch')).length).toBe(1)
  const pad = (await stored(page)).find(board => board.kind === 'scratch')!
  expect(pad).toMatchObject({ problemId: problem.id, title: `${problem.title} scratchpad` })
  await expect(panel.getByRole('link', { name: 'Open full size' })).toHaveAttribute('href', `#board/${pad.id}`)
  expect(await fits(page)).toBe(true)
  // The code editor's own scroller is outside this change, so the scan covers the scratchpad panel.
  expect((await new AxeBuilder({ page }).include('details.scratchpad').exclude('[data-testid="excalidraw-canvas"]').analyze()).violations).toEqual([])

  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: problem.title })).toBeVisible()
  await expect(panel).not.toHaveAttribute('open')
  await panel.locator('summary').click()
  await expect(canvas(page)).toBeVisible()
  await expect(panel.getByRole('link', { name: 'Open full size' })).toBeVisible()
  expect((await stored(page)).filter(board => board.kind === 'scratch')).toHaveLength(1)
  expect(live((await stored(page)).find(board => board.kind === 'scratch'))).toHaveLength(1)

  await page.goto('./#board')
  await expect(page.getByText('No boards yet')).toBeVisible()
  await page.getByRole('radio', { name: /Scratchpads/ }).check()
  await page.getByRole('list', { name: 'Scratchpads' }).getByRole('link', { name: `${problem.title} scratchpad` }).click()
  await expect(page.getByRole('heading', { level: 1, name: `${problem.title} scratchpad` })).toBeVisible()
  await expect(canvas(page)).toBeVisible()
})

test('the practice starter, running practice and review pass axe', async ({ page }) => {
  await page.goto(`./#design/${item.id}`)
  await expect(page.getByRole('heading', { level: 2, name: 'Whiteboard practice' })).toBeVisible()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await startPractice(page)
  expect((await axe(page)).violations).toEqual([])
  await page.getByRole('button', { name: 'Finish & review' }).click()
  await expect(page.getByRole('figure', { name: `Reference design for ${item.title}` })).toBeVisible()
  expect((await axe(page)).violations).toEqual([])
  await page.goto(`./#design/${item.id}`)
  await expect(page.getByRole('link', { name: 'Attempt 1' })).toBeVisible()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.goto('./#board')
  await page.getByRole('radio', { name: /Practice/ }).check()
  await expect(page.getByRole('list', { name: 'Practice boards' })).toBeVisible()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
})

for (const width of [360, 768, 1440]) {
  test(`practice review and scratchpad fit a ${width}px screen`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await startPractice(page)
    expect(await fits(page)).toBe(true)
    await expect(page.getByRole('button', { name: 'Finish & review' })).toBeInViewport()
    await page.getByRole('button', { name: 'Finish & review' }).click()
    const reference = page.getByRole('figure', { name: `Reference design for ${item.title}` })
    await expect(reference).toBeVisible()
    expect(await fits(page)).toBe(true)
    const board = (await page.getByTestId('excalidraw-canvas').boundingBox())!
    const ref = (await page.locator('.practice-reference').boundingBox())!
    if (width >= 1100) {
      expect(ref.x).toBeGreaterThan(board.x + board.width - 1)
      expect(Math.abs(ref.y - board.y)).toBeLessThan(120)
    } else {
      expect(ref.y).toBeGreaterThan(board.y + board.height - 1)
    }
    expect(board.height).toBeGreaterThanOrEqual(360)

    await page.goto(`./#code/${problem.id}`)
    await page.locator('details.scratchpad summary').click()
    await expect(canvas(page)).toBeVisible()
    expect(await fits(page)).toBe(true)
  })
}
