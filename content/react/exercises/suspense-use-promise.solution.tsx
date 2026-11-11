import { Suspense, use, useState } from 'react'

export type User = { name: string }

export function UserName({ userPromise }: { userPromise: Promise<User> }) {
  const user = use(userPromise)
  return <h2>{user.name}</h2>
}

export function Profile({ userPromise }: { userPromise: Promise<User> }) {
  return (
    <section>
      <Suspense fallback={<p>Loading profile…</p>}>
        <UserName userPromise={userPromise} />
      </Suspense>
    </section>
  )
}

export default function App() {
  const [promise] = useState(() => new Promise<User>(resolve => setTimeout(() => resolve({ name: 'Ada Lovelace' }), 1000)))
  return <Profile userPromise={promise} />
}
