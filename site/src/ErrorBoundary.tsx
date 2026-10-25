import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface State {
  error: Error | null
}

/** Shows the error on screen instead of leaving a blank page. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Rashko site error:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{ minHeight: '100vh', padding: '48px 24px', background: '#0c2e20', color: '#FBF6EC', fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 32 }}>Something went wrong</h1>
        <p style={{ opacity: 0.8 }}>Please refresh the page. If it keeps happening, send this message to the developer:</p>
        <pre style={{ whiteSpace: 'pre-wrap', background: '#1a4a35', padding: 16, borderRadius: 12 }}>
          {String(this.state.error.stack || this.state.error.message)}
        </pre>
      </div>
    )
  }
}
