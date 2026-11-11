import { feedReducer, initialFeed } from './index'

const item = (id: string) => ({ id, title: `Item ${id}` })

function firstPage() {
  const refreshing = feedReducer(initialFeed, { type: 'refresh' })
  return feedReducer(refreshing, { type: 'loaded', generation: refreshing.generation, items: [item('1'), item('2')], nextCursor: 'c2', replace: true })
}

export function testRefreshLoadsFirstPage() {
  const state = firstPage()
  assertEqual(state.generation, 1)
  assertEqual(state.items.map(i => i.id), ['1', '2'])
  assertEqual(state.status, 'idle')
  assertEqual(state.cursor, 'c2')
}

export function testLoadMoreAppendsAndDedupes() {
  const loading = feedReducer(firstPage(), { type: 'loadMore' })
  assertEqual(loading.status, 'loadingMore')
  const next = feedReducer(loading, { type: 'loaded', generation: 1, items: [item('2'), item('3')], nextCursor: null, replace: false })
  assertEqual(next.items.map(i => i.id), ['1', '2', '3'])
  assertEqual(next.hasMore, false)
}

export function testLoadMoreIsGuarded() {
  const loading = feedReducer(firstPage(), { type: 'loadMore' })
  assert(feedReducer(loading, { type: 'loadMore' }) === loading, 'second loadMore ignored')
  assert(feedReducer(initialFeed, { type: 'loadMore' }) === initialFeed, 'no cursor yet')
  const done = { ...firstPage(), hasMore: false }
  assert(feedReducer(done, { type: 'loadMore' }) === done, 'no more pages')
}

export function testStaleResponsesIgnored() {
  const loading = feedReducer(firstPage(), { type: 'loadMore' })
  const refreshing = feedReducer(loading, { type: 'refresh' })
  assert(feedReducer(refreshing, { type: 'loaded', generation: 1, items: [item('9')], nextCursor: 'x', replace: false }) === refreshing)
  assert(feedReducer(refreshing, { type: 'failed', generation: 1 }) === refreshing)
  const fresh = feedReducer(refreshing, { type: 'loaded', generation: 2, items: [item('5')], nextCursor: 'c', replace: true })
  assertEqual(fresh.items.map(i => i.id), ['5'])
}

export function testFailure() {
  const refreshing = feedReducer(initialFeed, { type: 'refresh' })
  assertEqual(feedReducer(refreshing, { type: 'failed', generation: 1 }).status, 'error')
}
