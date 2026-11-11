import { test, expect, render, screen, click, fn } from './testing'
import { Disclosure } from './App'

test('starts collapsed', async () => {
  await render(<Disclosure title="More">Secret</Disclosure>)
  expect(screen.getByRole('button', { name: 'More' })).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByText('Secret')).toBeNull()
})

test('opens on click and points aria-controls at the panel', async () => {
  await render(<Disclosure title="More">Secret</Disclosure>)
  const button = screen.getByRole('button', { name: 'More' })
  await click(button)
  expect(button).toHaveAttribute('aria-expanded', 'true')
  const panel = screen.getByText('Secret')
  expect(panel.id.length).toBeGreaterThan(0)
  expect(button).toHaveAttribute('aria-controls', panel.id)
})

test('honours defaultOpen and calls onToggle with the next state', async () => {
  const onToggle = fn()
  await render(<Disclosure title="More" defaultOpen onToggle={onToggle}>Secret</Disclosure>)
  expect(screen.getByText('Secret')).toBeInTheDocument()
  await click(screen.getByRole('button', { name: 'More' }))
  expect(onToggle).toHaveBeenCalledWith(false)
  expect(screen.queryByText('Secret')).toBeNull()
})
