import { test, expect, render, screen, click, fn } from './testing'
import { FruitPicker } from './App'

test('renders each row once at first', async () => {
  const onRowRender = fn()
  await render(<FruitPicker onRowRender={onRowRender} />)
  expect(onRowRender).toHaveBeenCalledTimes(3)
})

test('an unrelated update does not re-render rows', async () => {
  const onRowRender = fn()
  await render(<FruitPicker onRowRender={onRowRender} />)
  await click(screen.getByRole('button', { name: 'Clicked 0' }))
  await click(screen.getByRole('button', { name: 'Clicked 1' }))
  expect(onRowRender).toHaveBeenCalledTimes(3)
})

test('selecting still works', async () => {
  const onRowRender = fn()
  await render(<FruitPicker onRowRender={onRowRender} />)
  await click(screen.getByRole('button', { name: 'Select Banana' }))
  expect(screen.getByText('Selected: Banana')).toBeInTheDocument()
  expect(onRowRender).toHaveBeenCalledTimes(3)
})
