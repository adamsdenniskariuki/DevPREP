import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { navTo } from './nav'

const DRAFTS_KEY = 'devprep.design.v1'
const PROGRESS_KEY = 'devprep.progress.v1'

interface StoredBoard { id: string; title: string; kind: string; elements: { type: string; isDeleted?: boolean }[] }

/** Reads the boards straight from IndexedDB. Call only after the app has opened the database. */
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

async function newBoard(page: Page) {
  await page.goto('./#board')
  await expect(page.getByRole('heading', { level: 1, name: 'Whiteboards' })).toBeVisible()
  await page.getByRole('button', { name: 'New board' }).click()
  await expect(page).toHaveURL(/#board\/[a-z0-9-]+$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Untitled board' })).toBeVisible()
  await expect(canvas(page)).toBeVisible()
  return page.url().split('#board/')[1]
}

const canvas = (page: Page) => page.getByTestId('excalidraw-canvas').locator('canvas.interactive')

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

const fits = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)

test('create, draw, autosave, reload, and export a board', async ({ page }) => {
  const id = await newBoard(page)
  await expect(page.getByText('Board created · +10 XP')).toBeVisible()
  await expect(page.locator('.board-save')).toHaveAttribute('data-save', 'saved')
  await drawRectangle(page)
  await expect.poll(async () => live((await stored(page)).find(board => board.id === id)).map(element => element.type)).toEqual(['rectangle'])
  await expect(page.locator('.board-save')).toHaveAttribute('data-save', 'saved')

  await page.reload()
  await expect(canvas(page)).toBeVisible()
  expect(live((await stored(page)).find(board => board.id === id))).toHaveLength(1)
  // After the reload the canvas holds the rectangle again, so a JSON export carries it.
  const json = page.waitForEvent('download')
  await page.getByRole('button', { name: /Export \.excalidraw/ }).click()
  const file = await json
  expect(file.suggestedFilename()).toBe('untitled-board.excalidraw')
  const exported = JSON.parse(readFileSync(await file.path(), 'utf8'))
  expect(exported).toMatchObject({ type: 'excalidraw', version: 2 })
  expect(exported.elements.filter((element: { isDeleted?: boolean }) => !element.isDeleted).map((element: { type: string }) => element.type)).toEqual(['rectangle'])

  const png = page.waitForEvent('download')
  await page.getByRole('button', { name: /Export PNG/ }).click()
  const image = await png
  expect(image.suggestedFilename()).toBe('untitled-board.png')
  expect(readFileSync(await image.path()).subarray(1, 4).toString()).toBe('PNG')

  const progress = await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{}'), PROGRESS_KEY)
  expect(progress.whiteboard.firstBoard).toBeTruthy()
  await navTo(page, 'Progress')
  await expect(page.locator('.badge.earned', { hasText: 'First sketch' })).toBeVisible()
})

test('import, rename, and delete boards with confirmation', async ({ page }) => {
  await page.goto('./#board')
  await expect(page.getByText('No boards yet')).toBeVisible()
  const scene = {
    type: 'excalidraw', version: 2, source: 'https://excalidraw.com',
    elements: [{ id: 'imported-box', type: 'rectangle', x: 10, y: 20, width: 100, height: 60, angle: 0, strokeColor: '#1e1e1e', backgroundColor: 'transparent', fillStyle: 'solid', strokeWidth: 2, strokeStyle: 'solid', roughness: 1, opacity: 100, groupIds: [], frameId: null, roundness: null, seed: 1, version: 1, versionNonce: 1, isDeleted: false, boundElements: null, updated: 1, link: null, locked: false }],
    appState: { viewBackgroundColor: '#ffffff' }, files: {},
  }
  await page.getByLabel('Import an Excalidraw file').setInputFiles({ name: 'Queue sketch.excalidraw', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(scene)) })
  await expect(page.getByText('Imported “Queue sketch”.')).toBeVisible()
  const list = page.getByRole('list', { name: 'Your boards' })
  await expect(list.getByRole('link', { name: 'Queue sketch' })).toBeVisible()
  await expect(list.getByText('1 shape ·')).toBeVisible()

  await page.getByLabel('Import an Excalidraw file').setInputFiles({ name: 'bad.excalidraw', mimeType: 'application/json', buffer: Buffer.from('{"type":"not-excalidraw"}') })
  await expect(page.getByRole('alert')).toContainText('Nothing was imported.')
  await expect(list.getByRole('listitem')).toHaveCount(1)

  await page.getByRole('button', { name: 'Rename Queue sketch' }).click()
  const rename = page.getByRole('dialog', { name: 'Rename board' })
  await rename.getByLabel('Board name').fill('Event pipeline')
  await rename.getByRole('button', { name: 'Save name' }).click()
  await expect(rename).toBeHidden()
  await expect(list.getByRole('link', { name: 'Event pipeline' })).toBeVisible()

  await page.getByRole('button', { name: 'Delete Event pipeline' }).click()
  const remove = page.getByRole('dialog', { name: 'Delete “Event pipeline”?' })
  await expect(remove).toContainText('can’t be undone')
  await remove.getByRole('button', { name: 'Cancel' }).click()
  await expect(list.getByRole('link', { name: 'Event pipeline' })).toBeVisible()
  await page.getByRole('button', { name: 'Delete Event pipeline' }).click()
  await remove.getByRole('button', { name: 'Delete board' }).click()
  await expect(page.getByText('No boards yet')).toBeVisible()
  expect(await stored(page)).toEqual([])
})

test('the old free whiteboard migrates once and the original draft is kept', async ({ page }) => {
  const legacy = { free: { board: {
    nodes: [
      { id: 'n1', kind: 'client', label: 'Phone', x: 40, y: 40 },
      { id: 'n2', kind: 'service', label: 'API', x: 300, y: 40 },
    ],
    edges: [{ from: 'n1', to: 'n2', label: 'HTTPS' }],
  } } }
  await page.addInitScript(({ key, value }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, value) }, { key: DRAFTS_KEY, value: JSON.stringify(legacy) })
  await page.goto('./#board')
  await expect(page.getByText('Your old whiteboard is now “My first board”. The original is kept too.')).toBeVisible()
  const list = page.getByRole('list', { name: 'Your boards' })
  await expect(list.getByRole('listitem')).toHaveCount(1)
  const [board] = await stored(page)
  const types = live(board).map(element => element.type)
  expect(types.filter(type => type === 'rectangle')).toHaveLength(2)
  expect(types).toContain('arrow')
  expect(types.filter(type => type === 'text').length).toBeGreaterThanOrEqual(3)
  expect(JSON.parse(await page.evaluate(key => localStorage.getItem(key) ?? '{}', DRAFTS_KEY))).toEqual(legacy)

  await page.reload()
  await expect(list.getByRole('listitem')).toHaveCount(1)
  await expect(page.getByText('Your old whiteboard is now')).toHaveCount(0)
  await list.getByRole('link', { name: 'My first board' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'My first board' })).toBeVisible()
  await expect(canvas(page)).toBeVisible()
  // Migration is not a new board, so it awards no XP.
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{}').whiteboard, PROGRESS_KEY)).toBeUndefined()
})

test('a board falls back to the simple whiteboard when the drawing chunk cannot load', async ({ page }) => {
  await page.route(/BoardCanvas-[^/]*\.js/, route => route.abort())
  await page.goto('./#board')
  await page.getByRole('button', { name: 'New board' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Untitled board' })).toBeVisible()
  await expect(page.getByText('The drawing tool couldn’t load, so this is the simple whiteboard.')).toBeVisible()
  await expect(page.getByText('Simple whiteboard')).toBeVisible()
  await expect(page.getByRole('button', { name: /Export PNG/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.locator('.board-save')).toHaveAttribute('data-save', 'saved')
  const [board] = await stored(page) as (StoredBoard & { fallback?: { nodes: unknown[] } })[]
  expect(board.fallback?.nodes).toHaveLength(1)
})

test('unknown and malformed board ids use the not-found page', async ({ page }) => {
  await page.goto('./#board/no-such-board')
  await expect(page.getByRole('heading', { level: 1, name: 'This page isn’t on the roadmap.' })).toBeVisible()
  await page.goto('./#board/Not%20Valid!')
  await expect(page.getByRole('heading', { level: 1, name: 'This page isn’t on the roadmap.' })).toBeVisible()
})

test('the board list and board page chrome pass axe', async ({ page }) => {
  await page.goto('./#board')
  await expect(page.getByText('No boards yet')).toBeVisible()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await expect(page.locator('.game-chip')).toHaveAccessibleName(/^\d+ day streak, \d+ XP$/)
  await newBoard(page)
  await expect(page.locator('.board-save')).toHaveAttribute('data-save', 'saved')
  expect((await new AxeBuilder({ page }).exclude('[data-testid="excalidraw-canvas"]').analyze()).violations).toEqual([])
  await page.goto('./#board')
  await expect(page.getByRole('list', { name: 'Your boards' })).toBeVisible()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
})

for (const width of [360, 768, 1440]) {
  test(`whiteboards fit a ${width}px screen`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await newBoard(page)
    expect(await fits(page)).toBe(true)
    const region = (await page.getByTestId('excalidraw-canvas').boundingBox())!
    const main = (await page.locator('main').boundingBox())!
    expect(region.width).toBeGreaterThan(main.width * 0.85)
    expect(region.height).toBeGreaterThanOrEqual(360)
    for (const name of [/Export PNG/, /Export \.excalidraw/]) await expect(page.getByRole('button', { name })).toBeInViewport()
    await page.getByRole('link', { name: 'Whiteboards' }).click()
    await expect(page.getByRole('list', { name: 'Your boards' })).toBeVisible()
    expect(await fits(page)).toBe(true)
  })
}
