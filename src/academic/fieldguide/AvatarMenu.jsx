import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
// Cross-partition imports, deliberately: the avatar lives on the MAIN
// project, keyed to the main-site account. Both sessions share this origin's
// localStorage, so when a main session exists alongside the Field Guide one
// we render the student's real avatar; otherwise an initial-in-a-circle.
// There is no avatar system in the academic project, and there shouldn't be.
import { supabase } from '../../lib/supabase'
import { useAvatarConfig } from '../../hooks/useAvatarConfig'
import MenuAvatar from '../../components/ui/MenuAvatar'
import { courseFeatures } from '../courseFeatures'
import { coursePath, loungePath, courseSubPath } from '../courseRoutes'
import { signOutEverywhere } from '../../lib/signOutEverywhere'

const MONO = '"Space Mono", "Courier New", monospace'

// Per-page-load caches for the staff checks below — the menu mounts on every
// page, and these answers don't change mid-session.
const acadStaffCache = new Map()   // courseCode -> boolean
const classAdminCache = new Map()  // `${uid}:${courseCode}` -> boolean

// Auto-reconcile is attempted at most once per FG identity per page-load life
// of the SPA — the menu remounts on every Field Guide navigation, and without
// this a persistently-unbridgeable identity (e.g. a public reader with no
// enrollment) would re-POST /api/lounge-continue on every page. A success
// changes the session so it never retries anyway; this guards the failures.
// Module-level so it survives remounts; a full reload clears it (deliberate —
// a reload is a fair moment to try again). The manual button ignores it.
const autoReconciled = new Set()

// THE academic account menu — one list, both halves of the partition.
//
// Mounted on Field Guide pages (academic session; pass `client` so Sign out
// ends that session) AND on Lecture Lounge pages (main session; pass
// `email`). Same items either way — that sameness is the
// point: students found two different menus behind the same avatar confusing
// (Norm, 2026-09-04), so wherever you are in a course, this menu gets you
// everywhere else.
//
// "My Ripple" is included by explicit decision (2026-09-04), reversing the
// earlier "research surface, wrong turn from a course" stance: students DO
// have ripples via check-ins, and hiding where their data lives is worse
// than one extra item. It needs a main-site session, so it appears only when
// one exists — before that, the Lounge join item is the door that creates it.
// Same-person test across the two projects. A student's main account may
// legitimately live on a personal address while the Field Guide uses their
// U of T one — the verified utoronto_email is the bridge between them — so
// "same person" means the academic address matches the main account's login
// email OR its verified U of T email, normalized.
const normEmail = (e) =>
  String(e ?? '').trim().toLowerCase().replace(/@(mail\.|alum\.)?utoronto\.ca$/, '@utoronto.ca')

// Does a main session (by its login + verified U of T email) belong to the
// same human as the Field Guide address?
function mainMatchesFg(fgEmail, identity) {
  if (!identity) return false
  const k = normEmail(fgEmail)
  return k === normEmail(identity.email) || k === normEmail(identity.utoronto)
}

export default function AvatarMenu({ client, fgEmail, email, courseCode, isStaff, onTour }) {
  const [open, setOpen] = useState(false)
  const [mainUserId, setMainUserId] = useState(undefined) // undefined=loading, null=none
  const [mainIdentity, setMainIdentity] = useState(null)  // { email, utoronto } | null
  const [reconciling, setReconciling] = useState(false)
  const wrapRef = useRef(null)
  const triedRef = useRef(false)

  // Read whatever main session is live in this browser.
  const loadMain = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setMainUserId(null); setMainIdentity(null); return null }
    const { data: prof } = await supabase.from('profiles')
      .select('utoronto_email').eq('id', session.user.id).maybeSingle()
    const ident = { email: session.user.email, utoronto: prof?.utoronto_email ?? null }
    setMainUserId(session.user.id); setMainIdentity(ident)
    return ident
  }, [])

  // Make the MAIN session match the Field Guide identity. This is the fix for
  // the whole class of "wrong ripple / create-your-avatar even though it
  // exists / ripple missing until I also open the Lounge" reports (Norm,
  // 2026-09-05): the avatar is a main-project object, so signing into the
  // Field Guide alone leaves the menu with no main session of YOURS to read.
  // The bridge (/api/lounge-continue) mints a main session for the SAME
  // person from the FG token — resolving the existing account by email, so no
  // second identity is created — and verifyOtp installs it, replacing any
  // wrong session that was there. No navigation: we only swap the session and
  // re-read, so the correct ripple simply appears in place.
  const reconcile = useCallback(async () => {
    if (!client || !courseCode) return
    setReconciling(true)
    try {
      const { data: { session: fg } } = await client.auth.getSession()
      if (fg?.access_token) {
        const rsp = await fetch('/api/lounge-continue', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fg_token: fg.access_token, slug: courseCode }),
        })
        const out = await rsp.json().catch(() => ({}))
        if (rsp.ok && out.token_hash) {
          await supabase.auth.verifyOtp({ token_hash: out.token_hash, type: out.type || 'magiclink' })
          await loadMain()
        }
      }
    } catch { /* leave the mismatch note to explain and offer a manual retry */ }
    setReconciling(false)
  }, [client, courseCode, loadMain])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const ident = await loadMain()
      if (cancelled) return
      // Only Field Guide mounts reconcile (fgEmail set). Lounge mounts pass
      // `email` from the main session itself — already the right person.
      if (!fgEmail || triedRef.current) return
      if (mainMatchesFg(fgEmail, ident)) return
      const key = normEmail(fgEmail)
      if (autoReconciled.has(key)) { triedRef.current = true; return }
      autoReconciled.add(key)
      triedRef.current = true
      await reconcile()
    })()
    return () => { cancelled = true }
  }, [fgEmail, loadMain, reconcile])

  // Academic staff standing. FG mounts pass isStaff; Lounge mounts don't,
  // so detect it from the academic session when one exists — the point is
  // that the SAME person sees the SAME menu on both halves (Norm,
  // 2026-09-06: the Lounge menu was shorter than the Field Guide one).
  const [acadStaffDetected, setAcadStaffDetected] = useState(false)
  useEffect(() => {
    if (isStaff !== undefined || !courseCode) return
    if (acadStaffCache.has(courseCode)) { setAcadStaffDetected(acadStaffCache.get(courseCode)); return }
    let cancelled = false
    ;(async () => {
      try {
        if (!localStorage.getItem('radlab-academic-auth')) return
        const { getCourseClient } = await import('../courseClient')
        const c = await getCourseClient()
        const { data } = await c.from('enrollments')
          .select('role, courses!inner(code)').eq('status', 'active').in('role', ['ta', 'instructor'])
        const yes = (data ?? []).some(e => String(e.courses?.code ?? '').toLowerCase() === String(courseCode).toLowerCase())
        acadStaffCache.set(courseCode, yes)
        if (!cancelled) setAcadStaffDetected(yes)
      } catch { /* stay student-shaped */ }
    })()
    return () => { cancelled = true }
  }, [isStaff, courseCode])
  const acadStaff = isStaff ?? acadStaffDetected

  // Classroom tools (Console/Screen/Slides) are gated by the MAIN project's
  // class_admins — the same rule ClassAdminRoute enforces — so the menu
  // never shows a door that would bounce.
  const [canRunClassroom, setCanRunClassroom] = useState(false)
  useEffect(() => {
    if (!mainUserId || !courseCode) { setCanRunClassroom(false); return }
    const key = `${mainUserId}:${courseCode}`
    if (classAdminCache.has(key)) { setCanRunClassroom(classAdminCache.get(key)); return }
    let cancelled = false
    ;(async () => {
      try {
        const [{ data: prof }, { data: adm }] = await Promise.all([
          supabase.from('profiles').select('role, super_admin').eq('id', mainUserId).single(),
          supabase.from('class_admins').select('id, classes!inner(slug)').eq('user_id', mainUserId)
            .eq('classes.slug', String(courseCode).toLowerCase()).limit(1),
        ])
        const yes = prof?.role === 'lab' || prof?.super_admin === true || !!adm?.length
        classAdminCache.set(key, yes)
        if (!cancelled) setCanRunClassroom(yes)
      } catch { /* no classroom group */ }
    })()
    return () => { cancelled = true }
  }, [mainUserId, courseCode])

  const sameMain = mainMatchesFg(fgEmail, mainIdentity)
  // On a Lounge mount there is no fgEmail, so the main session is authoritative.
  const linkedMainId = fgEmail ? (sameMain ? mainUserId : null) : mainUserId
  // Show the "different account" note only if reconcile ran and could not fix
  // it (e.g. no active enrollment for this identity) — never mid-attempt.
  const mismatch = !!(fgEmail && !reconciling && triedRef.current && mainUserId && !sameMain)

  const { data: avatarData } = useAvatarConfig(linkedMainId)

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const who = email ?? fgEmail
  const initial = (who ?? '?').trim().charAt(0).toUpperCase()
  const feats = courseFeatures(courseCode)
  const lounge = courseCode ? loungePath(courseCode) : '/academic'
  const sub = (seg) => (courseCode ? courseSubPath(courseCode, seg) : '/academic')

  const items = []
  // Course places first — the two halves of the course, always both present.
  items.push({ to: sub('wiki'), label: 'Field Guide' })
  // The week-planning view of the Guide, next to the Guide itself: "what do I
  // read for this lecture" is the question students actually arrive with.
  items.push({ to: sub('chapters'), label: 'Chapters by lecture' })
  if (linkedMainId) {
    items.push({ to: lounge, label: 'Lecture Lounge' })
  } else if (mismatch) {
    // Deliberately NOT the join item: joining while the wrong main session
    // is live would build membership on the wrong account. Sign that one
    // out first; the Lounge's bridge card then signs in the right person.
  } else {
    // No main-site session in this browser. The Lounge join creates one, and
    // with it the avatar — one door for both roles, labeled by what each
    // actually wants from it.
    items.push({ to: lounge, label: acadStaff ? 'Create your avatar' : 'Join the Lecture Lounge' })
  }
  if (!acadStaff && feats.gaps) items.push({ to: sub('gaps'), label: 'Gap board' })
  // Mid-lecture surfaces get menu placement; desk-work admin lives on Course
  // Home's visible grid instead (Norm, 2026-09-06: "in the classroom has to
  // be more accessible than course admin" — the queue links left this menu
  // the same day the grid landed on Course Home, so nothing is orphaned).
  // Gated on the same rule as the console route, so no door here bounces.
  if (canRunClassroom && courseCode) {
    items.push({ header: 'In the classroom' })
    items.push({ to: `${lounge}/console`, label: 'Console' })
    items.push({ to: `${lounge}/screen`, label: 'Screen' })
    items.push({ to: `${lounge}/slides`, label: 'Slides' })
  }
  // Everyone, not just staff (2026-09-09): Course home is now the course's
  // central navigation page — chapters, gap board, what's new — so a
  // student needs a named way back to it, not just the eyebrow.
  if (courseCode) items.push({ to: coursePath(courseCode), label: 'Course home' })
  // Then the account places.
  if (linkedMainId) items.push({ to: '/ripple', label: 'My Ripple' })
  if (linkedMainId) items.push({ to: '/account', label: 'Account' })
  if (onTour) items.push({ onClick: () => { setOpen(false); onTour() }, label: 'Tour' })

  // Both platforms, always — a linked sign-in deserves a linked sign-out.
  // On Lounge mounts (no client prop) the helper finds any academic session
  // in storage itself.
  const handleSignOut = () => signOutEverywhere(client)

  return (
    <div ref={wrapRef} style={S.wrap}>
      <button style={S.trigger} aria-label="Account menu" onClick={() => setOpen(o => !o)}>
        <MenuAvatar avatarData={avatarData} initial={initial} />
      </button>
      {open && (
        <div style={S.menu}>
          <p style={S.who}>{who}</p>
          {mismatch && (
            <>
              <p style={S.mismatch}>
                The main site is signed in as <b>{mainIdentity.email}</b> — a different
                account. We couldn't switch it automatically{isStaff ? '' : ' (no Lounge membership on this address yet)'}.
              </p>
              <button style={{ ...S.item, ...S.itemBtn }}
                      onClick={() => reconcile()}>
                Switch to {fgEmail}
              </button>
              <div style={S.divider} />
            </>
          )}
          {reconciling && (
            <><p style={S.mismatch}>Linking your account…</p><div style={S.divider} /></>
          )}
          {items.map((it) => it.header
            ? <p key={it.header} style={S.groupHeader}>{it.header}</p>
            : it.to
            ? <Link key={it.label} to={it.to} style={S.item} onClick={() => setOpen(false)}>{it.label}</Link>
            : <button key={it.label} style={{ ...S.item, ...S.itemBtn }} onClick={it.onClick}>{it.label}</button>
          )}
          <div style={S.divider} />
          <button style={{ ...S.item, ...S.itemBtn, color: 'var(--tx2)' }}
                  onClick={handleSignOut}>Sign out</button>
        </div>
      )}
    </div>
  )
}

const S = {
  wrap: { position: 'relative', flex: '0 0 auto' },
  trigger: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: 'none', background: 'none', cursor: 'pointer', padding: 0,
  },
  menu: {
    position: 'absolute', right: 0, top: 52, zIndex: 60, minWidth: 210,
    background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12,
    boxShadow: '0 8px 28px rgba(42,33,48,.14)', padding: '8px 0', textAlign: 'left',
  },
  who: { fontFamily: MONO, fontSize: 11, color: 'var(--tx2)', padding: '4px 14px 8px', borderBottom: '1px solid var(--bd)', marginBottom: 4, overflowWrap: 'anywhere' },
  item: {
    display: 'block', width: '100%', padding: '8px 14px', fontSize: 14, color: 'var(--tx)',
    textDecoration: 'none', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer',
  },
  itemBtn: { fontFamily: 'inherit' },
  divider: { borderTop: '1px solid var(--bd)', margin: '4px 0' },
  groupHeader: { fontFamily: MONO, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--tx3)', padding: '8px 14px 2px', borderTop: '1px solid var(--bd)', marginTop: 4 },
  mismatch: { fontSize: 12, color: 'var(--tx2)', lineHeight: 1.45, padding: '6px 14px 2px', overflowWrap: 'anywhere' },
}
