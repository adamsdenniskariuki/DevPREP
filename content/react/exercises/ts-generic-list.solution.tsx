import type { ReactNode } from 'react'

type ListProps<T> = {
  items: T[]
  getKey: (item: T) => string | number
  renderItem: (item: T) => ReactNode
  empty?: ReactNode
}

export function List<T>({ items, getKey, renderItem, empty = 'Nothing here' }: ListProps<T>) {
  if (items.length === 0) return <p>{empty}</p>
  return <ul>{items.map(item => <li key={getKey(item)}>{renderItem(item)}</li>)}</ul>
}

type Book = { isbn: string; title: string; year: number }
const books: Book[] = [{ isbn: '1', title: 'Dune', year: 1965 }, { isbn: '2', title: 'Neuromancer', year: 1984 }]

export default function App() {
  return <List items={books} getKey={book => book.isbn} renderItem={book => <><strong>{book.title}</strong> ({book.year})</>} />
}
