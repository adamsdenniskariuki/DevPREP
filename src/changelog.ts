import data from './generated/changelog.json'

export interface ReleaseHighlight {
  text: string
  route: string
}

export interface Release {
  version: string
  date: string
  title: string
  highlights: ReleaseHighlight[]
  notes: string[]
}

/** Every release, newest first (validated by npm run content). Imported lazily, so it stays out of the main chunk. */
export const RELEASES: readonly Release[] = data as Release[]

export function formatReleaseDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
}
