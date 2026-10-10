// Separate external identity (20261009_external_identities.sql).
//
// For a study with `studies.separate_external_identity`, the recruitment
// platform's id (a Prolific ID) is written to `external_identities` and nowhere
// else; every other table -- the enrollment, the synthetic auth email, the
// display name -- sees a random surrogate. De-identification is then one delete
// (deidentify_external_enrollments), and the offsite backup can skip that one
// table's rows. Same id in, same surrogate out, so re-entry and a second Prolific
// posting of the same study still find the person's enrollment.
//
// The id must never appear in a URL. The first version looked it up with a
// PostgREST GET filter (`?external_id=eq.<id>`), and the API gateway logs every
// request URL: the live test found the id in edge_logs on its first run. The
// lookup is therefore an RPC, a POST whose body is not logged
// (20261009_external_identity_surrogate_rpc.sql), which also does find-or-create
// in one statement.
//
// Surrogate shape: "P-" + 12 characters from an alphabet without look-alikes, so
// it survives the auth-email slugging (lower-case, [a-z0-9-]) unchanged and can
// never collide with a real Prolific ID (24 hex digits) or SONA id (digits).

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789' // 31 symbols, no 0/o/1/l/i

export function randomSurrogate(random: (n: number) => Uint8Array = n => crypto.getRandomValues(new Uint8Array(n))): string {
  let out = ''
  while (out.length < 12) {
    for (const b of random(16)) {
      if (b >= 248) continue // 248 = 8 * 31: reject so every symbol is equally likely
      out += ALPHABET[b % 31]
      if (out.length === 12) break
    }
  }
  return `P-${out}`
}

// Minimal shape of the supabase-js call used, so tests can pass a fake.
interface Db {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }>
}

// The surrogate for this (study, platform id), minted on first sight. Returns
// null on a database error; the caller refuses the join rather than fall back to
// writing the platform id where it must not go.
export async function surrogateFor(
  db: Db,
  studyId: string,
  externalId: string,
  mint: () => string = randomSurrogate,
): Promise<string | null> {
  // Two tries: a first click racing another for the same person can find the
  // row locked by the other's insert and, in the same statement, not yet see it.
  // The second statement does.
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await db.rpc('external_identity_surrogate', {
      p_study_id: studyId, p_external_id: externalId, p_candidate: mint(),
    })
    if (error) {
      // The message never contains the id (it was in the body, not the SQL text).
      console.error('external identity lookup failed:', error.code ?? error.message)
      return null
    }
    if (typeof data === 'string' && data) return data
  }
  console.error('external identity lookup returned nothing twice')
  return null
}
