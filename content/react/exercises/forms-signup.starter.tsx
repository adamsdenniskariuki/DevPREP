import { useState, type FormEvent } from 'react'

type Values = { email: string; password: string }

export function SignupForm({ onSubmit }: { onSubmit: (values: Values) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // TODO: validate, show errors with role="alert", and only then call onSubmit.
    onSubmit({ email, password })
  }

  return (
    <form aria-label="Sign up" onSubmit={handleSubmit}>
      <label htmlFor="signup-email">Email</label>
      <input id="signup-email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
      <label htmlFor="signup-password">Password</label>
      <input id="signup-password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
      <button type="submit">Sign up</button>
    </form>
  )
}

export default function App() {
  return <SignupForm onSubmit={values => console.log('submitted', values.email)} />
}
