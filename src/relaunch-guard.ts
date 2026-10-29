import { useEffect, useRef } from 'react'

/**
 * Work that must be safely saved before DevPREP relaunches for an update. Screens register a save check while
 * mounted; Relaunch now runs every check first and stops if any reports a problem. Timed activities register as
 * busy so the user is warned before relaunching mid-run.
 */
export type SaveCheck = () => string | undefined | void | Promise<string | undefined | void>

const savers = new Map<symbol, SaveCheck>()
const busy = new Map<symbol, string>()

export function registerSaveCheck(check: SaveCheck): () => void {
  const key = Symbol('save-check')
  savers.set(key, check)
  return () => { savers.delete(key) }
}

export function registerBusy(label: string): () => void {
  const key = Symbol('busy')
  busy.set(key, label)
  return () => { busy.delete(key) }
}

export interface RelaunchCheck {
  /** Reasons the relaunch must not happen, e.g. a draft that could not be saved. */
  blocked: string[]
  /** Timed activities in progress, which the user should confirm leaving. */
  busy: string[]
}

/** Saves and rechecks every registered piece of work. */
export async function checkBeforeRelaunch(): Promise<RelaunchCheck> {
  const results = await Promise.all([...savers.values()].map(async check => {
    try { return (await check()) || undefined } catch (error) { return error instanceof Error ? error.message : 'Some work could not be saved.' }
  }))
  return { blocked: results.filter((item): item is string => !!item), busy: [...new Set(busy.values())] }
}

/** While mounted, saves this screen's work before a relaunch. The check returns a problem message, or nothing when saved. */
export function useSaveCheck(check: SaveCheck) {
  const latest = useRef(check)
  latest.current = check
  useEffect(() => registerSaveCheck(() => latest.current()), [])
}

/** While mounted and given a label, warns before a relaunch that this timed activity is in progress. */
export function useBusy(label: string | false | undefined) {
  useEffect(() => label ? registerBusy(label) : undefined, [label])
}
