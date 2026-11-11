import { test, expect, render, screen, tick } from './testing'
import { useDebouncedValue } from './App'

function Probe({ value, delay }: { value: string; delay: number }) {
  const debounced = useDebouncedValue(value, delay)
  return <p data-testid="out">{debounced}</p>
}
const out = () => screen.getByTestId('out').textContent

test('returns the first value immediately', async () => {
  await render(<Probe value="a" delay={100} />)
  expect(out()).toBe('a')
})

test('waits for the delay before updating', async () => {
  const view = await render(<Probe value="a" delay={100} />)
  await view.rerender(<Probe value="ab" delay={100} />)
  expect(out()).toBe('a')
  await tick(180)
  expect(out()).toBe('ab')
})

test('restarts the timer on every change', async () => {
  const view = await render(<Probe value="a" delay={150} />)
  await view.rerender(<Probe value="ab" delay={150} />)
  await tick(80)
  await view.rerender(<Probe value="abc" delay={150} />)
  await tick(80)
  expect(out()).toBe('a')
  await tick(150)
  expect(out()).toBe('abc')
})
