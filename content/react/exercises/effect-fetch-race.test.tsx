import { test, expect, render, screen, tick, fn } from './testing'
import { UserProfile, type User } from './App'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

test('shows loading, then the user', async () => {
  const request = deferred<User>()
  await render(<UserProfile userId={1} fetchUser={() => request.promise} />)
  expect(screen.getByText('Loading…')).toBeInTheDocument()
  request.resolve({ id: 1, name: 'Ada' })
  expect(await screen.findByRole('heading')).toHaveTextContent('Ada')
})

test('shows an error when the request fails', async () => {
  await render(<UserProfile userId={1} fetchUser={() => Promise.reject(new Error('offline'))} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load user.')
})

test('ignores a stale response', async () => {
  const first = deferred<User>()
  const second = deferred<User>()
  const fetchUser = fn((id: number) => (id === 1 ? first.promise : second.promise))
  const view = await render(<UserProfile userId={1} fetchUser={fetchUser} />)
  await view.rerender(<UserProfile userId={2} fetchUser={fetchUser} />)
  second.resolve({ id: 2, name: 'Grace' })
  await tick(10)
  first.resolve({ id: 1, name: 'Ada' })
  await tick(10)
  expect(screen.getByRole('heading')).toHaveTextContent('Grace')
  expect(fetchUser).toHaveBeenCalledTimes(2)
})
