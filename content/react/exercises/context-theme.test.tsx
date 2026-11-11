import { test, expect, render, screen, click } from './testing'
import { ThemeProvider, ThemeToggle, ThemedPanel, useTheme } from './App'

test('starts light', async () => {
  await render(<ThemeProvider><ThemedPanel /></ThemeProvider>)
  expect(screen.getByText('Current theme: light')).toHaveAttribute('data-theme', 'light')
})

test('toggling updates every consumer', async () => {
  await render(<ThemeProvider><ThemeToggle /><ThemedPanel /></ThemeProvider>)
  await click(screen.getByRole('button', { name: 'Switch to dark theme' }))
  expect(screen.getByText('Current theme: dark')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument()
})

function Probe() {
  try {
    useTheme()
    return <p>no error</p>
  } catch (error) {
    return <p>{(error as Error).message}</p>
  }
}

test('useTheme throws outside the provider', async () => {
  await render(<Probe />)
  expect(screen.getByText(/ThemeProvider/)).toBeInTheDocument()
})
