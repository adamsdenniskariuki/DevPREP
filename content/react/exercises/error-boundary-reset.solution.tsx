import { Component, useState, type ReactNode } from 'react'

type Props = { children: ReactNode; onError?: (error: Error) => void }
type State = { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error)
  }

  reset = () => this.setState({ error: null })

  render() {
    if (this.state.error) {
      return (
        <div role="alert">
          <p>Something went wrong: {this.state.error.message}</p>
          <button onClick={this.reset}>Try again</button>
        </div>
      )
    }
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
