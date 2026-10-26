import type { Company } from './company-types'

// STAR notes and the in-progress timed run stay on this device only. They are drafts, so they
// are not part of progress backups; finished runs are saved to progress (and backed up) instead.
export const COMPANY_KEY = 'devprep.company.v1'
export const MAX_NOTE = 4000

export interface ActiveRun { companyId: string; problems: string[]; minutes: number; startedAt: number; done: string[] }
export interface CompanyLocal { notes: Record<string, Record<string, string>>; run?: ActiveRun }

const isRec = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isIds = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string')

/** Reads local company state, dropping anything malformed rather than failing the page. */
export function readLocal(storage: Pick<Storage, 'getItem'> = window.localStorage): CompanyLocal {
  let raw: unknown
  try { raw = JSON.parse(storage.getItem(COMPANY_KEY) ?? '{}') } catch { raw = {} }
  const notes: CompanyLocal['notes'] = {}
  if (isRec(raw) && isRec(raw.notes)) for (const [company, prompts] of Object.entries(raw.notes)) {
    if (!isRec(prompts)) continue
    const kept = Object.entries(prompts).filter(([, text]) => typeof text === 'string' && text.length <= MAX_NOTE)
    if (kept.length) notes[company] = Object.fromEntries(kept) as Record<string, string>
  }
  const run = isRec(raw) ? raw.run : undefined
  const valid = isRec(run) && typeof run.companyId === 'string' && isIds(run.problems) && isIds(run.done) &&
    Number.isInteger(run.minutes) && Number.isFinite(run.startedAt)
  return valid ? { notes, run: run as unknown as ActiveRun } : { notes }
}

/** Saves local state. Returns false when storage is full or blocked, so the page can say so. */
export function writeLocal(state: CompanyLocal, storage: Pick<Storage, 'setItem'> = window.localStorage): boolean {
  try { storage.setItem(COMPANY_KEY, JSON.stringify(state)); return true } catch { return false }
}

export function setNote(state: CompanyLocal, companyId: string, promptId: string, text: string): CompanyLocal {
  const prompts = { ...state.notes[companyId] }
  if (text.trim()) prompts[promptId] = text.slice(0, MAX_NOTE)
  else delete prompts[promptId]
  const notes = { ...state.notes, [companyId]: prompts }
  if (!Object.keys(prompts).length) delete notes[companyId]
  return { ...state, notes }
}

/**
 * Picks the problems for the next timed run: walks the set from a point that moves on with each
 * run, and puts unsolved problems first so repeat runs keep offering something new.
 */
export function pickProblems(company: Pick<Company, 'practice'>, solved: (id: string) => boolean, runs: number): string[] {
  const { problems, count } = company.practice
  const start = (runs * count) % problems.length
  const order = [...problems.slice(start), ...problems.slice(0, start)]
  return [...order.filter(id => !solved(id)), ...order.filter(solved)].slice(0, count)
}
