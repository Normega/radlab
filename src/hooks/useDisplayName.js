import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

// Single source of truth for what to call the current user.
//
// Before 2026-07-31 there were three: the Dashboard greeting and Nav's avatar
// initial read `user_metadata.display_name`, while /profile and every admin
// list read `profiles.display_name`. `handle_new_user` copies metadata →
// profiles once at signup and never again, so the two could disagree the
// moment anything edited one of them — which is exactly what renaming
// surfaced (§12f). Every render site now reads through this hook.
//
// `profiles.display_name` is the truth. Server-side already agreed: the
// `send_message` and adherence-withdrawal functions address participants from
// that column, so an email and the dashboard could otherwise greet the same
// person differently.
//
// `user_metadata` survives as the *seed*, not a second store — it is how the
// name reaches `handle_new_user` at signup (and how `create_participant` /
// `auto-enroll` name the accounts they mint), and it is readable off the
// session with no round trip, so it renders instantly while the query is in
// flight. That ordering matters: falling straight back to the email local-part
// would flash "Hey, norman." before settling on "Hey, Barnes."
//
// React Query dedupes across consumers on the shared key, so ProfilePage's
// rename invalidating ['display-name', userId] updates the greeting, the Nav
// initial and the admin sidebar together, without a reload.
export function useDisplayName(user, fallback = 'researcher') {
  const userId = user?.id

  const query = useQuery({
    queryKey: ['display-name', userId],
    queryFn: async () => {
      const { data } = await supabase.from('profiles')
        .select('display_name').eq('id', userId).maybeSingle()
      // `null` is a real answer (a profile with no name set); `undefined`
      // would make React Query treat the fetch as failed.
      return data?.display_name ?? null
    },
    enabled: !!userId,
  })

  const displayName =
    query.data ||
    user?.user_metadata?.display_name ||
    user?.email?.split('@')[0] ||
    fallback

  return { displayName, ...query }
}
