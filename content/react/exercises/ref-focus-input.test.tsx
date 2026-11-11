import { test, expect, render, screen, click, type } from './testing'
import { SearchBox, FancyInput } from './App'

test('focuses the input', async () => {
  await render(<SearchBox />)
  await click(screen.getByRole('button', { name: 'Focus search' }))
  expect(screen.getByLabelText('Search')).toHaveFocus()
})

test('clears and refocuses', async () => {
  await render(<SearchBox />)
  await type(screen.getByLabelText('Search'), 'hooks')
  ;(document.activeElement as HTMLElement | null)?.blur()
  await click(screen.getByRole('button', { name: 'Clear' }))
  expect(screen.getByLabelText('Search')).toHaveValue('')
  expect(screen.getByLabelText('Search')).toHaveFocus()
})

test('FancyInput forwards ref as a prop', async () => {
  const ref = { current: null as HTMLInputElement | null }
  await render(<FancyInput label="Name" ref={ref} />)
  expect(ref.current).toBe(screen.getByLabelText('Name'))
})
