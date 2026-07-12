import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Realtime Presence — a genuinely new mechanism for this codebase (every
// other Lecture Lounge live-update path uses broadcast or postgres_changes).
// Verified directly against this Supabase project with two independent
// anon-key clients before wiring in: a writer track()s, a reader's presence
// sync/join events land with the expected shape — same verification bar as
// broadcast got in Phase 1.
//
// selfPayload null/undefined = read-only (ClassScreen watches who's present
// without being "present" itself). Pass it once the caller's own avatar
// config has loaded to register this student in the room.
export function useClassPresence(classId, selfPayload) {
  const [avatars, setAvatars] = useState([])
  const selfUserId = selfPayload?.user_id

  useEffect(() => {
    if (!classId) return
    const channel = supabase.channel(`class:${classId}`, {
      config: { presence: { key: selfUserId ?? undefined } },
    })
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState()
      // Explicit presence key = user_id, so a user open in two tabs groups
      // under one key — picking the first tracked meta per key is enough.
      setAvatars(Object.values(state).map((metas) => metas[0]).filter(Boolean))
    })
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && selfPayload) await channel.track(selfPayload)
    })
    return () => { supabase.removeChannel(channel) }
    // Only identity (classId/selfUserId) should tear down and rebuild the
    // channel — selfPayload's avatar-color fields changing mid-session
    // isn't worth a re-track for this feature.
  }, [classId, selfUserId]) // eslint-disable-line react-hooks/exhaustive-deps

  return avatars
}
