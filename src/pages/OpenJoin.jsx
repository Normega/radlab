import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { OPEN_JOIN_CONTENT } from './openJoinContent'

// ── OpenJoin ─────────────────────────────────────────────────────────────────
// The public landing page behind a study's QR code / ad link: /join/:slug.
// Describes the study, then hands off to the open-join Edge Function, which
// creates an anonymous enrollment and returns a session token; SessionEntry
// (/s/:token) runs the screener there and asks for an email only after a pass.
// Nothing identifying is collected on this page.
//
// ?src=<channel> (poster, instagram, …) is passed through and stored on the
// enrollment so recruitment channels can be compared.

const DEVICE_KEY = 'radlab_open_join_device'

// One screening per device (see open-join). The id lives in localStorage; if
// storage is unavailable the attempt still proceeds, just without the check.
function deviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(DEVICE_KEY, id)
    }
    return id
  } catch {
    return null
  }
}

export default function OpenJoin() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const content = OPEN_JOIN_CONTENT[slug?.toLowerCase()]
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [screenedOut, setScreenedOut] = useState(false)

  async function start() {
    setBusy(true)
    setError(null)
    const src = new URLSearchParams(window.location.search).get('src')
    try {
      const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/open-join`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
        body:    JSON.stringify({ action: 'start', slug, src, device_id: deviceId() }),
      })
      const data = await r.json()
      if (data.token) {
        navigate(`/s/${data.token}`)
        return
      }
      if (data.status === 'screened_out') {
        setScreenedOut(true)
      } else {
        setError(data.error ?? 'Something went wrong. Please try again.')
      }
    } catch {
      setError('A network error occurred. Please check your connection and try again.')
    }
    setBusy(false)
  }

  if (!content) {
    return (
      <div style={S.page}>
        <div style={S.card}>
          <p style={S.body}>This link doesn’t match a study that is currently recruiting.</p>
        </div>
      </div>
    )
  }

  if (screenedOut) {
    return (
      <div style={S.page}>
        <div style={S.card}>
          <h1 style={S.title}>Thank you for your interest</h1>
          <p style={S.body}>
            Based on your answers to the eligibility questions, you won’t be able to take part in this study.
            If you have questions, please contact <a href={`mailto:${content.contact}`} style={S.link}>{content.contact}</a>.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <p style={S.eyebrow}>{content.eyebrow}</p>
        <h1 style={S.title}>{content.title}</h1>
        <p style={S.lead}>{content.lead}</p>

        {content.sections.map((sec) => (
          <div key={sec.heading} style={S.section}>
            <h2 style={S.h2}>{sec.heading}</h2>
            <ul style={S.ul}>
              {sec.points.map((p, i) => <li key={i} style={S.li}>{p}</li>)}
            </ul>
          </div>
        ))}

        <button style={S.btn} onClick={start} disabled={busy}>
          {busy ? 'Starting…' : 'Check if I’m eligible'}
        </button>
        {error && <p style={S.error}>{error}</p>}

        <p style={S.contact}>
          Questions? Contact {content.contactName} at <a href={`mailto:${content.contact}`} style={S.link}>{content.contact}</a>.
        </p>
      </div>
    </div>
  )
}

const FONT = '"DM Sans",system-ui,sans-serif'
const S = {
  page:    { minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', background: 'var(--bg)', padding: '32px 16px' },
  card:    { maxWidth: 640, width: '100%', padding: '36px 28px', background: '#fff', border: '1px solid var(--bd)', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.06)', boxSizing: 'border-box' },
  eyebrow: { fontFamily: FONT, fontSize: 13, color: 'var(--tx3)', margin: '0 0 8px', letterSpacing: '0.02em' },
  title:   { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 30, lineHeight: 1.2, color: 'var(--tx)', margin: '0 0 14px', fontWeight: 400 },
  lead:    { fontFamily: FONT, fontSize: 16, color: 'var(--tx)', lineHeight: 1.6, margin: '0 0 22px' },
  section: { margin: '0 0 18px' },
  h2:      { fontFamily: FONT, fontSize: 15, fontWeight: 700, color: 'var(--tx)', margin: '0 0 6px' },
  ul:      { margin: 0, paddingLeft: 20 },
  li:      { fontFamily: FONT, fontSize: 15, color: 'var(--tx)', lineHeight: 1.6, margin: '0 0 6px' },
  body:    { fontFamily: FONT, fontSize: 15, color: 'var(--tx)', lineHeight: 1.6, margin: 0 },
  btn:     { marginTop: 10, padding: '13px 26px', borderRadius: 8, border: '1px solid var(--pk)', background: 'var(--pk)', color: '#fff', fontSize: 16, fontWeight: 600, fontFamily: FONT, cursor: 'pointer' },
  error:   { fontFamily: FONT, fontSize: 14, color: '#b91c1c', margin: '12px 0 0', lineHeight: 1.5 },
  contact: { fontFamily: FONT, fontSize: 14, color: 'var(--tx3)', margin: '22px 0 0', lineHeight: 1.5 },
  link:    { color: 'var(--pk)' },
}
