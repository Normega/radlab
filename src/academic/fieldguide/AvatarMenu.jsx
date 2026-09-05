import { useEffect, useRef, useState } from 'react'
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

const MONO = '"Space Mono", "Courier New", monospace'

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

export default function AvatarMenu({ client, fgEmail, email, courseCode, isStaff, onTour, signOut }) {
  const [open, setOpen] = useState(false)
  const [mainUserId, setMainUserId] = useState(null)
  const [mainIdentity, setMainIdentity] = useState(null) // { email, utoronto } | null
  const wrapRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled) return
      setMainUserId(session?.user?.id ?? null)
      if (!session) { setMainIdentity(null); return }
      const { data: prof } = await supabase.from('profiles')
        .select('utoronto_email').eq('id', session.user.id).maybeSingle()
      if (!cancelled) setMainIdentity({ email: session.user.email, utoronto: prof?.utoronto_email ?? null })
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  // On Field Guide mounts (fgEmail set) the main session in this browser may
  // belong to SOMEONE ELSE — Norm hit this 2026-09-05: an old test account's
  // main session made the menu wear a stranger's ripple beside his own
  // academic identity. Lounge mounts pass `email` from the main session
  // itself, so there the question cannot arise.
  const mismatch = !!(fgEmail && mainUserId && mainIdentity
    && normEmail(fgEmail) !== normEmail(mainIdentity.email)
    && normEmail(fgEmail) !== normEmail(mainIdentity.utoronto))
  const linkedMainId = mismatch ? null : mainUserId

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

  const handleSignOut = () => {
    if (signOut) return signOut()
    return client?.auth.signOut()
  }

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
                account. Sign it out to link this one.
              </p>
              <button style={{ ...S.item, ...S.itemBtn }}
                      onClick={() => supabase.auth.signOut().then(() => setMainUserId(null), () => {})}>
                Sign out of that account
              </button>
              <div style={S.divider} />
            </>
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
