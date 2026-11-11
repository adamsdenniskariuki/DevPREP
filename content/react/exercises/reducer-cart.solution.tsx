import { useReducer } from 'react'

export type Item = { id: string; name: string; price: number }
export type Line = Item & { quantity: number }
export type CartState = { items: Line[] }
export type CartAction =
  | { type: 'add'; item: Item }
  | { type: 'remove'; id: string }
  | { type: 'setQuantity'; id: string; quantity: number }
  | { type: 'clear' }

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'add': {
      const existing = state.items.some(line => line.id === action.item.id)
      return {
        ...state,
        items: existing
          ? state.items.map(line => (line.id === action.item.id ? { ...line, quantity: line.quantity + 1 } : line))
          : [...state.items, { ...action.item, quantity: 1 }],
      }
    }
    case 'remove':
      return { ...state, items: state.items.filter(line => line.id !== action.id) }
    case 'setQuantity':
      return action.quantity <= 0
        ? { ...state, items: state.items.filter(line => line.id !== action.id) }
        : { ...state, items: state.items.map(line => (line.id === action.id ? { ...line, quantity: action.quantity } : line)) }
    case 'clear':
      return { ...state, items: [] }
    default:
      throw new Error('Unknown action')
  }
}

export function Cart({ catalogue }: { catalogue: Item[] }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [] })
  const total = state.items.reduce((sum, line) => sum + line.price * line.quantity, 0)
  return (
    <div>
      {catalogue.map(item => <button key={item.id} onClick={() => dispatch({ type: 'add', item })}>Add {item.name}</button>)}
      <ul>{state.items.map(line => <li key={line.id}>{line.name} × {line.quantity}</li>)}</ul>
      <p>Total: ${total.toFixed(2)}</p>
      <button onClick={() => dispatch({ type: 'clear' })}>Clear</button>
    </div>
  )
}

export default function App() {
  return <Cart catalogue={[{ id: 'tea', name: 'Tea', price: 3.5 }, { id: 'cake', name: 'Cake', price: 4.25 }]} />
}
