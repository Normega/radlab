// Recruitment-platform placeholders that reach auto-enroll unsubstituted.
//
// SONA and Prolific build each participant's join link by substituting a token
// in the study URL: `%SURVEY_CODE%` and `{{%PROLIFIC_PID%}}`. When the token is
// mistyped (SONA's is case-sensitive) or the link is opened outside the
// platform, the literal placeholder arrives as `external_id`, and auto-enroll
// used to accept it. Every participant who arrives that way then shares ONE
// enrollment, because re-entry is keyed on (study_id, external_id): the second
// student inherits the first one's consent, contact email and schedule, and
// their answers land under the first one's profile.
//
// Not hypothetical: Liliana Study 3 holds an enrollment whose external_id is
// literally `%survey_code%`.
//
// Real ids never contain these characters -- SONA survey codes are numeric,
// Prolific PIDs are 24 hex digits -- so the rule is a character test plus the
// bare token names, rather than a whitelist of id shapes that a future platform
// could quietly break.
const PLACEHOLDER_CHARS = /[%{}<>]/
const PLACEHOLDER_NAMES = /^(survey_code|prolific_pid)$/i

export function isPlaceholderExternalId(externalId: unknown): boolean {
  const id = String(externalId ?? '').trim()
  return PLACEHOLDER_CHARS.test(id) || PLACEHOLDER_NAMES.test(id)
}
