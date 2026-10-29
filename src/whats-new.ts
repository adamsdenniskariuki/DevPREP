/** The last app version this browser has seen, used to show What's new once per version. Not part of backups. */
export const LAST_SEEN_VERSION_KEY = 'devprep.last-seen-version.v1'

export interface WhatsNewDecision {
  /** Show the What's new card for releases after this version (undefined: just the current one). */
  show: boolean
  since?: string
}

/**
 * Decides whether to show What's new for the running version and records that it has been seen, so the card
 * appears once per version. A browser that has never recorded a version is a first install: no card.
 */
export function decideWhatsNew(current: string, storage: Pick<Storage, 'getItem' | 'setItem'> | undefined): WhatsNewDecision {
  let previous: string | null = null
  try {
    previous = storage?.getItem(LAST_SEEN_VERSION_KEY) ?? null
    if (previous !== current) storage?.setItem(LAST_SEEN_VERSION_KEY, current)
  } catch {
    return { show: false }
  }
  if (previous === null || previous === current) return { show: false }
  return { show: true, since: previous }
}
