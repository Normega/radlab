import { Component } from 'react'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

// Class component — React error boundaries have no hook equivalent.
// Catches render errors in its subtree so a crash there can't blank the
// entire app; everything outside this boundary keeps working.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error(`[${this.props.label ?? 'ErrorBoundary'}]`, error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={S.card}>
            <p style={S.eyebrow}>{this.props.label ?? 'RADlab'}</p>
            <h1 style={S.title}>Something went wrong</h1>
            <p style={S.sub}>This section hit an error. The rest of the site is unaffected.</p>
            <button style={S.btn} onClick={() => window.location.reload()}>Reload page</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

const S = {
  card: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 16, padding: '40px 32px', textAlign: 'center', maxWidth: 400 },
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)', marginBottom: 8 },
  title: { fontFamily: SERIF, fontSize: 24, color: 'var(--tx)', marginBottom: 8 },
  sub: { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.5, marginBottom: 20 },
  btn: { padding: '10px 24px', borderRadius: 10, border: 'none', background: 'var(--pk)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
}
