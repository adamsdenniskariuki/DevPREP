import { test, expect, render, screen, click, type } from './testing'
import { TodoList } from './App'

test('adds a trimmed item and clears the input', async () => {
  await render(<TodoList />)
  await type(screen.getByLabelText('New todo'), '  Buy milk ')
  await click(screen.getByRole('button', { name: 'Add' }))
  expect(screen.getByRole('checkbox', { name: 'Buy milk' })).toBeInTheDocument()
  expect(screen.getByLabelText('New todo')).toHaveValue('')
  expect(screen.getByText('1 left')).toBeInTheDocument()
})

test('ignores blank text', async () => {
  await render(<TodoList />)
  await type(screen.getByLabelText('New todo'), '   ')
  await click(screen.getByRole('button', { name: 'Add' }))
  expect(screen.queryAllByRole('listitem')).toHaveLength(0)
})

test('toggles an item', async () => {
  await render(<TodoList initial={[{ id: 1, text: 'Walk', done: false }]} />)
  await click(screen.getByRole('checkbox', { name: 'Walk' }))
  expect(screen.getByRole('checkbox', { name: 'Walk' })).toBeChecked()
  expect(screen.getByText('0 left')).toBeInTheDocument()
})

test('never mutates the initial prop', async () => {
  const initial = [{ id: 1, text: 'Walk', done: false }]
  await render(<TodoList initial={initial} />)
  await click(screen.getByRole('checkbox', { name: 'Walk' }))
  await type(screen.getByLabelText('New todo'), 'Run')
  await click(screen.getByRole('button', { name: 'Add' }))
  expect(initial).toEqual([{ id: 1, text: 'Walk', done: false }])
})
