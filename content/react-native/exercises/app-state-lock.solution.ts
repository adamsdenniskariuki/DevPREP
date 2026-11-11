export type AppStateStatus = 'active' | 'inactive' | 'background'
export interface LockState { appState: AppStateStatus; backgroundedAt: number | null; locked: boolean }
export type LockEvent = { type: 'change'; next: AppStateStatus; at: number } | { type: 'unlock' }

export const initialLock: LockState = { appState: 'active', backgroundedAt: null, locked: false }

export function createLockReducer(timeoutMs: number) {
  return function lockReducer(state: LockState, event: LockEvent): LockState {
    if (event.type === 'unlock') return state.locked ? { ...state, locked: false } : state
    if (event.next === state.appState) return state
    if (event.next === 'background') return { ...state, appState: 'background', backgroundedAt: state.backgroundedAt ?? event.at }
    if (event.next === 'inactive') return { ...state, appState: 'inactive' }
    const away = state.backgroundedAt === null ? 0 : event.at - state.backgroundedAt
    const expired = state.backgroundedAt !== null && away >= timeoutMs
    return { appState: 'active', backgroundedAt: null, locked: state.locked || expired }
  }
}
