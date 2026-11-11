import { test, expect, render, screen, click, fn } from './testing'
import { ErrorBoundary } from './App'

let shouldThrow = true
function Bomb() {
  if (shouldThrow) throw new Error('Boom')
  return <p>All good</p>
}

test('shows the fallback with the message', async () => {
  shouldThrow = true
  await render(<ErrorBoundary><Bomb /></ErrorBoundary>)
  expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong: Boom')
})

test('reports the error', async () => {
  shouldThrow = true
  const onError = fn()
  await render(<ErrorBoundary onError={onError}><Bomb /></ErrorBoundary>)
  expect(onError).toHaveBeenCalledTimes(1)
  expect(onError.calls[0][0].message).toBe('Boom')
})

test('Try again renders the children again', async () => {
  shouldThrow = true
  await render(<ErrorBoundary><Bomb /></ErrorBoundary>)
  shouldThrow = false
  await click(screen.getByRole('button', { name: 'Try again' }))
  expect(screen.getByText('All good')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).toBeNull()
})
