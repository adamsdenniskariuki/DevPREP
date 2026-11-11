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
    case 'refresh': return { ...state, status: 'refreshing' }
    case 'loadMore': return { ...state, status: 'loadingMore' }
    case 'loaded': return { ...state, items: [...state.items, ...action.items], cursor: action.nextCursor, status: 'idle' }
    case 'failed': return { ...state, status: 'error' }
  }
}
