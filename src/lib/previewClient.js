// A stand-in for the Supabase client that never touches the network — the
// "nothing is saved" guarantee behind task previews (/preview/:token and
// /admin/tasks/preview/:slug; website.md §25a).
//
// Games already take an injected `supabaseClient` (the study runner passes its
// isolated participant client the same way), so handing them this one makes a
// preview no-save by construction rather than by a flag each game must honour.
//
// Every query resolves to success. Writes come back as one placeholder row so
// the games' save checks pass (`.select('id').single()` → { id }, an update's
// `.select('id')` → a one-row array). Reads would get that placeholder too, so
// a game that READS data must not be added to PREVIEWABLE_TASKS without checking
// what it does with a fake row.

export const PREVIEW_ROW_ID = 'preview'

function query() {
  let single = false
  const q = new Proxy({}, {
    get(_, prop) {
      if (prop === 'then') {
        const result = { data: single ? { id: PREVIEW_ROW_ID } : [{ id: PREVIEW_ROW_ID }], error: null }
        return (resolve, reject) => Promise.resolve(result).then(resolve, reject)
      }
      if (prop === 'single' || prop === 'maybeSingle') return () => { single = true; return q }
      // insert / update / select / eq / order / … all chain
      return () => q
    },
  })
  return q
}

export function makePreviewClient() {
  return {
    isPreviewClient: true,
    from: () => query(),
    rpc:  () => query(),
    auth: {
      getUser:    async () => ({ data: { user: null },    error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
    },
  }
}
