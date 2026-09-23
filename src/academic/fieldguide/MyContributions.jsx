import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { AcademicEyebrow } from '../AcademicChrome'
import AvatarMenu from './AvatarMenu'
import { courseFeatures } from '../courseFeatures'
import { useWikiBase, useCoursePaths } from './wiki/useWikiBase'
import { DIFF, SEV, CONTRIBUTION_SLOTS, readDraft } from './contributions'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

// "Your contributions" (Norm, 2026-09-23): every claim a student has ever
// held in the course, with its text and where it stands. The gap board's
// strip cannot be this — gap_board() drops a claim once it is withdrawn and a
// gap once it closes — so students lost sight of work that was still theirs.
//
// Everything shown is a recorded fact from my_claims(): display_state is
// derived server-side and trusted as-is, and only dates the database actually
// holds are printed. There is no recorded release date, so none is shown.

const TZ = 'America/Toronto'
const fmtDay = ts => ts
  ? new Date(ts).toLocaleDateString('en-CA', { timeZone: TZ, month: 'short', day: 'numeric' })
  : ''
const fmtDayTime = ts => ts
  ? new Date(ts).toLocaleString('en-CA', { timeZone: TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  : ''
const daysLeft = ts => ts ? Math.max(0, Math.ceil((new Date(ts) - Date.now()) / 86400000)) : null
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`
const has = v => typeof v === 'string' ? v.trim() !== '' : v != null

// expire_claims() appends " · expired YYYY-MM-DD (14-day claim TTL)" to note
// (or writes only that). It is the system's bookkeeping, not a reviewer's
// words, so it is stripped — and a note counts as feedback only when a TA
// decision is recorded.
const SYSTEM_NOTE = /(?:\s*·\s*)?expired \d{4}-\d{2}-\d{2} \(14-day claim TTL\)/g
const reviewerNote = (r) => {
  if (!r.decided_at) return null
  const n = String(r.note ?? '').replace(SYSTEM_NOTE, '').trim()
  return n || null
}

// Slot ranking for the tracker. Expired and released claims are absent on
// purpose: they don't count toward a slot.
const RANK = { accepted: 4, submitted: 3, returned: 2, draft: 1 }
const SLOT_STATUS = {
  accepted:  'Accepted',
  submitted: 'Submitted — waiting for a TA',
  returned:  'Returned — revise and resubmit',
  draft:     'Draft — not submitted',
}

const hasText = (r) => [r.source_citation, r.source_doi, r.source_url, r.submitted_text, r.limitation].some(has)
const isClosed = (r) => r.display_state === 'expired' || r.display_state === 'released'

// The draft the gap board autosaved on THIS device, when it differs from what
// the server holds — e.g. typed but never saved before the claim expired.
function localDraftFor(r) {
  const d = readDraft(r.claim_id)
  if (!d) return null
  const pairs = [[d.doi, r.source_doi], [d.url, r.source_url], [d.text, r.submitted_text], [d.lim, r.limitation]]
  const differs = pairs.some(([a, b]) => String(a ?? '').trim() !== String(b ?? '').trim())
  const any = [d.doi, d.url, d.text, d.lim].some(has)
  return differs && any ? d : null
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Older mobile browsers and non-secure contexts: the textarea fallback.
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch { return false }
  }
}

function CopyButton({ text, label = 'Copy' }) {
  const [state, setState] = useState(null) // null | 'ok' | 'fail'
  const onClick = async () => {
    const ok = await copyText(text)
    setState(ok ? 'ok' : 'fail')
    setTimeout(() => setState(null), 1800)
  }
  return (
    <button type="button" style={S.copyBtn} onClick={onClick}>
      {state === 'ok' ? 'Copied' : state === 'fail' ? 'Select and copy by hand' : label}
    </button>
  )
}

const everything = (f) => [
  f.citation && `Citation: ${f.citation}`,
  f.doi && `DOI: ${f.doi}`,
  f.url && `URL: ${f.url}`,
  f.text && `What the source found:\n${f.text}`,
  f.lim && `What this source cannot tell us:\n${f.lim}`,
].filter(Boolean).join('\n\n')

export default function MyContributions() {
  const paths = useCoursePaths()
  const { courseClient, courseCode, session, isStaff } = useOutletContext()
  const feats = courseFeatures(courseCode)
  const [rows, setRows] = useState(null)   // null = loading
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    const { data, error: err } = await courseClient.rpc('my_claims', { p_course_code: courseCode })
    if (err) { setError(err.message); setRows([]); return }
    setError(null)
    setRows(data ?? [])
  }, [courseClient, courseCode])

  useEffect(() => { load() }, [load])

  const groups = useMemo(() => {
    const g = { attention: [], waiting: [], accepted: [], closed: [] }
    for (const r of rows ?? []) {
      const s = r.display_state
      if (s === 'returned' || s === 'draft') g.attention.push(r)
      else if (s === 'submitted') g.waiting.push(r)
      else if (s === 'accepted') g.accepted.push(r)
      else if (isClosed(r)) (hasText(r) || localDraftFor(r) ? g.attention : g.closed).push(r)
    }
    return g
  }, [rows])

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '32px 16px 80px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <AcademicEyebrow to={paths.home} courseCode={courseCode} suffix=" · students" />
          {session && (
            <AvatarMenu client={courseClient} fgEmail={session.user.email}
                        courseCode={courseCode} isStaff={isStaff} />
          )}
        </div>

        <h1 style={S.h1}>Your contributions</h1>
        <p style={S.sub}>
          Every gap you have claimed in this course, what you wrote for it, and where it stands.
          Your text is kept here even after a claim expires or you release it.
        </p>

        {rows === null && <p style={{ ...S.sub, marginTop: 20 }}>Loading…</p>}
        {error && <p style={S.notice}>Could not load your contributions: {error}</p>}

        {rows !== null && !error && feats.gaps && <Tracker rows={rows} paths={paths} />}

        {rows !== null && !error && rows.length === 0 && (
          <div style={S.card}>
            <p style={S.p}>
              You have not claimed a gap yet. Claims start on the gap board: pick a green gap,
              claim it, and your work shows up here from that moment.
            </p>
            <div style={S.actions}>
              {feats.gaps && <Link to={paths.sub('gaps')} style={S.primary}>Open the gap board</Link>}
              {feats.gaps && <Link to={paths.sub('how-to')} style={S.secondary}>How contributions work</Link>}
            </div>
          </div>
        )}

        <Group title="Needs your attention" rows={groups.attention} paths={paths}
               courseClient={courseClient} reload={load} />
        <Group title="Waiting for review" rows={groups.waiting} paths={paths}
               courseClient={courseClient} reload={load} />
        <Group title="Accepted" rows={groups.accepted} paths={paths}
               courseClient={courseClient} reload={load} />
        <Group title="Closed" rows={groups.closed} paths={paths}
               courseClient={courseClient} reload={load} />

        {rows !== null && rows.length > 0 && (
          <p style={S.foot}>
            Deadlines, tiers and the full process: <Link to={paths.sub('how-to')} style={S.link}>How contributions work</Link>.
          </p>
        )}
      </div>
    </div>
  )
}

// The three required contributions, filled from the student's own claims.
function Tracker({ rows, paths }) {
  const counted = rows.filter(r => RANK[r.display_state])
  const best = (tier) => counted
    .filter(r => r.difficulty === tier)
    .sort((a, b) => RANK[b.display_state] - RANK[a.display_state]
      || String(a.claimed_at).localeCompare(String(b.claimed_at)))
  const greens = best('green')
  const ambers = best('amber')
  const fill = { green: greens[0], amber1: ambers[0], amber2: ambers[1] }
  // claim_gap()'s rule: ambers unlock once a green is submitted or accepted.
  const amberOpen = greens.some(r => r.display_state === 'submitted' || r.display_state === 'accepted')

  return (
    <div style={{ ...S.card, padding: '6px 16px' }}>
      {CONTRIBUTION_SLOTS.map((slot, i) => {
        const r = fill[slot.key]
        const colour = DIFF[slot.tier].colour
        const done = r?.display_state === 'accepted'
        return (
          <div key={slot.key} style={{ ...S.slotRow, borderBottom: i < CONTRIBUTION_SLOTS.length - 1 ? '1px solid var(--bd)' : 'none' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span style={{ ...S.badge, color: colour, border: `1px solid ${colour}` }}>{slot.label}</span>
              <span style={S.meta}>due {slot.due}</span>
            </div>
            {r ? (
              <p style={{ ...S.p, margin: '4px 0 0', color: done ? DIFF.green.colour : 'var(--tx)' }}>
                <b>{SLOT_STATUS[r.display_state]}</b>
                <span style={{ color: 'var(--tx2)' }}> · {r.page_title ?? r.slug}{r.section ? ` › ${r.section}` : ''}</span>
              </p>
            ) : (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
                <span style={{ ...S.p, margin: 0 }}><b>Not started</b>
                  {slot.tier === 'amber' && !amberOpen && (
                    <span style={{ color: 'var(--tx2)' }}> · unlocks once your green is submitted</span>
                  )}
                </span>
                <Link to={paths.sub('gaps')} style={S.smallBtn}>Gap board</Link>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Group({ title, rows, ...rest }) {
  if (!rows.length) return null
  return (
    <section>
      <h2 style={S.h2}>{title}</h2>
      {rows.map(r => <ClaimCard key={r.claim_id} r={r} {...rest} />)}
    </section>
  )
}

function ClaimCard({ r, paths, courseClient, reload }) {
  const WIKI_BASE = useWikiBase()
  const navigate = useNavigate()
  const state = r.display_state
  const d = DIFF[r.difficulty] ?? DIFF.amber
  const note = reviewerNote(r)
  const who = r.reviewer_name || 'a TA'
  const pageHref = `${WIKI_BASE}/${r.slug}${r.section ? `#${r.section}` : ''}`
  const boardHref = `${paths.sub('gaps')}?gap=${r.gap_id}`
  const [open, setOpen] = useState(state === 'returned' || isClosed(r))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const local = useMemo(() => localDraftFor(r), [r])

  const reclaim = async () => {
    setBusy(true); setMsg(null)
    const { data, error } = await courseClient.rpc('claim_gap', { p_gap_id: r.gap_id })
    setBusy(false)
    if (error) return setMsg(error.message)
    if (!data?.ok) { setMsg(data?.message ?? 'The claim was refused.'); reload(); return }
    navigate(boardHref)
  }

  // Only dates the database recorded, in the order they happened.
  const timeline = [
    ['Claimed', r.claimed_at],
    ['Submitted', r.submitted_at],
    state === 'accepted' ? ['Accepted', r.resolved_at ?? r.decided_at] : ['Returned', r.decided_at],
  ].filter(([, ts]) => ts).sort((a, b) => new Date(a[1]) - new Date(b[1]))

  const findings = Array.isArray(r.precheck) ? r.precheck : []
  const showChecks = (state === 'draft' || state === 'returned') && findings.length > 0

  const left = daysLeft(r.expires_at)
  let status
  if (state === 'draft') {
    status = `Draft — ${plural(left, 'day')} left to submit (expires ${fmtDayTime(r.expires_at)})`
  } else if (state === 'returned') {
    status = `Returned by ${who} on ${fmtDay(r.decided_at)} — revise and resubmit by ${fmtDayTime(r.expires_at)}`
  } else if (state === 'submitted') {
    status = `Submitted ${fmtDay(r.submitted_at)} — waiting for a TA${r.resubmitted ? ' · resubmitted after revision' : ''}`
  } else if (state === 'accepted') {
    status = `Accepted ${fmtDay(r.resolved_at ?? r.decided_at)} — counts toward your grade`
  } else if (state === 'expired') {
    status = `Expired ${fmtDayTime(r.expires_at)} — ${hasText(r) || local ? 'your text is saved below' : 'nothing was written for it'}`
  } else if (state === 'released') {
    status = `You released this claim — ${hasText(r) || local ? 'your text is saved below' : 'nothing was written for it'}`
  }

  // Why a closed claim can't come back — from the facts my_claims returns.
  const whyNot = r.gap_status !== 'open' ? 'This gap is closed'
    : r.slots_remaining === 0 ? 'This gap is full'
    : 'This gap cannot be re-claimed'

  const fields = {
    citation: r.source_citation, doi: r.source_doi, url: r.source_url,
    text: r.submitted_text, lim: r.limitation,
  }

  return (
    <article style={S.claim}>
      <div style={S.gapTop}>
        <span style={{ ...S.badge, color: d.colour, border: `1px solid ${d.colour}` }}>{d.label}</span>
        <a href={pageHref} target="_blank" rel="noopener noreferrer" style={S.pageName}>
          {r.page_title ?? r.slug}{r.section ? ` › ${r.section}` : ''}
        </a>
        {r.lecture_no != null && <span style={S.meta}>L{r.lecture_no}</span>}
      </div>
      <p style={S.ask}>{r.ask}</p>

      <p style={{ ...S.status, color: state === 'accepted' ? DIFF.green.colour : 'var(--tx)' }}>{status}</p>

      {state === 'submitted' && (
        <p style={S.small}>
          It is locked while a TA reviews it. If it comes back, it reopens on the gap board with
          their note, and it shows here under Needs your attention.
        </p>
      )}

      {note && (
        <div style={S.noteBox}>
          <p style={S.label}>Note from {who}</p>
          <p style={{ ...S.p, whiteSpace: 'pre-wrap', margin: 0 }}>{note}</p>
        </div>
      )}

      {(state === 'draft' || state === 'returned') && (
        <div style={S.actions}>
          <Link to={boardHref} style={S.primary}>Continue on the gap board</Link>
        </div>
      )}
      {state === 'accepted' && r.on_page && (
        <p style={{ margin: '8px 0 0' }}>
          <a href={pageHref} target="_blank" rel="noopener noreferrer" style={S.link}>Now part of the page ↗</a>
        </p>
      )}
      {isClosed(r) && (r.can_reclaim ? (
        <div style={S.actions}>
          <button type="button" style={S.primaryBtn} disabled={busy} onClick={reclaim}>
            {busy ? 'Working…' : 'Re-claim and continue'}
          </button>
          <span style={S.small}>Same claim, your text intact, a fresh 14 days.</span>
        </div>
      ) : (hasText(r) || local) && (
        <p style={S.small}>
          {whyNot}, so it cannot be re-claimed. Copy your text below to reuse it on another gap.
        </p>
      ))}
      {msg && <p style={S.notice}>{msg}</p>}

      {timeline.length > 0 && (
        <p style={S.timeline}>{timeline.map(([k, ts]) => `${k} ${fmtDay(ts)}`).join(' · ')}</p>
      )}

      {showChecks && (
        <>
          <p style={{ ...S.label, marginTop: 12 }}>Automatic checks</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {findings.map((f, i) => {
              const c = SEV[f.severity] ?? 'var(--tx2)'
              return (
                <li key={i} style={{ ...S.findingCard, borderColor: c }}>
                  <span style={{ ...S.badge, color: c, border: `1px solid ${c}` }}>{f.severity}</span>{' '}
                  <span style={{ fontSize: 14 }}>{f.detail}</span>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {(hasText(r) || local) && (
        <div style={{ marginTop: 12 }}>
          <button type="button" style={S.toggle} onClick={() => setOpen(o => !o)} aria-expanded={open}>
            {open ? '▾' : '▸'} Your submission
          </button>
          {open && (
            <div style={{ marginTop: 8 }}>
              {hasText(r) ? (
                <>
                  <Fields f={fields} />
                  <div style={S.actions}><CopyButton text={everything(fields)} label="Copy everything" /></div>
                </>
              ) : (
                <p style={S.small}>Nothing was saved to the server for this claim.</p>
              )}
              {local && (
                <div style={S.localBox}>
                  <p style={S.label}>Unsaved draft on this device</p>
                  <p style={S.small}>
                    The gap board kept this in this browser; it differs from what was saved.
                  </p>
                  <Fields f={{ doi: local.doi, url: local.url, text: local.text, lim: local.lim }} />
                  <div style={S.actions}>
                    <CopyButton text={everything({ doi: local.doi, url: local.url, text: local.text, lim: local.lim })}
                                label="Copy this draft" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  )
}

function Fields({ f }) {
  const doi = has(f.doi) ? f.doi.trim() : null
  return (
    <>
      {has(f.citation) && <Field label="Citation" value={f.citation} />}
      {doi && (
        <Field label="DOI" value={doi}>
          <a href={`https://doi.org/${doi}`} target="_blank" rel="noopener noreferrer" style={S.mono}>{doi}</a>
        </Field>
      )}
      {has(f.url) && (
        <Field label="URL" value={f.url}>
          <a href={f.url} target="_blank" rel="noopener noreferrer" style={S.mono}>{f.url}</a>
        </Field>
      )}
      {has(f.text) && <Field label="What the source found" value={f.text} />}
      {has(f.lim) && <Field label="What this source cannot tell us" value={f.lim} />}
    </>
  )
}

function Field({ label, value, children }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <p style={{ ...S.label, margin: 0 }}>{label}</p>
        <CopyButton text={value} />
      </div>
      <div style={S.value}>{children ?? value}</div>
    </div>
  )
}

const S = {
  h1: { fontFamily: SERIF, fontSize: 30, lineHeight: 1.2, color: 'var(--tx)', margin: '18px 0 10px' },
  h2: { fontFamily: SERIF, fontSize: 22, color: 'var(--tx)', margin: '30px 0 8px' },
  sub: { fontSize: 15, color: 'var(--tx2)', lineHeight: 1.6 },
  p: { fontSize: 15, color: 'var(--tx)', lineHeight: 1.6, margin: '4px 0' },
  small: { fontSize: 13.5, color: 'var(--tx2)', lineHeight: 1.55, margin: '6px 0 0' },
  meta: { fontFamily: MONO, fontSize: 12, color: 'var(--tx2)' },
  label: { fontFamily: MONO, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx2)', margin: '0 0 4px' },
  link: { fontSize: 14, color: 'var(--pk)' },
  mono: { fontFamily: MONO, fontSize: 13.5, color: 'var(--pk)', overflowWrap: 'anywhere' },
  notice: { color: 'var(--pk)', marginTop: 10, fontFamily: MONO, fontSize: 14, overflowWrap: 'anywhere' },
  foot: { marginTop: 40, fontSize: 13.5, color: 'var(--tx2)', borderTop: '1px solid var(--bd)', paddingTop: 14 },

  card: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, padding: '16px 18px', margin: '14px 0' },
  slotRow: { padding: '10px 0' },
  claim: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 10, padding: '12px 14px', marginTop: 10, minWidth: 0 },
  gapTop: { display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' },
  badge: { fontFamily: MONO, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', padding: '2px 8px', borderRadius: 20, flexShrink: 0 },
  pageName: { fontFamily: MONO, fontSize: 14, color: 'var(--pk)', overflowWrap: 'anywhere', minWidth: 0 },
  ask: { fontSize: 14, color: 'var(--tx)', lineHeight: 1.55, margin: '7px 0 0' },
  status: { fontSize: 15, fontWeight: 600, lineHeight: 1.5, margin: '10px 0 0' },
  timeline: { fontFamily: MONO, fontSize: 12, color: 'var(--tx2)', margin: '10px 0 0', overflowWrap: 'anywhere' },
  noteBox: { background: 'var(--bg)', borderLeft: '3px solid var(--pk)', borderRadius: 6, padding: '10px 12px', margin: '10px 0 0' },
  localBox: { border: '1px dashed var(--bd)', borderRadius: 8, padding: '10px 12px', marginTop: 14 },
  findingCard: { border: '1px solid', borderRadius: 8, padding: '7px 10px', marginBottom: 6, color: 'var(--tx)' },
  value: { fontSize: 14.5, color: 'var(--tx)', lineHeight: 1.6, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', background: 'var(--bg)', border: '1px solid var(--bd)', borderRadius: 8, padding: '8px 10px', marginTop: 4 },
  toggle: { fontFamily: MONO, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx)', padding: '7px 12px', borderRadius: 20, border: '1px solid var(--bd)', background: 'var(--bg)', cursor: 'pointer' },

  actions: { display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' },
  primary: { display: 'inline-block', fontSize: 14, fontWeight: 600, padding: '9px 16px', borderRadius: 24, border: '1px solid var(--pk)', background: 'var(--pk)', color: '#fff', textDecoration: 'none' },
  primaryBtn: { fontSize: 14, fontWeight: 600, padding: '9px 16px', borderRadius: 24, border: '1px solid var(--pk)', background: 'var(--pk)', color: '#fff', cursor: 'pointer' },
  secondary: { display: 'inline-block', fontSize: 14, fontWeight: 600, padding: '9px 16px', borderRadius: 24, border: '1px solid var(--bd)', background: 'var(--bgc)', color: 'var(--tx)', textDecoration: 'none' },
  smallBtn: { display: 'inline-block', fontSize: 13, fontWeight: 600, padding: '5px 12px', borderRadius: 20, border: '1px solid var(--bd)', background: 'var(--bg)', color: 'var(--tx)', textDecoration: 'none' },
  copyBtn: { fontFamily: MONO, fontSize: 11, padding: '4px 10px', borderRadius: 16, border: '1px solid var(--bd)', background: 'var(--bgc)', color: 'var(--tx)', cursor: 'pointer', flexShrink: 0 },
}
