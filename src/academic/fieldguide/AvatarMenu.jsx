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
import { loungePath, courseSubPath } from '../courseRoutes'
import { signOutEverywhere } from '../../lib/signOutEverywhere'

const MONO = '"Space Mono", "Courier New", monospace'

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
// ends that session) AND on Lecture Lounge pages (main session; pass `email`
// and a `signOut` override). Same items either way — that sameness is the
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

export default function AvatarMenu({ client, fgEmail, email, courseCode, isStaff, onTour, signOut }) {
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
    items.push({ to: lounge, label: isStaff ? 'Create your avatar' : 'Join the Lecture Lounge' })
  }
  if (isStaff) {
    items.push({ to: sub('submissions'), label: 'Submissions' })
    items.push({ to: sub('review'), label: 'Review queue' })
    items.push({ to: sub('tracking'), label: 'Tracking' })
    items.push({ to: sub('roster'), label: 'Roster' })
  } else if (feats.gaps) {
    items.push({ to: sub('gaps'), label: 'Gap board' })
  }
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
          {items.map((it) => it.to
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
  mismatch: { fontSize: 12, color: 'var(--tx2)', lineHeight: 1.45, padding: '6px 14px 2px', overflowWrap: 'anywhere' },
}
