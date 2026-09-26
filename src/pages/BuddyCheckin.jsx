import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSubmitLock } from '../lib/useSubmitLock'
import PrimaryCTA from '../components/ui/PrimaryCTA'
import SecondaryCTA from '../components/ui/SecondaryCTA'
import FillableBox from '../components/ui/FillableBox'

// Accountability Buddy check-in — /buddy/:token, reached only from the daily
// email (website.md "Accountability Buddy"). No auth, no layout, not linked.
//
// SAFE LINKS: UofT mail opens every emailed URL in a JS-running browser before
// the student does. So the load path calls buddy_checkin_get, which is
// read-only by construction; the ONLY write is buddy_checkin_submit, fired by
// the explicit "Check in" press. Nothing else on this page may write.

const TZ = 'America/Toronto'
const GOAL_MAX = 500

const ASKED = { yesterday: 'Yesterday', friday: 'On Friday', last_time: 'Last time' }

function fmtDate(d) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })
    .format(new Date(`${d}T12:00:00Z`))
}

function fmtMeeting(iso) {
  const d = new Date(iso)
  const day = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' })
    .format(d).replace(',', '')
  const time = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' })
    .format(d).replace(' AM', ' am').replace(' PM', ' pm')
  return `${day}, ${time}`
}

export default function BuddyCheckin() {
  const { token } = useParams()
  const [data, setData] = useState(null)       // buddy_checkin_get result
  const [loadError, setLoadError] = useState(false)
  const [done, setDone] = useState(null)       // true | false | null
  const [goal, setGoal] = useState('')
  const [result, setResult] = useState(null)   // { goal_text, done } after submit
  const [message, setMessage] = useState(null)
  const { submit, busy } = useSubmitLock(token)

  useEffect(() => {
    let live = true
    supabase.rpc('buddy_checkin_get', { p_token: token }).then(({ data: d, error }) => {
      if (!live) return
      if (error || !d) setLoadError(true)
      else setData(d)
    })
    return () => { live = false }
  }, [token])

  const open = data?.open_goal ?? null
  const canSubmit = goal.trim().length > 0 && (!open || done !== null) && !busy

  async function onCheckIn() {
    setMessage(null)
    await submit(async () => {
      const { data: r, error } = await supabase.rpc('buddy_checkin_submit', {
        p_token: token, p_done: open ? done : null, p_goal: goal,
      })
      if (error || !r) {
        setMessage('That didn’t go through. Check your connection and try again.')
        throw error ?? new Error('no response')   // releases the lock for a retry
      }
      if (r.state === 'ok') { setResult(r); return }
      if (r.state === 'already_checked_in') {
        setData(prev => ({ ...prev, today_goal: { goal_text: r.goal_text } }))
        return
      }
      if (r.state === 'replaced' || r.state === 'not_found') { setData({ state: r.state }); return }
      setMessage(
        r.state === 'outcome_required' ? 'Pick Yes or No for your last goal first.'
        : r.state === 'goal_too_long' ? `Keep it under ${GOAL_MAX} characters.`
        : 'Add one goal for today first.')
      throw new Error(r.state)
    })
  }

  let body
  if (loadError) {
    body = <Notice title="Something went wrong">We couldn’t load your check-in. Try the link again in a minute.</Notice>
  } else if (!data) {
    body = <p style={S.muted}>Loading…</p>
  } else if (data.state === 'replaced') {
    body = <Notice title="This link has been replaced">Please use the link in your latest email.</Notice>
  } else if (data.state !== 'ok') {
    body = <Notice title="Link not found">Please use the link in your latest email.</Notice>
  } else if (result) {
    body = (
      <>
        <h1 style={S.h1}>You’re checked in.</h1>
        {result.done === true && <p style={S.body}>Nice, that’s a win.</p>}
        {result.done === false && <p style={S.body}>Noted. Today’s a fresh start.</p>}
        <p style={S.label}>Today’s goal</p>
        <p style={S.goal}>{result.goal_text}</p>
      </>
    )
  } else if (data.today_goal) {
    body = (
      <>
        <h1 style={S.h1}>Morning, {data.first_name}.</h1>
        <p style={S.body}>You’ve already checked in today.</p>
        <p style={S.label}>Today’s goal</p>
        <p style={S.goal}>{data.today_goal.goal_text}</p>
      </>
    )
  } else {
    body = (
      <>
        <h1 style={S.h1}>Morning, {data.first_name}.</h1>

        {open && (
          <section style={S.section}>
            <p style={S.body}>{ASKED[open.asked_as] ?? 'Last time'} you planned:</p>
            <p style={S.goal}>{open.goal_text}</p>
            <p style={S.body}>Did you do it?</p>
            <div style={S.pair} role="group" aria-label="Did you do it?">
              {[true, false].map(v => {
                const Btn = done === v ? PrimaryCTA : SecondaryCTA
                return (
                  <Btn key={String(v)} onClick={() => setDone(v)} aria-pressed={done === v} style={S.pairBtn}>
                    {v ? 'Yes' : 'No'}
                  </Btn>
                )
              })}
            </div>
          </section>
        )}

        <section style={S.section}>
          <p style={S.body}>What’s one thing you’ll do today toward your PhD?</p>
          <FillableBox
            label="Today’s goal"
            description="Small and specific beats big and vague."
            value={goal}
            maxLength={GOAL_MAX}
            onChange={e => setGoal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && canSubmit) onCheckIn() }}
            autoComplete="off"
          />
        </section>

        <PrimaryCTA onClick={onCheckIn} disabled={!canSubmit} style={S.submit}>
          {busy ? 'Checking in…' : 'Check in'}
        </PrimaryCTA>
        {message && <p style={S.error}>{message}</p>}
      </>
    )
  }

  return (
    <div style={S.page}>
      <main style={S.card}>
        {body}
        {data?.state === 'ok' && <Context data={data} />}
      </main>
    </div>
  )
}

function Notice({ title, children }) {
  return (
    <>
      <h1 style={S.h1}>{title}</h1>
      <p style={S.body}>{children}</p>
    </>
  )
}

// Always visible below the form: milestones, and the next meeting.
function Context({ data }) {
  const ms = data.milestones ?? []
  return (
    <div style={S.context}>
      {ms.length > 0 && (
        <>
          <p style={S.label}>Milestones</p>
          <ol style={S.list}>
            {ms.map((m, i) => (
              <li key={i} style={{ ...S.ms, ...(m.current ? S.msCurrent : null), ...(m.done ? S.msDone : null) }}>
                <span aria-hidden="true" style={S.tick}>{m.done ? '✓' : m.current ? '→' : ''}</span>
                <span style={S.msTitle}>{m.title}</span>
                {m.target_date && <span style={S.msDate}>{fmtDate(m.target_date)}</span>}
              </li>
            ))}
          </ol>
        </>
      )}
      {data.next_meeting_at && (
        <div style={S.meeting}>
          <p style={S.body}>Next meeting: {fmtMeeting(data.next_meeting_at)}</p>
          {data.zoom_url && (
            <a href={data.zoom_url} target="_blank" rel="noopener noreferrer" style={S.zoom}>Join Zoom</a>
          )}
        </div>
      )}
    </div>
  )
}

const S = {
  page: {
    minHeight: '100vh', background: 'var(--bg)', boxSizing: 'border-box',
    padding: '32px 16px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
    fontFamily: '"DM Sans", system-ui, sans-serif', color: 'var(--tx)',
  },
  card: {
    width: '100%', maxWidth: 560, boxSizing: 'border-box', background: 'var(--bgc)',
    borderRadius: 12, border: '1px solid var(--bd)', padding: 24,
  },
  h1: {
    fontFamily: '"DM Serif Display", Georgia, serif', fontWeight: 400,
    fontSize: 28, lineHeight: 1.25, margin: '0 0 16px',
  },
  body: { fontSize: 16, lineHeight: 1.5, margin: '0 0 8px' },
  muted: { fontSize: 16, color: 'var(--tx2)', margin: 0 },
  label: {
    fontFamily: '"Space Mono", monospace', fontSize: 12, textTransform: 'uppercase',
    color: 'var(--tx2)', margin: '16px 0 4px',
  },
  goal: {
    fontSize: 16, lineHeight: 1.5, fontStyle: 'italic', margin: '0 0 8px',
    padding: '8px 16px', background: 'var(--bgp)', borderRadius: 12,
  },
  section: { margin: '0 0 24px' },
  pair: { display: 'flex', gap: 8, marginTop: 8 },
  pairBtn: { minWidth: 96 },
  submit: { width: '100%' },
  error: { fontSize: 14, color: 'var(--err-tx)', margin: '8px 0 0' },
  context: { marginTop: 32, paddingTop: 16, borderTop: '1px solid var(--bd)' },
  list: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 },
  ms: {
    display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 14, lineHeight: 1.5,
    padding: '4px 8px', borderRadius: 12, border: '1px solid transparent',
  },
  msCurrent: { background: 'var(--bgp)', border: '1px solid var(--pkbs)', fontWeight: 600 },
  msDone: { color: 'var(--tx2)' },
  tick: { width: 16, flexShrink: 0, color: 'var(--pkd)' },
  msTitle: { flex: 1 },
  msDate: { fontFamily: '"Space Mono", monospace', fontSize: 12, color: 'var(--tx2)', whiteSpace: 'nowrap' },
  meeting: { marginTop: 24, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 },
  zoom: {
    display: 'inline-flex', alignItems: 'center', padding: '8px 16px', borderRadius: 24,
    border: '1px solid var(--tx2)', color: 'var(--tx2)', fontSize: 14, fontWeight: 600,
    textDecoration: 'none',
  },
}
