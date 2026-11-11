import { useActionState } from 'react'

type NewsletterProps = { subscribe: (email: string) => Promise<void> }
type Result = { ok: true; email: string } | { ok: false; error: string } | null

export function NewsletterForm({ subscribe }: NewsletterProps) {
  const [result, formAction, isPending] = useActionState<Result, FormData>(async (_previous, formData) => {
    const email = String(formData.get('email') ?? '')
    try {
      await subscribe(email)
      return { ok: true, email }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Something went wrong.' }
    }
  }, null)

  return (
    <form aria-label="Newsletter" action={formAction}>
      <label htmlFor="newsletter-email">Email</label>
      <input id="newsletter-email" name="email" type="email" />
      <button type="submit" disabled={isPending}>{isPending ? 'Subscribing…' : 'Subscribe'}</button>
      {result?.ok && <p role="status">Subscribed {result.email}</p>}
      {result && !result.ok && <p role="alert">{result.error}</p>}
    </form>
  )
}

const fakeSubscribe = (email: string) => new Promise<void>((resolve, reject) => setTimeout(() => (email.includes('@') ? resolve() : reject(new Error('That does not look like an email.'))), 800))

export default function App() {
  return <NewsletterForm subscribe={fakeSubscribe} />
}
