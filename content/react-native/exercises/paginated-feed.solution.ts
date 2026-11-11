export interface Item { id: string; title: string }
export type Status = 'idle' | 'loading' | 'loadingMore' | 'refreshing' | 'error'
export interface FeedState { items: Item[]; cursor: string | null; status: Status; generation: number; hasMore: boolean }
export type FeedAction =
  | { type: 'refresh' }
  | { type: 'loadMore' }
  | { type: 'loaded'; generation: number; items: Item[]; nextCursor: string | null; replace: boolean }
  | { type: 'failed'; generation: number }

export const initialFeed: FeedState = { items: [], cursor: null, status: 'idle', generation: 0, hasMore: true }

export function feedReducer(state: FeedState, action: FeedAction): FeedState {
  switch (action.type) {
    case 'refresh':
      return { ...state, status: 'refreshing', generation: state.generation + 1 }
    case 'loadMore':
      if (state.status !== 'idle' || !state.hasMore || state.cursor === null) return state
      return { ...state, status: 'loadingMore' }
    case 'loaded': {
      if (action.generation !== state.generation) return state
      const base = action.replace ? [] : state.items
      const seen = new Set(base.map(item => item.id))
      const fresh = action.items.filter(item => !seen.has(item.id) && seen.add(item.id))
      return { ...state, items: [...base, ...fresh], cursor: action.nextCursor, hasMore: action.nextCursor !== null, status: 'idle' }
    }
    case 'failed':
      return action.generation === state.generation ? { ...state, status: 'error' } : state
  }
}
