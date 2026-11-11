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

function make(state: StackState, name: string, params?: Record<string, unknown>): Route {
  return { key: `${name}-${state.nextId}`, name, ...(params ? { params } : {}) }
}

export function navReducer(state: StackState, action: NavAction): StackState {
  const { routes } = state
  switch (action.type) {
    case 'push':
      return { routes: [...routes, make(state, action.name, action.params)], nextId: state.nextId + 1 }
    case 'pop': {
      const keep = Math.max(1, routes.length - (action.count ?? 1))
      return keep === routes.length ? state : { ...state, routes: routes.slice(0, keep) }
    }
    case 'popToTop':
      return routes.length === 1 ? state : { ...state, routes: routes.slice(0, 1) }
    case 'replace':
      return { routes: [...routes.slice(0, -1), make(state, action.name, action.params)], nextId: state.nextId + 1 }
    case 'navigate': {
      let index = -1
      for (let i = routes.length - 1; i >= 0; i--) if (routes[i].name === action.name) { index = i; break }
      if (index < 0) return navReducer(state, { type: 'push', name: action.name, params: action.params })
      const existing = routes[index]
      const params = action.params ? { ...existing.params, ...action.params } : existing.params
      const route: Route = { key: existing.key, name: existing.name, ...(params ? { params } : {}) }
      return { ...state, routes: [...routes.slice(0, index), route] }
    }
  }
}
