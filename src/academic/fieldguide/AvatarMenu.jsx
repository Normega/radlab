import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
// Cross-partition imports, deliberately: the avatar lives on the MAIN
// project, keyed to the main-site account. Both sessions share this origin's
// localStorage, so when a main session exists alongside the Field Guide one
// we render the student's real avatar; otherwise an initial-in-a-circle.
// There is no avatar system in the academic project, and there shouldn't be.
import { supabase } from '../../lib/supabase'
import { useAvatarConfig } from '../../hooks/useAvatarConfig'
import RippleAvatar from '../../ripple/RippleAvatar'
import { loungePath, courseSubPath } from '../courseRoutes'

const MONO = '"Space Mono", "Courier New", monospace'

// Top-right account chrome for Field Guide pages (student and staff).
// Course-flavored menu, not a mirror of the main site's: "My Ripple" is a
// research surface and would be a wrong turn from inside a course.
export default function AvatarMenu({ client, fgEmail, courseCode, isStaff, onTour }) {
  const [open, setOpen] = useState(false)
  const [mainUserId, setMainUserId] = useState(null)
  const wrapRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) setMainUserId(session?.user?.id ?? null)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  const { data: avatarData } = useAvatarConfig(mainUserId)

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const initial = (fgEmail ?? '?').trim().charAt(0).toUpperCase()
  const lounge = courseCode ? loungePath(courseCode) : '/academic'
  const sub = (seg) => (courseCode ? courseSubPath(courseCode, seg) : '/academic')

  const items = []
  if (mainUserId) {
    items.push({ to: lounge, label: 'Class dashboard' })
  } else {
    // No main-site session in this browser. The lounge join creates one, and
    // with it the avatar — one door for both roles, labeled by what each
    // actually wants from it.
    items.push({ to: lounge, label: isStaff ? 'Create your avatar' : 'Join the class dashboard' })
  }
  items.push(isStaff
    ? { to: sub('submissions'), label: 'Submissions' }
    : { to: sub('gaps'), label: 'Gap board' })
  if (isStaff) items.push({ to: sub('review'), label: 'Review queue' })
  if (mainUserId) items.push({ to: '/account', label: 'Account' })
  if (onTour) items.push({ onClick: () => { setOpen(false); onTour() }, label: 'Tour' })

  return (
    <div ref={wrapRef} style={S.wrap}>
      <button style={S.trigger} aria-label="Account menu" onClick={() => setOpen(o => !o)}>
        {avatarData ? (
          <RippleAvatar
            skinColor={avatarData.skin_color} eyeColor={avatarData.eye_color}
            species={avatarData.species ?? 'human'} hairStyle={avatarData.hair_style ?? 'none'}
            hairColor={avatarData.hair_color ?? '#784421'} valence={0} arousal={0} size={36}
          />
        ) : (
          <span style={S.initial}>{initial}</span>
        )}
      </button>
      {open && (
        <div style={S.menu}>
          <p style={S.who}>{fgEmail}</p>
          {items.map((it) => it.to
            ? <Link key={it.label} to={it.to} style={S.item} onClick={() => setOpen(false)}>{it.label}</Link>
            : <button key={it.label} style={{ ...S.item, ...S.itemBtn }} onClick={it.onClick}>{it.label}</button>
          )}
          <div style={S.divider} />
          <button style={{ ...S.item, ...S.itemBtn, color: 'var(--tx2)' }}
                  onClick={() => client.auth.signOut()}>Sign out</button>
        </div>
      )}
    </div>
  )
}

const S = {
  wrap: { position: 'relative', flex: '0 0 auto' },
  trigger: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 40, height: 40, borderRadius: '50%', border: '2px solid var(--bd)',
    background: 'var(--bgc)', cursor: 'pointer', padding: 0, overflow: 'hidden',
  },
  initial: { fontFamily: MONO, fontSize: 16, fontWeight: 700, color: 'var(--pk)' },
  menu: {
    position: 'absolute', right: 0, top: 46, zIndex: 60, minWidth: 210,
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
}
