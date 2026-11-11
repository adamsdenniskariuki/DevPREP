import { createContext, useContext, useState, type ReactNode } from 'react'

type Theme = 'light' | 'dark'
type ThemeValue = { theme: Theme; toggle: () => void }

const ThemeContext = createContext<ThemeValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')
  const toggle = () => setTheme(current => (current === 'light' ? 'dark' : 'light'))
  return <ThemeContext value={{ theme, toggle }}>{children}</ThemeContext>
}

export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used inside ThemeProvider')
  return value
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return <button onClick={toggle}>Switch to {theme === 'light' ? 'dark' : 'light'} theme</button>
}

export function ThemedPanel() {
  const { theme } = useTheme()
  return <p data-theme={theme}>Current theme: {theme}</p>
}

export default function App() {
  return (
    <ThemeProvider>
      <ThemeToggle />
      <ThemedPanel />
    </ThemeProvider>
  )
}
