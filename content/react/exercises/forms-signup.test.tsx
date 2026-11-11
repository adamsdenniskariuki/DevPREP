import { test, expect, render, screen, click, type, fn } from './testing'
import { SignupForm } from './App'

test('shows both errors and does not submit when empty', async () => {
  const onSubmit = fn()
  await render(<SignupForm onSubmit={onSubmit} />)
  await click(screen.getByRole('button', { name: 'Sign up' }))
  expect(screen.getAllByRole('alert')).toHaveLength(2)
  expect(onSubmit).not.toHaveBeenCalled()
})

test('rejects a short password', async () => {
  const onSubmit = fn()
  await render(<SignupForm onSubmit={onSubmit} />)
  await type(screen.getByLabelText('Email'), 'ada@example.com')
  await type(screen.getByLabelText('Password'), 'short')
  await click(screen.getByRole('button', { name: 'Sign up' }))
  expect(screen.getByRole('alert')).toHaveTextContent('8 characters')
  expect(onSubmit).not.toHaveBeenCalled()
})

test('submits valid values', async () => {
  const onSubmit = fn()
  await render(<SignupForm onSubmit={onSubmit} />)
  await type(screen.getByLabelText('Email'), 'ada@example.com')
  await type(screen.getByLabelText('Password'), 'correct horse')
  await click(screen.getByRole('button', { name: 'Sign up' }))
  expect(onSubmit).toHaveBeenCalledWith({ email: 'ada@example.com', password: 'correct horse' })
  expect(screen.queryAllByRole('alert')).toHaveLength(0)
})
