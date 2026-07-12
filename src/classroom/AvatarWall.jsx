import { useEffect, useRef, useState } from 'react'
import BaseAvatar from '../components/Avatar/BaseAvatar'
import SyncAura from '../components/SyncAura'

// Presence-driven lobby wall. Each entry is whatever useClassPresence's
// selfPayload shape carries: { user_id, skin_color, eye_color, species,
// hair_style, hair_color, aura }.
//
// Arrival animation: a newly-seen user_id pops in via a CSS keyframe rather
// than appearing instantly — called out explicitly in website.md's Phase 2
// scope ("avatar wall presence with arrival animation").
export default function AvatarWall({ avatars, size = 56, maxWidth = 360 }) {
  const seenRef = useRef(new Set())
  const [arrivingIds, setArrivingIds] = useState(new Set())

  useEffect(() => {
    const fresh = avatars.filter((a) => a.user_id && !seenRef.current.has(a.user_id))
    if (!fresh.length) return
    const freshIds = new Set(fresh.map((a) => a.user_id))
    freshIds.forEach((id) => seenRef.current.add(id))
    setArrivingIds((prev) => new Set([...prev, ...freshIds]))
    const timer = setTimeout(() => {
      setArrivingIds((prev) => { const next = new Set(prev); freshIds.forEach((id) => next.delete(id)); return next })
    }, 700)
    return () => clearTimeout(timer)
  }, [avatars])

  if (!avatars.length) return <p style={S.empty}>No one's here yet.</p>

  return (
    <div style={{ ...S.grid, maxWidth }}>
      {avatars.map((a) => (
        <div key={a.user_id ?? a.presence_ref} style={S.slot(arrivingIds.has(a.user_id))}>
          {a.aura?.enabled ? (
            <SyncAura params={{ inset: a.aura.maxInset ?? 4, opacity: 0.6 }} color={a.aura.color ?? 'var(--pk)'} size={size}>
              <BaseAvatar
                skinColor={a.skin_color} eyeColor={a.eye_color} species={a.species ?? 'human'}
                hairStyle={a.hair_style ?? 'none'} hairColor={a.hair_color ?? '#784421'} size={size}
              />
            </SyncAura>
          ) : (
            <BaseAvatar
              skinColor={a.skin_color} eyeColor={a.eye_color} species={a.species ?? 'human'}
              hairStyle={a.hair_style ?? 'none'} hairColor={a.hair_color ?? '#784421'} size={size}
            />
          )}
        </div>
      ))}
    </div>
  )
}

const S = {
  grid: { display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', maxWidth: 360, margin: '0 auto' },
  slot: (arriving) => ({ animation: arriving ? 'lecture-lounge-avatar-in 0.5s ease-out' : 'none' }),
  empty: { fontSize: 13, color: 'var(--tx3)', textAlign: 'center' },
}

if (typeof document !== 'undefined' && !document.getElementById('lecture-lounge-avatar-in-kf')) {
  const style = document.createElement('style')
  style.id = 'lecture-lounge-avatar-in-kf'
  style.textContent = `@keyframes lecture-lounge-avatar-in { 0% { transform: scale(0.4); opacity: 0; } 70% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }`
  document.head.appendChild(style)
}
