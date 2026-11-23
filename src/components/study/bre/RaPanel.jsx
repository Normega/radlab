import { useEffect, useRef, useState } from 'react'

/**
 * The RA's controls for an in-person session (Breath Attention and Emotional Recovery plan §10).
 * Ctrl+Alt+R opens a PIN prompt; the PIN is checked by check_ra_pin() against a hash the browser
 * never sees. Once it matches, the panel shows its children (the step's RA actions) until closed.
 * Not Ctrl+Shift+R: that is Chrome's hard reload, and would restart the task.
 */
export function useRaShortcut(onTrigger) {
  const ref = useRef(onTrigger)
  useEffect(() => { ref.current = onTrigger })
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey && e.altKey && !e.shiftKey && (e.key === 'r' || e.key === 'R' || e.code === 'KeyR')) {
        e.preventDefault()
        ref.current?.()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

export default function RaPanel({ open, onClose, onUnlock, onPinFailed, studyId, db, bypass = false, title = 'Research assistant', children }) {
  const [pin, setPin] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [checking, setChecking] = useState(false)
  const [msg, setMsg] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open) { setPin(''); setMsg(''); setUnlocked(false); return }
    if (bypass) { setUnlocked(true); onUnlock?.(); return }
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null

  async function check(e) {
    e.preventDefault()
    if (checking || !pin) return
    setChecking(true); setMsg('')
    const { data, error } = await db.rpc('check_ra_pin', { p_study_id: studyId, p_pin: pin })
    setChecking(false); setPin('')
    if (!error && data === true) { setUnlocked(true); onUnlock?.() }
    else { setMsg(error ? 'Could not check the PIN. Try again.' : 'That PIN is not right.'); onPinFailed?.() }
  }

  return (
    <div style={S.backdrop} role="dialog" aria-modal="true" aria-label={title}>
      <div style={S.card}>
        <div style={S.head}>
          <span style={S.title}>{title}</span>
          <button style={S.close} onClick={onClose}>Close</button>
        </div>
        {unlocked ? children : (
          <form onSubmit={check} style={S.form}>
            <label style={S.label} htmlFor="ra-pin">RA PIN</label>
            <input id="ra-pin" ref={inputRef} type="password" inputMode="numeric" autoComplete="off"
              value={pin} onChange={e => setPin(e.target.value)} style={S.input} />
            <button type="submit" style={S.primary} disabled={checking || !pin}>{checking ? 'Checking…' : 'Unlock'}</button>
            {msg && <p style={S.msg}>{msg}</p>}
          </form>
        )}
      </div>
    </div>
  )
}

const FONT = '"DM Sans",system-ui,sans-serif'
export const RA_STYLES = {
  row:     { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  button:  { padding: '8px 16px', borderRadius: 24, border: '1px solid var(--bd)', background: '#fff', color: 'var(--tx)', fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: 'pointer' },
  primary: { padding: '8px 16px', borderRadius: 24, border: '1px solid var(--pk)', background: 'var(--pk)', color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: 'pointer' },
  note:    { fontSize: 14, color: 'var(--tx2)', margin: 0, lineHeight: 1.5, fontFamily: FONT },
  ok:      { fontSize: 14, color: 'var(--tx)', margin: 0, fontFamily: FONT },
  bad:     { fontSize: 14, color: 'var(--err-tx)', margin: 0, fontFamily: FONT },
}
const S = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 },
  card:     { background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 16, fontFamily: FONT },
  head:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title:    { fontSize: 16, fontWeight: 700, color: 'var(--tx)' },
  close:    RA_STYLES.button,
  form:     { display: 'flex', flexDirection: 'column', gap: 8 },
  label:    { fontSize: 14, color: 'var(--tx2)' },
  input:    { padding: '8px 16px', borderRadius: 12, border: '1px solid var(--bd)', fontSize: 16, fontFamily: FONT },
  primary:  RA_STYLES.primary,
  msg:      RA_STYLES.bad,
}
