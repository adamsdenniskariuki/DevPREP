import { test, expect, render, screen, click, waitFor } from './testing'
import { LikeButton } from './App'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

test('shows the like immediately', async () => {
  const request = deferred<number>()
  await render(<LikeButton initialLikes={5} sendLike={() => request.promise} />)
  await click(screen.getByRole('button', { name: 'Like (5)' }))
  expect(screen.getByRole('button')).toHaveTextContent('Like (6)')
  request.resolve(6)
})

test('keeps the saved count from the server', async () => {
  await render(<LikeButton initialLikes={5} sendLike={() => Promise.resolve(9)} />)
  await click(screen.getByRole('button', { name: 'Like (5)' }))
  await waitFor(() => expect(screen.getByRole('button')).toHaveTextContent('Like (9)'))
})

test('rolls back and explains a failure', async () => {
  const request = deferred<number>()
  await render(<LikeButton initialLikes={5} sendLike={() => request.promise} />)
  await click(screen.getByRole('button', { name: 'Like (5)' }))
  request.reject(new Error('offline'))
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save your like.')
  expect(screen.getByRole('button')).toHaveTextContent('Like (5)')
})
