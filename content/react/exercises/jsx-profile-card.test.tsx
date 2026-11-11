import { test, expect, render, screen } from './testing'
import { ProfileCard } from './App'

test('shows the name as a level-2 heading', async () => {
  await render(<ProfileCard name="Grace Hopper" title="Rear admiral" />)
  expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Grace Hopper')
})

test('shows the title in a paragraph', async () => {
  await render(<ProfileCard name="Grace Hopper" title="Rear admiral" />)
  expect(screen.getByText('Rear admiral').tagName).toBe('P')
})

test('renders an avatar with alt text when a URL is given', async () => {
  await render(<ProfileCard name="Grace Hopper" title="Rear admiral" avatarUrl="data:,grace" />)
  expect(screen.getByRole('img', { name: "Grace Hopper's avatar" })).toHaveAttribute('src', 'data:,grace')
})

test('renders no image without a URL', async () => {
  const { container } = await render(<ProfileCard name="Grace Hopper" title="Rear admiral" />)
  expect(container.querySelector('img')).toBeNull()
})
