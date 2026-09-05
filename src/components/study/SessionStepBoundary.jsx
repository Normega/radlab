import { Component } from 'react'

// Catches a step component throwing while it renders, inside a participant
// session (/s/:token).
//
// WHY THIS EXISTS. Until 2026-09-05 the session route had no boundary at all,
// while Ripple, Workbench and the whole academic partition each had one. A step
// that threw on mount therefore unmounted the entire tree and left the
// participant on a blank white page — no message, no reload prompt, nothing
// recorded. On 2026-08-27 twelve Sandy Study 3 sessions ended exactly that way:
// a step exits cleanly, the next never enters. Two of the affected participants
// had been working for 22 minutes.
//
// WHAT IT DELIBERATELY DOES NOT DO. It does not offer to resume. SessionEntry
// holds `currentIndex` in `useState(0)` with no persistence, so reloading
// restarts the session from step 1 — for the participant who reached step 30
// that would mean redoing everything. Telling them to reload would be telling
// them to throw their work away, so the copy says what is true instead: their
// answers are saved, and they should ask before restarting. Making reload
// actually resume is a separate change to the session runner, and a riskier one
// (naively restoring the index would re-mount the step that just crashed and
// loop) — it wants its own design pass, not a line snuck in here.
//
// The `onCrash` callback records the row. It is fired from componentDidCatch,
// which React calls after the fallback has already been committed, so a failure
// to log can never stop the message from appearing.
export default class SessionStepBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('[session step]', error, info)
    // Never let diagnostics throw over the top of the real error.
    try { this.props.onCrash?.(error) } catch (e) { console.warn('crash log failed:', e) }
  }

  // Remounts on step change (SessionEntry keys this by step index), so a
  // recovered session does not stay stuck on a previous step's error.
  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div style={S.wrap}>
        <p style={S.eyebrow}>Session</p>
        <h1 style={S.title}>This screen didn’t load</h1>
        <p style={S.body}>
          Something went wrong opening the next part of the session. <strong>Your answers so
          far have been saved</strong> — nothing you have already done is lost.
        </p>
        <p style={S.body}>
          Please message the research team before you do anything else. Reloading this page
          would start the session again from the beginning, so it is worth checking with us
          first.
        </p>
        {this.props.stepLabel && (
          <p style={S.detail}>Reference for the research team: {this.props.stepLabel}</p>
        )}
      </div>
    )
  }
}

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'
const SANS  = '"DM Sans", system-ui, sans-serif'

const S = {
  wrap: {
    maxWidth: 480, margin: '0 auto', padding: '48px 32px', textAlign: 'center',
    display: 'flex', flexDirection: 'column', gap: 16, fontFamily: SANS,
  },
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)', margin: 0 },
  title:   { fontFamily: SERIF, fontSize: 28, fontWeight: 400, color: 'var(--tx)', margin: 0 },
  body:    { fontSize: 16, lineHeight: 1.6, color: 'var(--tx2)', margin: 0 },
  detail:  { fontFamily: MONO, fontSize: 12, color: 'var(--gy)', margin: 0 },
}
