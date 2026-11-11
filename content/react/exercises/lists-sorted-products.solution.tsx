import { useState } from 'react'

export type Product = { id: string; name: string; price: number }

export function ProductList({ products }: { products: Product[] }) {
  const [sortBy, setSortBy] = useState<'name' | 'price'>('name')
  const sorted = [...products].sort((a, b) => (sortBy === 'name' ? a.name.localeCompare(b.name) : a.price - b.price))
  return (
    <div>
      <label>Sort by <select value={sortBy} onChange={e => setSortBy(e.target.value as 'name' | 'price')}>
        <option value="name">name</option>
        <option value="price">price</option>
      </select></label>
      <ul>
        {sorted.map(product => <li key={product.id}>{product.name}: ${product.price.toFixed(2)}</li>)}
      </ul>
    </div>
  )
}

export default function App() {
  return <ProductList products={[{ id: '1', name: 'Kettle', price: 24 }, { id: '2', name: 'Apron', price: 9.5 }, { id: '3', name: 'Mug', price: 6 }]} />
}
