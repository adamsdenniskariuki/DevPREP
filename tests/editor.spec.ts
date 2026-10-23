import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { palettes } from '../src/appearance'
import { codeOf, expectCode, useEditor } from './editor-helpers'
import { color, contrast, over } from './contrast'

const PROGRESS_KEY = 'devprep.progress.v1'
const problem = JSON.parse(readFileSync(new URL('../content/problems/count-pair-sums.json', import.meta.url), 'utf8'))

async function openProblem(page: Page) {
  await page.goto(`./#code/${problem.id}`)
  await expect(page.getByRole('heading', { level: 1, name: problem.title })).toBeVisible()
  const editor = page.getByRole('textbox', { name: 'JavaScript code' })
  await expectCode(editor, problem.starter.js)
  return editor
}

test('the rich editor is labelled, highlights code and passes tests', async ({ page }) => {
  const editor = await openProblem(page)
  await expect(page.locator('.rich-editor .cm-content')).toHaveAttribute('data-editor', 'rich')
  await expect(editor).toHaveAttribute('aria-labelledby', /.+/)
  await expect(editor).toHaveAttribute('aria-multiline', 'true')
  await expect(page.locator('.rich-editor .cm-lineNumbers')).toBeVisible()
  await expect(page.locator('.rich-editor .tok-keyword').first()).toBeVisible()
  await page.getByText('JavaScript code', { exact: true }).dispatchEvent('click')
  await expect(editor).toBeFocused()
  await editor.fill(problem.solution.js)
  await page.getByRole('button', { name: 'Run tests' }).click()
  await expect(page.locator('.run-results')).toContainText(/All \d+ tests passed/)
})

test('interview mode turns off auto-closing brackets and is saved', async ({ page }) => {
  const editor = await openProblem(page)
  await editor.fill('')
  await editor.focus()
  await page.keyboard.type('f(')
  await expectCode(editor, 'f()')

  await page.getByRole('checkbox', { name: /Interview mode/ }).check()
  await editor.fill('')
  await editor.focus()
  await page.keyboard.type('f([')
  await expectCode(editor, 'f([')
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), PROGRESS_KEY)
  expect(saved.editor).toEqual({ interview: true })

  await page.goto('./#settings')
  await expect(page.getByRole('checkbox', { name: /Interview mode/ })).toBeChecked()
  await page.getByRole('checkbox', { name: /Interview mode/ }).uncheck()
  expect((await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), PROGRESS_KEY)).editor).toBeUndefined()
})

test('choosing Plain in Settings swaps to the textarea, keeps drafts and is exported', async ({ page }) => {
  const rich = await openProblem(page)
  await rich.fill('function countPairs() { return 3 }')
  await page.goto('./#settings')
  await expect(page.getByRole('radio', { name: 'Rich (CodeMirror)' })).toBeChecked()
  await page.getByRole('radio', { name: 'Plain' }).check()
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export backup' }).click()
  const backup = JSON.parse(readFileSync((await (await downloading).path())!, 'utf8'))
  expect(backup.editor).toEqual({ kind: 'plain' })

  await page.goto(`./#code/${problem.id}`)
  const plain = page.getByRole('textbox', { name: 'JavaScript code' })
  await expect(plain).toHaveJSProperty('tagName', 'TEXTAREA')
  await expect(plain).toHaveValue('function countPairs() { return 3 }')
  await expect(page.locator('.rich-editor')).toHaveCount(0)
  await expect(page.getByRole('checkbox', { name: /Interview mode/ })).toHaveCount(0)
})

test.describe('plain editor', () => {
  test.beforeEach(({ page }) => useEditor(page, 'plain'))

  test('indents with Tab, leaves with Escape then Tab and runs tests', async ({ page }) => {
    const editor = await openProblem(page)
    await expect(editor).toHaveJSProperty('tagName', 'TEXTAREA')
    await editor.fill('')
    await editor.focus()
    await page.keyboard.type('if (x) {')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Tab')
    await expect(editor).toHaveValue('if (x) {\n    ')
    await page.keyboard.press('Escape')
    await page.keyboard.press('Tab')
    await expect(editor).not.toBeFocused()
    await editor.fill(problem.solution.js)
    await page.getByRole('button', { name: 'Run tests' }).click()
    await expect(page.locator('.run-results')).toContainText(/All \d+ tests passed/)
  })

  test('restores a draft after reload', async ({ page }) => {
    const editor = await openProblem(page)
    await editor.fill('function countPairs() { return 9 }')
    await page.reload()
    await expect(page.getByRole('textbox', { name: 'JavaScript code' })).toHaveValue('function countPairs() { return 9 }')
  })
})

test('the plain editor takes over if CodeMirror cannot load', async ({ page }) => {
  await page.route(/RichEditor[^/]*\.(js|tsx)(\?.*)?$/, route => route.abort())
  await page.goto(`./#code/${problem.id}`)
  await expect(page.getByRole('note')).toHaveText('The rich editor couldn’t load, so this is the plain editor.')
  const editor = page.getByRole('textbox', { name: 'JavaScript code' })
  await expect(editor).toHaveJSProperty('tagName', 'TEXTAREA')
  await expect(editor).toBeEditable()
  await editor.fill(problem.solution.js)
  await page.getByRole('button', { name: 'Run tests' }).click()
  await expect(page.locator('.run-results')).toContainText(/All \d+ tests passed/)
})

test('a rich draft is the same draft in the plain editor', async ({ page }) => {
  const rich = await openProblem(page)
  await rich.fill('function countPairs() {\n  return 5\n}')
  const text = await codeOf(rich)
  await page.evaluate(key => {
    const saved = JSON.parse(localStorage.getItem(key) ?? JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), records: {}, session: null, activity: [] }))
    localStorage.setItem(key, JSON.stringify({ ...saved, editor: { kind: 'plain' } }))
  }, PROGRESS_KEY)
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'JavaScript code' })).toHaveValue(text)
})

test('syntax colours stay readable in every palette, light and dark', async ({ page }) => {
  await openProblem(page)
  await page.getByRole('textbox', { name: 'JavaScript code' }).fill('// note\nfunction f(a) {\n  const s = "x"\n  return a + 1 + s\n}')
  await expect(page.locator('.rich-editor .tok-comment')).toHaveCount(1)
  for (const palette of palettes) {
    for (const theme of ['light', 'dark'] as const) {
      const sample = await page.evaluate(({ palette, theme }) => {
        const root = document.documentElement
        root.dataset.palette = palette
        root.dataset.theme = theme
        // Stand in for the step-through visualiser's executing-line highlight on one line.
        document.querySelectorAll('.rich-editor .cm-line')[1]?.classList.add('cm-exec-line')
        const layers = (node: Element | null) => {
          const found: string[] = []
          for (; node; node = node.parentElement) found.push(getComputedStyle(node).backgroundColor)
          return found.reverse()
        }
        const gutter = document.querySelector('.rich-editor .cm-lineNumbers .cm-gutterElement:not([style*="hidden"])')
        return [...document.querySelectorAll('.rich-editor [class*="tok-"], .rich-editor .cm-line'), ...(gutter ? [gutter] : [])].map(node => ({
          name: `${node.className} "${node.textContent}"`, fill: getComputedStyle(node).color, layers: layers(node),
        }))
      }, { palette: palette.id, theme })
      expect(sample.length).toBeGreaterThan(8)
      for (const item of sample) {
        const behind = item.layers.reduce((base, layer) => over(color(layer), base), [255, 255, 255, 1] as [number, number, number, number])
        expect.soft(contrast(over(color(item.fill), behind), behind), `${palette.id}/${theme} ${item.name}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  }
})
