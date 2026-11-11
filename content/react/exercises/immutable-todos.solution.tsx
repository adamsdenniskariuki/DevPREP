import { useState } from 'react'

export type Todo = { id: number; text: string; done: boolean }

export function TodoList({ initial = [] }: { initial?: Todo[] }) {
  const [todos, setTodos] = useState(initial)
  const [text, setText] = useState('')

  function add() {
    const trimmed = text.trim()
    if (!trimmed) return
    setTodos(current => [...current, { id: Math.max(0, ...current.map(todo => todo.id)) + 1, text: trimmed, done: false }])
    setText('')
  }
  function toggle(id: number) {
    setTodos(current => current.map(todo => (todo.id === id ? { ...todo, done: !todo.done } : todo)))
  }

  return (
    <div>
      <label>New todo <input value={text} onChange={e => setText(e.target.value)} /></label>
      <button onClick={add}>Add</button>
      <ul>
        {todos.map(todo => (
          <li key={todo.id}>
            <label><input type="checkbox" checked={todo.done} onChange={() => toggle(todo.id)} /> {todo.text}</label>
          </li>
        ))}
      </ul>
      <p>{todos.filter(todo => !todo.done).length} left</p>
    </div>
  )
}

export default function App() {
  return <TodoList initial={[{ id: 1, text: 'Read the docs', done: false }]} />
}
