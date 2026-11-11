import { test, expect, render, screen, click, tick } from './testing'
import { Stopwatch } from './App'

const elapsed = () => Number(screen.getByTestId('elapsed').textContent)

test('counts while running', async () => {
  await render(<Stopwatch intervalMs={20} />)
  await click(screen.getByRole('button', { name: 'Start' }))
  await tick(200)
  expect(elapsed()).toBeGreaterThan(3)
})

test('stops counting after Stop', async () => {
  await render(<Stopwatch intervalMs={20} />)
  await click(screen.getByRole('button', { name: 'Start' }))
  await tick(100)
  await click(screen.getByRole('button', { name: 'Stop' }))
  const paused = elapsed()
  await tick(120)
  expect(elapsed()).toBe(paused)
})

test('resets to zero', async () => {
  await render(<Stopwatch intervalMs={20} />)
  await click(screen.getByRole('button', { name: 'Start' }))
  await tick(80)
  await click(screen.getByRole('button', { name: 'Stop' }))
  await click(screen.getByRole('button', { name: 'Reset' }))
  expect(elapsed()).toBe(0)
})
