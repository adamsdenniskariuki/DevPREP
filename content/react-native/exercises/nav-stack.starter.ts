export interface Route { key: string; name: string; params?: Record<string, unknown> }
export interface StackState { routes: Route[]; nextId: number }
export type NavAction =
  | { type: 'push'; name: string; params?: Record<string, unknown> }
  | { type: 'pop'; count?: number }
  | { type: 'popToTop' }
  | { type: 'replace'; name: string; params?: Record<string, unknown> }
  | { type: 'navigate'; name: string; params?: Record<string, unknown> }

export function initialStack(name: string, params?: Record<string, unknown>): StackState {
  return { routes: [{ key: `${name}-0`, name, ...(params ? { params } : {}) }], nextId: 1 }
}

export function navReducer(state: StackState, action: NavAction): StackState {
  switch (action.type) {
    case 'push':
      state.routes.push({ key: `${action.name}-${state.nextId}`, name: action.name, params: action.params })
      return state
    default:
      // TODO: pop, popToTop, replace, navigate
      return state
  }
}
