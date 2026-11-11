import { useEffect, useState } from 'react'

export type User = { id: number; name: string }

type State = { status: 'loading' } | { status: 'done'; user: User } | { status: 'error' }

export function UserProfile({ userId, fetchUser }: { userId: number; fetchUser: (id: number) => Promise<User> }) {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let ignore = false
    setState({ status: 'loading' })
    fetchUser(userId).then(
      user => { if (!ignore) setState({ status: 'done', user }) },
      () => { if (!ignore) setState({ status: 'error' }) },
    )
    return () => { ignore = true }
  }, [userId, fetchUser])

  if (state.status === 'loading') return <p>Loading…</p>
  if (state.status === 'error') return <p role="alert">Could not load user.</p>
  return <h2>{state.user.name}</h2>
}

const names = ['Ada', 'Grace', 'Linus']
const fakeFetch = (id: number) => new Promise<User>(resolve => setTimeout(() => resolve({ id, name: names[id - 1] }), 300 + Math.random() * 600))

export default function App() {
  const [id, setId] = useState(1)
  return (
    <div>
      {[1, 2, 3].map(n => <button key={n} onClick={() => setId(n)}>User {n}</button>)}
      <UserProfile userId={id} fetchUser={fakeFetch} />
    </div>
  )
}
