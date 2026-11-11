import { useEffect, useState } from 'react'

export type User = { id: number; name: string }

export function UserProfile({ userId, fetchUser }: { userId: number; fetchUser: (id: number) => Promise<User> }) {
  const [user, setUser] = useState<User | null>(null)

  // TODO: handle loading and errors, and ignore stale responses.
  useEffect(() => {
    fetchUser(userId).then(setUser, () => {})
  }, [userId, fetchUser])

  return user ? <h2>{user.name}</h2> : null
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
