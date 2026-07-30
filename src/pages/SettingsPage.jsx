import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Nav from '../components/Nav'

// ── SettingsPage (/settings) ──────────────────────────────────────────────
// Account mechanics: how often the Ripple prompts you, whether it emails, and
// the two destructive-ish account actions. Created 2026-07-30 in Norm's
// account-menu IA rework.
//
// The prompt/reminder controls moved here verbatim from the old /profile.
// The Dashboard's separate `// Reminders` block (profiles.reminder_frequency,
// none/weekly/biweekly/monthly) was NOT migrated — it was deleted. Nothing has
// ever read that column: the live reminder engine is the `ripple_reminder`
// Edge Function, which reads ripples.reminder_enabled / reminder_time. Anyone
// who set "Weekly" there had been getting nothing since it shipped.

const CADENCES = [
  { key: 'every_login', label: 'Every login' },
  { key: 'daily',       label: 'Once daily' },
  { key: 'weekly',      label: 'Weekly' },
  { key: 'never',       label: 'Never' },
]

const TIMES = [
  { key: 'morning', label: 'Morning', sub: '8 AM' },
  { key: 'midday',  label: 'Midday',  sub: '12 PM' },
  { key: 'evening', label: 'Evening', sub: '7 PM' },
]

export default function SettingsPage({ session }) {
  const userId = session?.user?.id
  const email  = session?.user?.email

  const [ripple,    setRipple]    = useState(null)
  const [role,      setRole]      = useState(null)
  const [saveError, setSaveError] = useState(null)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    Promise.all([
      supabase.from('ripples')
        .select('check_in_enabled, prompt_cadence, reminder_enabled, reminder_time')
        .eq('user_id', userId).maybeSingle(),
      supabase.from('profiles').select('role, super_admin').eq('id', userId).maybeSingle(),
    ]).then(([{ data: r }, { data: p }]) => {
      if (cancelled) return
      setRipple(r ?? {})
      setRole(p ?? {})
    })
    return () => { cancelled = true }
  }, [userId])

  // UPSERT, not update — a plain .update().eq('user_id', …) matches zero rows
  // for anyone without a `ripples` row and reports success anyway (180 of 186
  // profiles had no row when this was found, 2026-07-30).
  async function patchRipple(patch) {
    const { error } = await supabase.from('ripples')
      .upsert({ user_id: userId, ...patch }, { onConflict: 'user_id' })
    if (error) {
      console.error('ripples upsert:', error)
      setSaveError('Could not save that — please try again.')
      return
    }
    setSaveError(null)
    setRipple(r => ({ ...r, ...patch }))
  }

  const enabled      = ripple?.check_in_enabled !== false
  const cadence      = ripple?.prompt_cadence ?? 'daily'
  const reminderOn   = ripple?.reminder_enabled === true
  const reminderTime = ripple?.reminder_time ?? 'morning'

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Nav session={session} />
      <div style={S.wrap}>

        <p style={S.eyebrow}>Settings</p>
        <h1 style={S.title}>Settings</h1>

        {/* ── Check-ins ─────────────────────────────────────────── */}
        <p style={S.secLabel}>// Check-ins</p>
        <div style={S.card}>
          <ToggleRow
            title="Daily check-in"
            desc={enabled
              ? 'Active — your streak and history are tracking.'
              : 'Paused — your data is safe and your streak is saved.'}
            on={enabled}
            disabled={!ripple}
            onToggle={() => patchRipple({ check_in_enabled: !enabled })}
          />

          {ripple && enabled && (
            <div style={S.subSection}>
              <p style={S.subLabel}>Prompt frequency</p>
              <ChipRow
                options={CADENCES}
                value={cadence}
                onChange={key => patchRipple({ prompt_cadence: key })}
              />
            </div>
          )}
        </div>

        {/* ── Email reminders ───────────────────────────────────── */}
        <p style={{ ...S.secLabel, marginTop: 40 }}>// Email reminders</p>
        <div style={S.card}>
          {enabled && cadence !== 'never' ? (
            <>
              <ToggleRow
                title="Reminder emails"
                desc={reminderOn ? 'Sending at your chosen time.' : 'Off — no reminder emails.'}
                on={reminderOn}
                disabled={!ripple}
                onToggle={() => patchRipple({ reminder_enabled: !reminderOn })}
              />
              {reminderOn && (
                <div style={S.subSection}>
                  <p style={S.subLabel}>Time of day (Toronto)</p>
                  <ChipRow
                    options={TIMES}
                    value={reminderTime}
                    onChange={key => patchRipple({ reminder_time: key })}
                  />
                </div>
              )}
            </>
          ) : (
            <p style={S.mutedNote}>
              {enabled
                ? 'Prompt frequency is set to Never, so no reminders are sent.'
                : 'Check-ins are paused, so no reminders are sent.'}
            </p>
          )}

          {/* A write that fails must say so — these controls spent their whole
              life reporting success they never had. */}
          {saveError && <p style={S.error}>{saveError}</p>}
        </div>

        {/* ── Password ──────────────────────────────────────────── */}
        <p style={{ ...S.secLabel, marginTop: 40 }}>// Password</p>
        <ChangePassword email={email} />

        {/* ── Danger zone ───────────────────────────────────────── */}
        <p style={{ ...S.secLabel, marginTop: 40 }}>// Danger zone</p>
        <DeleteAccount email={email} role={role} />

      </div>
    </div>
  )
}

// ── SHARED CONTROLS ───────────────────────────────────────────────────────

function ToggleRow({ title, desc, on, disabled, onToggle }) {
  return (
    <div style={S.toggleRow}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={S.toggleTitle}>{title}</p>
        <p style={S.toggleDesc}>{desc}</p>
      </div>
      <button
        onClick={disabled ? undefined : onToggle}
        disabled={disabled}
        role="switch"
        aria-checked={on}
        aria-label={title}
        style={{ ...S.toggle, background: on ? 'var(--pk)' : 'var(--bds)' }}
      >
        <span style={{ ...S.toggleKnob, transform: on ? 'translateX(20px)' : 'translateX(2px)' }} />
      </button>
    </div>
  )
}

function ChipRow({ options, value, onChange }) {
  return (
    <div style={S.chipRow}>
      {options.map(({ key, label, sub }) => {
        const active = value === key
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            aria-pressed={active}
            style={{
              ...S.chip,
              background: active ? 'var(--pk)' : 'var(--bgp)',
              color:      active ? '#fff'      : 'var(--tx2)',
              borderColor: active ? 'var(--pk)' : 'var(--bd)',
            }}
          >
            <span>{label}</span>
            {sub && <span style={{ fontSize: 12, opacity: 0.75 }}>{sub}</span>}
          </button>
        )
      })}
    </div>
  )
}

// ── CHANGE PASSWORD ───────────────────────────────────────────────────────
// Supabase's updateUser({ password }) does NOT require the old password, so a
// hijacked session could lock the real owner out. We re-authenticate with the
// current password first and refuse if it doesn't match.

function ChangePassword({ email }) {
  const [current, setCurrent] = useState('')
  const [next,    setNext]    = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy,    setBusy]    = useState(false)
  const [error,   setError]   = useState(null)
  const [done,    setDone]    = useState(false)

  const tooShort = next.length > 0 && next.length < 8
  const mismatch = confirm.length > 0 && next !== confirm
  const ready    = current && next.length >= 8 && next === confirm && !busy

  async function submit(e) {
    e.preventDefault()
    if (!ready) return
    setBusy(true); setError(null)

    // Re-auth. Wrong password → the same generic message either way.
    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password: current })
    if (authErr) {
      setError('That current password is not right.')
      setBusy(false)
      return
    }

    const { error: updErr } = await supabase.auth.updateUser({ password: next })
    setBusy(false)
    if (updErr) { setError(updErr.message); return }

    setDone(true)
    setCurrent(''); setNext(''); setConfirm('')
  }

  if (done) {
    return (
      <div style={S.card}>
        <p style={S.successNote}>Password changed. Your other devices will need the new one.</p>
        <button onClick={() => setDone(false)} style={S.btnGhost}>Change it again</button>
      </div>
    )
  }

  return (
    <form style={S.card} onSubmit={submit}>
      <Field label="Current password" type="password" value={current} onChange={setCurrent} autoComplete="current-password" />
      <Field label="New password"     type="password" value={next}    onChange={setNext}    autoComplete="new-password"
             hint={tooShort ? 'At least 8 characters.' : null} />
      <Field label="Confirm new password" type="password" value={confirm} onChange={setConfirm} autoComplete="new-password"
             hint={mismatch ? "These don't match." : null} />
      {error && <p style={S.error}>{error}</p>}
      <button type="submit" disabled={!ready} style={{ ...S.btnPrimary, ...(ready ? {} : S.btnDisabled) }}>
        {busy ? 'Saving…' : 'Change password'}
      </button>
    </form>
  )
}

function Field({ label, type, value, onChange, hint, autoComplete }) {
  return (
    <label style={S.field}>
      <span style={S.fieldLabel}>{label}</span>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={e => onChange(e.target.value)}
        style={S.input}
      />
      {hint && <span style={S.fieldHint}>{hint}</span>}
    </label>
  )
}

// ── DELETE ACCOUNT ────────────────────────────────────────────────────────
// Calls delete_own_account() (migration 20260730_delete_own_account.sql):
// SECURITY DEFINER, keyed on auth.uid(), no target argument, public tier only.
// Participants and lab members are refused server-side; we also hide the
// control for them rather than let them find out by pressing it.

function DeleteAccount({ email, role }) {
  const navigate = useNavigate()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy,  setBusy]  = useState(false)
  const [error, setError] = useState(null)

  const isPublic = role?.role === 'public' && role?.super_admin !== true

  if (role === null) return <div style={S.card}><p style={S.mutedNote}>…</p></div>

  if (!isPublic) {
    return (
      <div style={S.card}>
        <p style={S.dangerTitle}>Delete account</p>
        <p style={S.toggleDesc}>
          {role?.super_admin || role?.role === 'lab'
            ? 'Lab accounts own study material and questionnaires, so they are removed by hand. Ask a super admin.'
            : 'Your account is linked to a research study. Contact the lab to withdraw — deleting it here would remove data a study depends on.'}
        </p>
      </div>
    )
  }

  async function reallyDelete() {
    setBusy(true); setError(null)
    const { error: rpcErr } = await supabase.rpc('delete_own_account')
    if (rpcErr) {
      setError(rpcErr.message || 'Could not delete the account.')
      setBusy(false)
      return
    }
    // The auth user is gone; the local session is now a dead token.
    await supabase.auth.signOut()
    navigate('/', { replace: true })
  }

  return (
    <div style={{ ...S.card, ...S.dangerCard }}>
      <p style={S.dangerTitle}>Delete account</p>
      <p style={S.toggleDesc}>
        This removes your profile, your Ripple, every check-in, and all of your
        game data. It cannot be undone and we cannot restore it for you.
      </p>

      {!confirmOpen ? (
        <button onClick={() => setConfirmOpen(true)} style={S.btnDanger}>Delete my account</button>
      ) : (
        <div style={S.confirmBox}>
          <p style={S.confirmPrompt}>
            Type <strong style={{ fontFamily: MONO }}>{email}</strong> to confirm.
          </p>
          <input
            value={typed}
            onChange={e => setTyped(e.target.value)}
            autoComplete="off"
            aria-label="Type your email to confirm deletion"
            style={S.input}
          />
          {error && <p style={S.error}>{error}</p>}
          <div style={S.confirmActions}>
            <button
              onClick={reallyDelete}
              disabled={typed !== email || busy}
              style={{ ...S.btnDanger, ...(typed !== email || busy ? S.btnDisabled : {}) }}
            >
              {busy ? 'Deleting…' : 'Permanently delete'}
            </button>
            <button onClick={() => { setConfirmOpen(false); setTyped(''); setError(null) }} style={S.btnGhost}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── STYLES ────────────────────────────────────────────────────────────────

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'
const SANS  = '"DM Sans", system-ui, sans-serif'

const S = {
  wrap:    { maxWidth: 720, margin: '0 auto', padding: '40px 24px 72px' },
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)', marginBottom: 8 },
  title:   { fontFamily: SERIF, fontSize: 'clamp(28px, 4vw, 36px)', color: 'var(--tx)', letterSpacing: -0.5, marginBottom: 28 },

  secLabel: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--gy)', marginBottom: 14 },
  card: {
    background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12,
    padding: 24, display: 'flex', flexDirection: 'column', gap: 14,
  },

  toggleRow:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 },
  toggleTitle: { fontFamily: SANS, fontWeight: 600, fontSize: 16, color: 'var(--tx)', margin: 0 },
  toggleDesc:  { fontFamily: SANS, fontSize: 14, color: 'var(--tx2)', margin: '3px 0 0', lineHeight: 1.5 },
  toggle: {
    width: 44, height: 24, borderRadius: 12, border: 'none', flexShrink: 0,
    cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center',
    transition: 'background 0.2s',
  },
  toggleKnob: {
    width: 20, height: 20, borderRadius: '50%', background: '#fff',
    transition: 'transform 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
  },

  subSection: { paddingTop: 14, borderTop: '1px solid var(--bd)' },
  subLabel:   { fontFamily: MONO, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gy)', margin: '0 0 10px' },
  chipRow:    { display: 'flex', gap: 6, flexWrap: 'wrap' },
  chip: {
    fontFamily: MONO, fontSize: 12, padding: '7px 14px', borderRadius: 12,
    borderWidth: 1.5, borderStyle: 'solid', cursor: 'pointer',
    transition: 'all 0.15s', display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 1,
  },

  field:      { display: 'flex', flexDirection: 'column', gap: 6 },
  fieldLabel: { fontFamily: MONO, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gy)' },
  fieldHint:  { fontFamily: SANS, fontSize: 13, color: 'var(--err-tx)' },
  input: {
    fontFamily: SANS, fontSize: 16, padding: '10px 12px', minHeight: 40,
    borderRadius: 8, border: '1px solid var(--bds)',
    background: 'var(--bgc)', color: 'var(--tx)', width: '100%',
  },

  btnPrimary: {
    alignSelf: 'flex-start', fontFamily: SANS, fontWeight: 600, fontSize: 16,
    padding: '10px 16px', borderRadius: 24, border: 'none',
    background: 'var(--pk)', color: '#fff', cursor: 'pointer',
  },
  btnDanger: {
    alignSelf: 'flex-start', fontFamily: SANS, fontWeight: 600, fontSize: 16,
    padding: '10px 16px', borderRadius: 24, border: '1px solid var(--err-bd)',
    background: 'var(--err-bg)', color: 'var(--err-tx)', cursor: 'pointer',
  },
  btnGhost: {
    alignSelf: 'flex-start', fontFamily: SANS, fontWeight: 600, fontSize: 14,
    background: 'none', border: 'none', color: 'var(--tx2)', cursor: 'pointer', padding: '10px 4px',
  },
  btnDisabled: { background: 'var(--gy)', color: '#fff', borderColor: 'var(--gy)', cursor: 'default' },

  dangerCard:  { borderColor: 'var(--err-bd)' },
  dangerTitle: { fontFamily: SANS, fontWeight: 600, fontSize: 16, color: 'var(--err-tx)', margin: 0 },
  confirmBox:  { display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 14, borderTop: '1px solid var(--err-bd)' },
  confirmPrompt: { fontFamily: SANS, fontSize: 14, color: 'var(--tx)', margin: 0 },
  confirmActions: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },

  mutedNote:   { fontFamily: SANS, fontSize: 14, color: 'var(--tx2)', margin: 0 },
  successNote: { fontFamily: SANS, fontSize: 14, color: 'var(--tx)', margin: 0 },
  error:       { fontFamily: SANS, fontSize: 13, color: 'var(--err-tx)', margin: 0 },
}
