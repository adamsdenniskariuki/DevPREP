import { initialStack, navReducer } from './index'

const names = (state: { routes: { name: string }[] }) => state.routes.map(route => route.name)

export function testPushAddsRoutesWithKeys() {
  const start = initialStack('Home')
  const next = navReducer(navReducer(start, { type: 'push', name: 'Product', params: { id: '1' } }), { type: 'push', name: 'Product', params: { id: '2' } })
  assertEqual(names(next), ['Home', 'Product', 'Product'])
  assertEqual(next.routes.map(route => route.key), ['Home-0', 'Product-1', 'Product-2'])
  assertEqual(next.routes[2].params, { id: '2' })
  assertEqual(names(start), ['Home'], 'push must not mutate')
}

export function testPopKeepsRoot() {
  let state = initialStack('Home')
  state = navReducer(state, { type: 'push', name: 'A' })
  state = navReducer(state, { type: 'push', name: 'B' })
  assertEqual(names(navReducer(state, { type: 'pop' })), ['Home', 'A'])
  assertEqual(names(navReducer(state, { type: 'pop', count: 5 })), ['Home'])
  const root = initialStack('Home')
  assert(navReducer(root, { type: 'pop' }) === root, 'unchanged state is returned as is')
}

export function testPopToTop() {
  let state = initialStack('Home')
  state = navReducer(state, { type: 'push', name: 'A' })
  state = navReducer(state, { type: 'push', name: 'B' })
  assertEqual(names(navReducer(state, { type: 'popToTop' })), ['Home'])
  const root = initialStack('Home')
  assert(navReducer(root, { type: 'popToTop' }) === root)
}

export function testReplaceSwapsTop() {
  let state = initialStack('Login')
  state = navReducer(state, { type: 'replace', name: 'Home' })
  assertEqual(names(state), ['Home'])
  assertEqual(state.routes[0].key, 'Home-1')
}

export function testNavigateReusesExistingRoute() {
  let state = initialStack('Home')
  state = navReducer(state, { type: 'push', name: 'Product', params: { id: '1', tab: 'info' } })
  state = navReducer(state, { type: 'push', name: 'Reviews' })
  const next = navReducer(state, { type: 'navigate', name: 'Product', params: { id: '2' } })
  assertEqual(names(next), ['Home', 'Product'])
  assertEqual(next.routes[1].key, 'Product-1')
  assertEqual(next.routes[1].params, { id: '2', tab: 'info' })
}

export function testNavigatePushesWhenMissing() {
  const next = navReducer(initialStack('Home'), { type: 'navigate', name: 'Cart' })
  assertEqual(names(next), ['Home', 'Cart'])
  assertEqual(next.nextId, 2)
}
