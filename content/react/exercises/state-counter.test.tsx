import { test, expect, render, screen, click } from './testing'
import { Counter } from './App'

test('starts at zero and increments by one', async () => {
  await render(<Counter />)
  expect(screen.getByText('Count: 0')).toBeInTheDocument()
  await click(screen.getByRole('button', { name: 'Increment' }))
  expect(screen.getByText('Count: 1')).toBeInTheDocument()
})

test('uses the step prop', async () => {
  await render(<Counter step={3} />)
  await click(screen.getByRole('button', { name: 'Increment' }))
  await click(screen.getByRole('button', { name: 'Increment' }))
  expect(screen.getByText('Count: 6')).toBeInTheDocument()
})

test('never goes below zero', async () => {
  await render(<Counter step={2} />)
  await click(screen.getByRole('button', { name: 'Increment' }))
  await click(screen.getByRole('button', { name: 'Decrement' }))
  await click(screen.getByRole('button', { name: 'Decrement' }))
  expect(screen.getByText('Count: 0')).toBeInTheDocument()
})

test('resets to zero', async () => {
  await render(<Counter step={4} />)
  await click(screen.getByRole('button', { name: 'Increment' }))
  await click(screen.getByRole('button', { name: 'Reset' }))
  expect(screen.getByText('Count: 0')).toBeInTheDocument()
})
