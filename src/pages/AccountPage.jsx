import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import Nav from '../components/Nav'
import SiteFooter from '../components/SiteFooter'
import EyebrowLabel from '../components/ui/EyebrowLabel'
import PrimaryCTA from '../components/ui/PrimaryCTA'
import { useDisplayName } from '../hooks/useDisplayName'

// ── AccountPage (/account) ────────────────────────────────────────────────
// Replaces the old /profile + /settings split (2026-08-13 Account/My Ripple
// redesign, Figma "Revised Account Screens"). Who you are, account mechanics,
// password, deletion — everything that isn't the Ripple itself, which stays
// on /ripple under the "avatar → ripple, everything else → account" rule.
//
// Points & Progress and the Unlock Tracker moved OUT to /ripple — they gate
// avatar customization, which makes them avatar-related under the same rule,
// not account facts. User ID was dropped from Account Details: nothing in the
// app ever asks a user to quote it, and Email already serves as the
// human-usable identifier if the lab needs to find someone's account.
//
// Check-in reminders are no longer toggle-able here at all: the on-platform
// nudge (GamesPage's CheckinReminder, Dashboard's RippleSection) is now
// unconditional — it just checks whether today's check-in happened, the same
// way GamesPage's always did. This page's "Check-in reminders" toggle
// controls EMAIL reminders only (ripples.reminder_enabled/prompt_cadence/
// reminder_time), read by the ripple_reminder Edge Function.

const EMAIL_CADENCES = [
  { key: 'daily',            label: 'Daily' },
  { key: 'every_other_day',  label: 'Every other day' },
  { key: 'weekly',           label: 'Weekly' },
  { key: 'every_other_week', label: 'Every other week' },
]

const TIMES = [
  { key: 'morning', label: 'Morning', sub: '8 AM' },
  { key: 'midday',  label: 'Midday',  sub: '12 PM' },
  { key: 'evening', label: 'Evening', sub: '7 PM' },
]

const ROLE_META = {
  lab:         { label: 'Lab Member',        bg: '#EDE9FE', color: '#6D28D9' },
  participant: { label: 'Participant',       bg: '#DBEAFE', color: '#1D4ED8' },
  public:      { label: 'Public Researcher', bg: 'var(--bgp)', color: 'var(--pkd)' },
}

export default function AccountPage({ session }) {
  const user        = session?.user
  const userId      = user?.id
  const queryClient = useQueryClient()

  const [editing,   setEditing]   = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [saving,    setSaving]    = useState(false)
  const [saveError, setSaveError] = useState(null)

  // `displayName` is what to render (with fallbacks); `storedName` is the raw
  // profiles.display_name — null until never set — which is what the rename
  // form must edit and compare against, so an unnamed account doesn't come
  // pre-filled with its own email local-part.
  const { displayName, data: storedName } = useDisplayName(user)

  const { data: profile } = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const { data } = await supabase.from('profiles')
        .select('role, super_admin').eq('id', userId).maybeSingle()
      return data
    },
    enabled: !!userId,
  })

  const [ripple,    setRipple]    = useState(null)
  const [rippleErr, setRippleErr] = useState(null)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    supabase.from('ripples')
      .select('reminder_enabled, prompt_cadence, reminder_time')
      .eq('user_id', userId).maybeSingle()
      .then(({ data }) => { if (!cancelled) setRipple(data ?? {}) })
    return () => { cancelled = true }
  }, [userId])

  // UPSERT, not update — a plain .update().eq('user_id', …) matches zero rows
  // for anyone without a `ripples` row and reports success anyway (see the
  // 2026-07-30 note this carries forward from the old SettingsPage).
  async function patchRipple(patch) {
    const { error } = await supabase.from('ripples')
      .upsert({ user_id: userId, ...patch }, { onConflict: 'user_id' })
    if (error) {
      console.error('ripples upsert:', error)
      setRippleErr('Could not save that — please try again.')
      return
    }
    setRippleErr(null)
    setRipple(r => ({ ...r, ...patch }))
  }

  const role     = profile?.role || 'public'
  const roleMeta = ROLE_META[role] || ROLE_META.public

  const reminderOn   = ripple?.reminder_enabled === true
  const cadence      = ripple?.prompt_cadence ?? 'daily'
  const reminderTime = ripple?.reminder_time ?? 'morning'

  // `profiles.display_name` is the one store anything reads (useDisplayName),
  // so this is the only write that matters — invalidating the shared key
  // updates the greeting, the Nav initial and the admin sidebar at once.
  //
  // UPDATE, not upsert: profiles has no INSERT policy for `authenticated` (the
  // row comes from the signup trigger), and .update() matching zero rows
  // reports success — so .select() is what proves it landed.
  async function saveName() {
    const name = nameInput.trim()
    if (!name || name === storedName) { setEditing(false); return }
    setSaving(true)

    const { data: rows, error: dbErr } = await supabase.from('profiles')
      .update({ display_name: name }).eq('id', userId).select('display_name')

    if (dbErr || !rows?.length) {
      console.error('profiles display_name update:', dbErr ?? 'no row matched')
      setSaveError('Could not save that — please try again.')
      setSaving(false)
      return
    }

    queryClient.invalidateQueries({ queryKey: ['display-name', userId] })

    const { error: authErr } = await supabase.auth.updateUser({ data: { display_name: name } })
    if (authErr) console.error('auth updateUser display_name seed:', authErr)

    setSaveError(null)
    setEditing(false)
    setSaving(false)
  }

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—'

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Nav session={session} />
      <div style={S.wrap}>

        <h1 style={S.title}>Account</h1>

        {/* ── Account details ───────────────────────────────────── */}
        <div style={S.secLabel}><EyebrowLabel variant="white">Account Details</EyebrowLabel></div>
        <div style={S.card}>
          <div style={{ ...S.row, borderBottom: '1px solid var(--bd)' }}>
            <span style={S.rowLabel}>Display Name</span>
            {editing ? (
              <div style={S.editRow}>
                <input
                  autoFocus
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditing(false) }}
                  style={S.nameInput}
                  maxLength={60}
                  aria-label="Your name"
                />
                <button onClick={saveName} disabled={saving} style={S.btnSmall}>{saving ? '…' : 'Save'}</button>
                <button onClick={() => setEditing(false)} style={S.btnGhost}>Cancel</button>
              </div>
            ) : (
              <div style={S.editRow}>
                <span style={S.rowVal}>{displayName}</span>
                <PrimaryCTA
                  onClick={() => { setNameInput(storedName ?? displayName); setEditing(true); setSaveError(null) }}
                  style={S.btnRename}
                >
                  Rename
                </PrimaryCTA>
              </div>
            )}
          </div>
          <Row label="Email"        val={user?.email} />
          <Row label="Account type" val={roleMeta.label} />
          <Row label="Member since" val={memberSince} last />
          {saveError && <p style={S.error}>{saveError}</p>}
        </div>

        {/* ── Notifications ──────────────────────────────────────── */}
        <div style={{ ...S.secLabel, marginTop: 40 }}><EyebrowLabel variant="white">Notifications</EyebrowLabel></div>
        <div style={S.card}>
          <ToggleRow
            title="Check-in reminders"
            desc={reminderOn ? 'Sending at your chosen time.' : 'Off — no reminder emails.'}
            on={reminderOn}
            disabled={!ripple}
            // Enabling also normalizes a legacy cadence ('never'/'every_login',
            // retired 2026-08-13) to 'daily' — otherwise the toggle flips on
            // with no chip selected, and a stored 'never' means the send engine
            // skips the user even though the UI says reminders are on.
            onToggle={() => patchRipple(reminderOn
              ? { reminder_enabled: false }
              : {
                  reminder_enabled: true,
                  ...(EMAIL_CADENCES.some(c => c.key === cadence) ? {} : { prompt_cadence: 'daily' }),
                })}
          />
          {reminderOn && (
            <div style={S.subSection}>
              <p style={S.subLabel}>Email frequency</p>
              <ChipRow
                options={EMAIL_CADENCES}
                value={cadence}
                onChange={key => patchRipple({ prompt_cadence: key })}
              />
              <p style={{ ...S.subLabel, marginTop: 14 }}>Time of day (Toronto)</p>
              <ChipRow
                options={TIMES}
                value={reminderTime}
                onChange={key => patchRipple({ reminder_time: key })}
              />
            </div>
          )}
          {rippleErr && <p style={S.error}>{rippleErr}</p>}
        </div>

        {/* ── Password ──────────────────────────────────────────── */}
        <div style={{ ...S.secLabel, marginTop: 40 }}><EyebrowLabel variant="white">Change Password</EyebrowLabel></div>
        <ChangePassword email={user?.email} />

        {/* ── Danger zone ───────────────────────────────────────── */}
        <div style={{ ...S.secLabel, marginTop: 40 }}><EyebrowLabel variant="white">Delete Account</EyebrowLabel></div>
        <DeleteAccount email={user?.email} role={profile} />

      </div>

      <SiteFooter session={session} />
    </div>
  )
}

function Row({ label, val, mono = false, last = false }) {
  return (
    <div style={{ ...S.row, borderBottom: last ? 'none' : '1px solid var(--bd)' }}>
      <span style={S.rowLabel}>{label}</span>
      <span style={{ ...S.rowVal, ...(mono ? { fontFamily: MONO } : {}) }}>{val ?? '—'}</span>
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
// control for them rather than let them find out by pressing it. Confirmation
// is typing your own email, not a generic "Are you sure?" — kept deliberately
// stronger than the Figma note during the 2026-08-13 review.

function DeleteAccount({ email, role }) {
  const navigate = useNavigate()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy,  setBusy]  = useState(false)
  const [error, setError] = useState(null)

  const isPublic = role?.role === 'public' && role?.super_admin !== true

  if (role === undefined || role === null) return <div style={S.card}><p style={S.mutedNote}>…</p></div>

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
  wrap:  { maxWidth: 720, margin: '0 auto', padding: '40px 24px 72px' },
  title: { fontFamily: SERIF, fontSize: 'clamp(28px, 4vw, 36px)', color: 'var(--tx)', letterSpacing: -0.5, marginBottom: 28 },

  secLabel: { marginBottom: 14 },
  card: {
    background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12,
    padding: 24, display: 'flex', flexDirection: 'column', gap: 14,
  },

  row:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '12px 0' },
  rowLabel: { fontFamily: MONO, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gy)' },
  rowVal:   { fontFamily: SANS, fontSize: 14, color: 'var(--tx)', textAlign: 'right', wordBreak: 'break-word' },
  editRow:  { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' },

  nameInput: {
    fontFamily: SANS, fontSize: 16, padding: '8px 12px', minWidth: 0, width: 180,
    borderRadius: 8, border: '1px solid var(--bds)', background: 'var(--bgc)', color: 'var(--tx)',
  },
  btnSmall: {
    fontFamily: SANS, fontWeight: 600, fontSize: 14, padding: '8px 14px', borderRadius: 24,
    background: 'var(--pk)', color: '#fff', border: 'none', cursor: 'pointer',
  },
  // Formal button, not a bare text link (policy, 2026-08-13): every option in
  // a choice pair is a real button — the non-suggested one is just grayer.
  btnGhost: {
    alignSelf: 'flex-start', fontFamily: SANS, fontWeight: 600, fontSize: 14,
    background: 'var(--bgc)', border: '1px solid var(--bds)', borderRadius: 24,
    color: 'var(--tx2)', cursor: 'pointer', padding: '8px 14px',
  },
  btnRename: { padding: '6px 14px', fontSize: 13, borderRadius: 20 },

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
