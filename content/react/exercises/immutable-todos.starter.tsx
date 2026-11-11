import { useState } from 'react'

export type Todo = { id: number; text: string; done: boolean }

export function TodoList({ initial = [] }: { initial?: Todo[] }) {
  const [todos, setTodos] = useState(initial)
  const [text, setText] = useState('')

  // TODO: these mutate state in place. Rewrite them immutably.
  function add() {
    todos.push({ id: todos.length + 1, text, done: false })
    setTodos(todos)
  }
  function toggle(todo: Todo) {
    todo.done = !todo.done
    setTodos([...todos])
  }

  return (
    <div>
      <label>New todo <input value={text} onChange={e => setText(e.target.value)} /></label>
      <button onClick={add}>Add</button>
      <ul>
        {todos.map(todo => (
          <li key={todo.id}>
            <label><input type="checkbox" checked={todo.done} onChange={() => toggle(todo)} /> {todo.text}</label>
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
