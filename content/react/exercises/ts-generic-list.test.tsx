import { test, expect, render, screen } from './testing'
import { List } from './App'

test('renders each item with renderItem', async () => {
  await render(<List items={[{ id: 1, name: 'Ada' }, { id: 2, name: 'Grace' }]} getKey={person => person.id} renderItem={person => <em>{person.name.toUpperCase()}</em>} />)
  expect(screen.getAllByRole('listitem').map(item => item.textContent)).toEqual(['ADA', 'GRACE'])
})

test('works with primitive items', async () => {
  await render(<List items={[3, 1, 2]} getKey={n => n} renderItem={n => `#${n}`} />)
  expect(screen.getAllByRole('listitem').map(item => item.textContent)).toEqual(['#3', '#1', '#2'])
})

test('shows the default empty message', async () => {
  await render(<List items={[] as string[]} getKey={s => s} renderItem={s => s} />)
  expect(screen.getByText('Nothing here')).toBeInTheDocument()
  expect(screen.queryByRole('list')).toBeNull()
})

test('accepts a custom empty node', async () => {
  await render(<List items={[] as string[]} getKey={s => s} renderItem={s => s} empty={<em>No books yet</em>} />)
  expect(screen.getByText('No books yet')).toBeInTheDocument()
})
