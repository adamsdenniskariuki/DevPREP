import { useState, type FormEvent } from 'react'

type NewsletterProps = { subscribe: (email: string) => Promise<void> }

// TODO: replace this with useActionState and a form action.
export function NewsletterForm({ subscribe }: NewsletterProps) {
  const [message, setMessage] = useState('')
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const email = String(new FormData(event.currentTarget).get('email'))
    try {
      await subscribe(email)
      setMessage('Subscribed ' + email)
    } catch {
      // TODO: show the error message.
    }
  }
  return (
    <form aria-label="Newsletter" onSubmit={handleSubmit}>
      <label htmlFor="newsletter-email">Email</label>
      <input id="newsletter-email" name="email" type="email" />
      <button type="submit">Subscribe</button>
      {message && <p>{message}</p>}
    </form>
  )
}

const fakeSubscribe = (email: string) => new Promise<void>((resolve, reject) => setTimeout(() => (email.includes('@') ? resolve() : reject(new Error('That does not look like an email.'))), 800))

export default function App() {
  return <NewsletterForm subscribe={fakeSubscribe} />
}
