import { test, expect, render, screen, click, type, fn, waitFor } from './testing'
import { NewsletterForm } from './App'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

test('subscribes and confirms', async () => {
  const subscribe = fn(() => Promise.resolve())
  await render(<NewsletterForm subscribe={subscribe} />)
  await type(screen.getByLabelText('Email'), 'ada@example.com')
  await click(screen.getByRole('button', { name: 'Subscribe' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Subscribed ada@example.com')
  expect(subscribe).toHaveBeenCalledWith('ada@example.com')
})

test('disables the button while pending', async () => {
  const request = deferred<void>()
  await render(<NewsletterForm subscribe={() => request.promise} />)
  await type(screen.getByLabelText('Email'), 'ada@example.com')
  await click(screen.getByRole('button', { name: 'Subscribe' }))
  await waitFor(() => expect(screen.getByRole('button')).toBeDisabled())
  expect(screen.getByRole('button')).toHaveTextContent('Subscribing…')
  request.resolve()
  await waitFor(() => expect(screen.getByRole('button')).not.toBeDisabled())
})

test('shows the error message', async () => {
  await render(<NewsletterForm subscribe={() => Promise.reject(new Error('Already subscribed'))} />)
  await type(screen.getByLabelText('Email'), 'ada@example.com')
  await click(screen.getByRole('button', { name: 'Subscribe' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Already subscribed')
})
