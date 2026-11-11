import { createContext, useContext, useState, type ReactNode } from 'react'

type Theme = 'light' | 'dark'
type ThemeValue = { theme: Theme; toggle: () => void }

const ThemeContext = createContext<ThemeValue>({ theme: 'light', toggle: () => {} })

// TODO: hold the theme in state and provide it.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme] = useState<Theme>('light')
  return <>{children}</>
}

// TODO: throw when used outside ThemeProvider.
export function useTheme() {
  return useContext(ThemeContext)
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
