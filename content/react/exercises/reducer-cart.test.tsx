import { test, expect, render, screen, click } from './testing'
import { cartReducer, Cart } from './App'

const tea = { id: 'tea', name: 'Tea', price: 3.5 }

test('adds a new line, then increments it', () => {
  const once = cartReducer({ items: [] }, { type: 'add', item: tea })
  const twice = cartReducer(once, { type: 'add', item: tea })
  expect(twice.items).toEqual([{ ...tea, quantity: 2 }])
})

test('never mutates the previous state', () => {
  const state = { items: [{ ...tea, quantity: 1 }] }
  const before = JSON.stringify(state)
  const next = cartReducer(state, { type: 'add', item: tea })
  cartReducer(state, { type: 'setQuantity', id: 'tea', quantity: 5 })
  expect(JSON.stringify(state)).toBe(before)
  expect(next === state).toBe(false)
})

test('removes, sets quantity and clears', () => {
  const state = { items: [{ ...tea, quantity: 2 }, { id: 'cake', name: 'Cake', price: 4, quantity: 1 }] }
  expect(cartReducer(state, { type: 'remove', id: 'cake' }).items).toHaveLength(1)
  expect(cartReducer(state, { type: 'setQuantity', id: 'tea', quantity: 0 }).items.map(line => line.id)).toEqual(['cake'])
  expect(cartReducer(state, { type: 'setQuantity', id: 'tea', quantity: 5 }).items[0].quantity).toBe(5)
  expect(cartReducer(state, { type: 'clear' }).items).toEqual([])
})

test('the cart shows a running total', async () => {
  await render(<Cart catalogue={[tea, { id: 'cake', name: 'Cake', price: 4.25 }]} />)
  await click(screen.getByRole('button', { name: 'Add Tea' }))
  await click(screen.getByRole('button', { name: 'Add Tea' }))
  await click(screen.getByRole('button', { name: 'Add Cake' }))
  expect(screen.getByText('Total: $11.25')).toBeInTheDocument()
})
