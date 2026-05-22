import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

// Single source of truth for the current user's avatar config.
// React Query deduplicates fetches across all consumers sharing the same userId —
// Nav, ProfilePage, and any future render site all read from the same cache entry.
// AvatarEditor invalidates ['avatar', userId] on save, so every consumer auto-refetches.
export function useAvatarConfig(userId) {
  return useQuery({
    queryKey: ['avatar', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('avatars')
        .select('skin_color, eye_color, species, aura, hair_style, hair_color')
        .eq('user_id', userId)
        .maybeSingle()
      return data
    },
    enabled: !!userId,
  })
}
