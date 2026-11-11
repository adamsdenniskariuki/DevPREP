import { test, expect, render, screen, selectOption } from './testing'
import { ProductList } from './App'

const products = () => [
  { id: '1', name: 'Kettle', price: 24 },
  { id: '2', name: 'Apron', price: 9.5 },
  { id: '3', name: 'Mug', price: 6 },
]
const items = () => screen.getAllByRole('listitem').map(item => item.textContent)

test('sorts by name with two-decimal prices', async () => {
  await render(<ProductList products={products()} />)
  expect(items()).toEqual(['Apron: $9.50', 'Kettle: $24.00', 'Mug: $6.00'])
})

test('sorts by price', async () => {
  await render(<ProductList products={products()} />)
  await selectOption(screen.getByLabelText('Sort by'), 'price')
  expect(items()).toEqual(['Mug: $6.00', 'Apron: $9.50', 'Kettle: $24.00'])
})

test('does not reorder the products prop', async () => {
  const list = products()
  await render(<ProductList products={list} />)
  expect(list.map(product => product.name)).toEqual(['Kettle', 'Apron', 'Mug'])
})
