import { useEffect, useState } from 'react'

export type User = { name: string }

// TODO: read the promise with use() instead of an effect.
export function UserName({ userPromise }: { userPromise: Promise<User> }) {
  const [user, setUser] = useState<User | null>(null)
  useEffect(() => { userPromise.then(setUser) }, [userPromise])
  return user ? <h2>{user.name}</h2> : null
}

// TODO: wrap UserName in Suspense with a "Loading profile…" fallback.
export function Profile({ userPromise }: { userPromise: Promise<User> }) {
  return <section><UserName userPromise={userPromise} /></section>
}

export default function App() {
  const [promise] = useState(() => new Promise<User>(resolve => setTimeout(() => resolve({ name: 'Ada Lovelace' }), 1000)))
  return <Profile userPromise={promise} />
}
