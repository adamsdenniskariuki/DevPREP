import type { CodeLanguage } from './problem-types'

/** Code drafts live apart from progress backups: they can be large and are easy to recreate. */
export const CODE_DRAFTS_KEY = 'devprep.code.v1'
export const MAX_CODE_LENGTH = 20_000
const MAX_PROBLEMS = 200

export interface CodeDraft {
  lang?: CodeLanguage
  js?: string
  py?: string
  /** SQL interview problems, stored under `sql:<id>`. */
  sql?: string
}
type Drafts = Record<string, CodeDraft>

function readAll(): Drafts {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(CODE_DRAFTS_KEY) ?? '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Drafts : {}
  } catch {
    return {}
  }
}

export function readDraft(problemId: string): CodeDraft {
  const draft = readAll()[problemId]
  if (!draft || typeof draft !== 'object') return {}
  const clean: CodeDraft = {}
  if (draft.lang === 'js' || draft.lang === 'py') clean.lang = draft.lang
  for (const lang of ['js', 'py', 'sql'] as const) if (typeof draft[lang] === 'string') clean[lang] = draft[lang]!.slice(0, MAX_CODE_LENGTH)
  return clean
}

/** Saves a draft; returns false when the browser refused (private mode, quota). */
export function writeDraft(problemId: string, patch: CodeDraft): boolean {
  try {
    const all = readAll()
    const next = { ...all[problemId], ...patch }
    delete all[problemId]
    const ids = Object.keys(all)
    for (const id of ids.slice(0, Math.max(0, ids.length - MAX_PROBLEMS + 1))) delete all[id]
    all[problemId] = next
    window.localStorage.setItem(CODE_DRAFTS_KEY, JSON.stringify(all))
    return true
  } catch {
    return false
  }
}

export function clearDraft(problemId: string, lang: CodeLanguage | 'sql'): boolean {
  try {
    const all = readAll()
    if (all[problemId]) delete all[problemId][lang]
    window.localStorage.setItem(CODE_DRAFTS_KEY, JSON.stringify(all))
    return true
  } catch {
    return false
  }
}
