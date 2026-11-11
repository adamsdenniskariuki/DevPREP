export type AppStateStatus = 'active' | 'inactive' | 'background'
export interface LockState { appState: AppStateStatus; backgroundedAt: number | null; locked: boolean }
export type LockEvent = { type: 'change'; next: AppStateStatus; at: number } | { type: 'unlock' }

export const initialLock: LockState = { appState: 'active', backgroundedAt: null, locked: false }

export function createLockReducer(timeoutMs: number) {
  return function lockReducer(state: LockState, event: LockEvent): LockState {
    if (event.type === 'unlock') return { ...state, locked: false }
    // TODO: record background time and lock on return
    return { ...state, appState: event.next, locked: event.next !== 'active' }
  }
}
