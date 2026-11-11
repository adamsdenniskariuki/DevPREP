import { test, expect, render, screen } from './testing'
import { Inbox } from './App'

const read = (id: string, subject: string) => ({ id, subject, read: true })
const unread = (id: string, subject: string) => ({ id, subject, read: false })

test('counts unread messages', async () => {
  await render(<Inbox messages={[unread('a', 'Hello'), unread('b', 'Invoice'), read('c', 'Old')]} />)
  expect(screen.getByText('You have 2 unread messages')).toBeInTheDocument()
  expect(screen.getAllByRole('listitem')).toHaveLength(3)
})

test('uses the singular for one message', async () => {
  await render(<Inbox messages={[unread('a', 'Hello')]} />)
  expect(screen.getByText('You have 1 unread message')).toBeInTheDocument()
})

test('renders no stray 0 when everything is read', async () => {
  const { container } = await render(<Inbox messages={[read('a', 'Hello')]} />)
  expect(container.textContent).not.toMatch(/0/)
})

test('shows an empty state with no list', async () => {
  await render(<Inbox messages={[]} />)
  expect(screen.getByText('No messages')).toBeInTheDocument()
  expect(screen.queryByRole('list')).toBeNull()
})
