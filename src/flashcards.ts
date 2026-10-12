import type { Track } from './curriculum-types'
import type { CardState, Progress } from './progress'
import index from './generated/flashcard-index.json' with { type: 'json' }

export interface Flashcard {
  id: string
  front: string
  back: string
  level: 'se' | 'sse'
}
export interface Deck {
  track: Track
  title: string
  cards: Flashcard[]
}
export interface DeckSummary {
  track: Track
  title: string
  cards: string[]
}

// Built from content/flashcards/*.json. The id index is eager (backup validation needs it); card text loads lazily.
export const deckIndex = index as DeckSummary[]
export const cardIds = new Set(deckIndex.flatMap(deck => deck.cards))
export const cardTrack = new Map(deckIndex.flatMap(deck => deck.cards.map(id => [id, deck.track] as const)))

let cache: Promise<Deck[]> | undefined
export function loadDecks(): Promise<Deck[]> {
  cache ??= import('./generated/flashcards.json').then(module => module.default as Deck[])
  return cache
}

/** Days until the next review for each Leitner box. */
export const BOX_DAYS = [0, 1, 3, 7, 14, 30, 60] as const
export const NEW_PER_SESSION = 10
export type Grade = 'again' | 'hard' | 'good' | 'easy'

function addDays(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + days))
  return date.toISOString().slice(0, 10)
}

/**
 * Leitner scheduling: Again drops to box 0 (due today), Hard keeps the box (at least 1),
 * Good moves up one box and Easy moves up two. Boxes cap at 6 (60 days).
 */
export function gradeCard(previous: CardState | undefined, grade: Grade, today: string, now = new Date()): CardState {
  const box = previous?.box ?? 0
  const next = grade === 'again' ? 0 : grade === 'hard' ? Math.max(1, box) : Math.min(6, box + (grade === 'good' ? 1 : 2))
  return { box: next, due: addDays(today, BOX_DAYS[next]), at: now.toISOString(), reviews: Math.min(100_000, (previous?.reviews ?? 0) + 1) }
}

/** Cards due on or before today, plus up to `newLimit` unseen cards, in deck order. */
export function sessionQueue(progress: Pick<Progress, 'cards'>, ids: string[], today: string, newLimit = NEW_PER_SESSION): string[] {
  const cards = progress.cards ?? {}
  const due = ids.filter(id => cards[id] && cards[id].due <= today).sort((a, b) => cards[a].due.localeCompare(cards[b].due) || cards[a].box - cards[b].box)
  const fresh = ids.filter(id => !cards[id]).slice(0, newLimit)
  return [...due, ...fresh]
}

export function dueCount(progress: Pick<Progress, 'cards'>, today: string, track?: Track): number {
  return Object.entries(progress.cards ?? {}).filter(([id, card]) => card.due <= today && (!track || cardTrack.get(id) === track)).length
}

/** Cards in box 4 or higher (a review interval of two weeks or more). */
export function masteredCount(progress: Pick<Progress, 'cards'>, track?: Track): number {
  return Object.entries(progress.cards ?? {}).filter(([id, card]) => card.box >= 4 && (!track || cardTrack.get(id) === track)).length
}
