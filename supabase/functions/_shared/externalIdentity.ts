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

// Minimal shape of the supabase-js calls used, so tests can pass a fake.
interface Db {
  from(table: string): any
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
  const lookup = () => db.from('external_identities')
    .select('surrogate').eq('study_id', studyId).eq('external_id', externalId).maybeSingle()

  const { data: found, error } = await lookup()
  if (error) {
    console.error('external identity lookup failed:', error.message)
    return null
  }
  if (found?.surrogate) return found.surrogate

  const surrogate = mint()
  const { error: insErr } = await db.from('external_identities')
    .insert({ study_id: studyId, external_id: externalId, surrogate })
  if (!insErr) return surrogate

  // Two first clicks from the same person race to insert; the loser reads the
  // winner's row. Only the constraint name is logged, never the id itself.
  const { data: again } = await lookup()
  if (again?.surrogate) return again.surrogate
  console.error('external identity insert failed:', insErr.code ?? insErr.message)
  return null
}
