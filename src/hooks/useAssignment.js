// v1 — condition assignment draws via the shared draw_assignment primitive.
// The server owns arms, balance, idempotency, and the audit write; these hooks
// are thin RPC wrappers. See randomizer_spec.md.
import { useQuery, useQueries } from '@tanstack/react-query'
import { supabase as globalSupabase } from '../lib/supabase'

function assignmentQuery(db, studyId, slotKey, enabled) {
  return {
    queryKey: ['assignment', studyId, slotKey],
    enabled:  enabled && !!studyId && !!slotKey,
    staleTime: Infinity,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await db.rpc('draw_assignment', {
        p_study_id: studyId,
        p_slot_key: slotKey,
      })
      if (error) throw error
      return data // { value, draw_index }
    },
  }
}

/** Draw (or return the existing) assignment for one slot. */
export function useAssignment(studyId, slotKey, { enabled = true, client } = {}) {
  const db = client ?? globalSupabase
  return useQuery(assignmentQuery(db, studyId, slotKey, enabled))
}

/**
 * Draw all slots for a study. Returns:
 *   { assignments: { [slotKey]: value }, isLoading, isError }
 * assignments is only populated once every draw has resolved.
 */
export function useAssignments(studyId, slotKeys, { enabled = true, client } = {}) {
  const db   = client ?? globalSupabase
  const keys = slotKeys ?? []

  const results = useQueries({
    queries: keys.map(slotKey => assignmentQuery(db, studyId, slotKey, enabled)),
  })

  const isLoading = results.some(r => r.isLoading && r.fetchStatus !== 'idle')
  const isError   = results.some(r => r.isError)

  const assignments = {}
  if (!isLoading && !isError) {
    keys.forEach((k, i) => { assignments[k] = results[i].data?.value })
  }

  return { assignments, isLoading, isError }
}
