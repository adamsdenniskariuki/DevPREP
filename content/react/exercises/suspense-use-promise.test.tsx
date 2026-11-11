import { test, expect, render, screen } from './testing'
import { Profile } from './App'

test('shows the fallback while the promise is pending', async () => {
  const pending = new Promise<{ name: string }>(() => {})
  await render(<Profile userPromise={pending} />)
  expect(screen.getByText('Loading profile…')).toBeInTheDocument()
})

test('shows the user once the promise resolves', async () => {
  let resolve!: (user: { name: string }) => void
  const promise = new Promise<{ name: string }>(yes => { resolve = yes })
  await render(<Profile userPromise={promise} />)
  resolve({ name: 'Grace Hopper' })
  expect(await screen.findByRole('heading', { name: 'Grace Hopper' })).toBeInTheDocument()
  expect(screen.queryByText('Loading profile…')).toBeNull()
})
