import { useState, type FormEvent } from 'react'

type Values = { email: string; password: string }

export function SignupForm({ onSubmit }: { onSubmit: (values: Values) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<string[]>([])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const found: string[] = []
    if (!email.includes('@')) found.push('Enter a valid email address.')
    if (password.length < 8) found.push('Password must be at least 8 characters.')
    setErrors(found)
    if (found.length === 0) onSubmit({ email, password })
  }

  return (
    <form aria-label="Sign up" onSubmit={handleSubmit} noValidate>
      <label htmlFor="signup-email">Email</label>
      <input id="signup-email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
      <label htmlFor="signup-password">Password</label>
      <input id="signup-password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
      {errors.map(error => <p key={error} role="alert">{error}</p>)}
      <button type="submit">Sign up</button>
    </form>
  )
}

export default function App() {
  return <SignupForm onSubmit={values => console.log('submitted', values.email)} />
}
