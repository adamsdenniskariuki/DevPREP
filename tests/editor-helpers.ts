import { expect, type Locator, type Page } from '@playwright/test'

const PROGRESS_KEY = 'devprep.progress.v1'

/** The text in either editor: the textarea value (Plain) or the CodeMirror document lines (Rich). */
export function codeOf(editor: Locator) {
  return editor.evaluate(element => element instanceof HTMLTextAreaElement
    ? element.value
    : Array.from(element.querySelectorAll('.cm-line'), line => line.textContent ?? '').join('\n'))
}

export async function expectCode(editor: Locator, expected: string | RegExp) {
  if (typeof expected === 'string') await expect.poll(() => codeOf(editor)).toBe(expected)
  else await expect.poll(() => codeOf(editor)).toMatch(expected)
}

/** Seeds an empty progress record with the chosen editor before the app loads. */
export async function useEditor(page: Page, kind: 'rich' | 'plain', interview = false) {
  await page.addInitScript(({ key, kind, interview }) => {
    if (localStorage.getItem(key)) return
    const editor: Record<string, unknown> = {}
    if (kind !== 'rich') editor.kind = kind
    if (interview) editor.interview = true
    localStorage.setItem(key, JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), records: {}, session: null, activity: [], ...(Object.keys(editor).length ? { editor } : {}) }))
  }, { key: PROGRESS_KEY, kind, interview })
}
