import { Component, useState, type ReactNode } from 'react'

type Props = { children: ReactNode; onError?: (error: Error) => void }
type State = { error: Error | null }

// TODO: catch errors, render the fallback and support "Try again".
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }
  render() {
    return this.props.children
  }
}

let failures = 1
function Flaky() {
  if (failures-- > 0) throw new Error('First render failed')
  return <p>Loaded fine.</p>
}

export default function App() {
  const [key] = useState(0)
  return <ErrorBoundary key={key}><Flaky /></ErrorBoundary>
}
