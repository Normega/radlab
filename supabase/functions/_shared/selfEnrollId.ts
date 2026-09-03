// Opaque participant identity for self-enrolled students.
//
// `study_enrollments.external_id` must NOT be the student's email address, even
// though the email is what identifies them. auto-enroll builds the synthetic
// auth address out of external_id AND sets user_metadata.display_name to
// "<SOURCE> <external_id>" — which handle_new_user copies into
// profiles.display_name, the name rendered in the dashboard, the nav, every
// admin list, and used by send_message to address outgoing mail. Existing rows
// read "SONA 1232". A raw email there would spread the identifier into four
// places and greet the participant by their own address.
//
// So external_id is a hash of the normalised email. It stays deterministic, so
// the existing unique index on (study_id, external_id) still collapses a
// re-signup into the same participant, while the readable email and student
// number live only on the enrollment row.
//
// The hash is NOT a privacy control and must not be mistaken for one: anyone
// who can read this table can also read `contact_email` beside it. It exists to
// keep an identifier out of auth.users and out of display names. It is
// deliberately unsalted so it stays stable across service-key rotation — which
// matters here, unlike the IP hash in auto-enroll, where a rotation harmlessly
// resets a 60-second counting window.

export async function selfEnrollExternalId(matchKey: string): Promise<string> {
  const bytes = new TextEncoder().encode(`self-enroll:${matchKey}`)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  const hex = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('')
  return `self-${hex.slice(0, 32)}`
}

/** A display name carrying no identifier — the participant-facing counterpart
 *  of "SONA 1232". */
export function selfEnrollDisplayName(externalId: string): string {
  return `Self-enrolled ${externalId.replace(/^self-/, '').slice(0, 8)}`
}
