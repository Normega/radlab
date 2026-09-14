// Credit-only consent: who is left out of a research export, and which rows go
// with them.
//
// Since 20260911_credit_only_consent.sql a study can offer a second consent
// answer: "I wish to complete the surveys for course credit, but do not consent
// to have my data used in research." Dana's CHM135 course study needed it, and
// the PI's instruction was plain — "Please don't share data from participants
// who aren't consenting to share data." Those participants still sit every
// session, so their rows land in every table exactly like anyone else's. The
// only thing that marks them is study_enrollments.consent_scope = 'credit_only'
// (NULL = recorded before the option existed = research consent), which makes
// the export the one place the choice is enforced. It is enforced in layers:
//
//   1. Their enrollments are removed before any id list is derived, so the
//      profile-, external-, session-, liliana- and parent-scoped fetches never
//      ask for their rows at all, and the master and physio ZIP (which iterate
//      the enrollment list) never see them.
//   2. Every fetched table is then filtered row by row (dropExcludedRows). This
//      is the layer that covers 'study'-scoped tables — fetched by study_id, so
//      they return every participant's rows whatever (1) removed — and it
//      re-checks the rest, so a future change to how a table is fetched cannot
//      quietly reintroduce them.
//   3. Schedule links. Self-enrolled students keep ONE account across course
//      studies (self-<hash> hashes the address, not the study), and profile-
//      scoped tables return a participant's rows from every study. So a student
//      who consented to research in PHL245 but chose credit-only in CHM135 would
//      carry their CHM135 answers into the PHL245 export. Any row whose
//      schedule_id points at a schedule row of a credit-only enrollment — here or
//      in another study — is dropped.
//
// What (3) cannot reach: a profile-scoped row with NO schedule link (demographics,
// equity census, the legacy per-game tables, video/audio sessions, screener-era
// questionnaire rows) from a participant who consented to research HERE but is
// credit-only ELSEWHERE. Nothing recorded says which study such a row came from,
// and dropping every unlinked row for that participant would discard data they
// did consent to share, so those rows are kept. The self-enrollment studies this
// option exists for write schedule-linked responses, so this is a documented
// edge rather than the common case.
//
// Pure — no Supabase import — so the rule is testable in Node
// (creditOnlyExport.test.mjs).

export const CREDIT_ONLY = 'credit_only'

export function isCreditOnly(enrollment) {
  return enrollment?.consent_scope === CREDIT_ONLY
}

const idSet = arr => new Set(arr.filter(v => v != null))

// Splits a study's resolved lookups into what a research export may use and the
// identifiers of everything it may not.
//
//   enrollments   this study's enrollments (must carry id, profile_id,
//                 external_id, consent_scope)
//   gameSessions  this study's game_sessions ({ id, user_id })
//   lilParts      this study's liliana_participants ({ id, profile_id })
//   schedule      this study's participant_schedule ({ id, participant_id })
//   stepRows      this study's participant_step_timings (with participant_id)
//   foreignScheduleIds  schedule ids of credit-only enrollments in OTHER studies
//                 held by participants kept here (see layer 3 above)
export function partitionCreditOnly({
  enrollments = [], gameSessions = [], lilParts = [], schedule = [], stepRows = [],
  foreignScheduleIds = [],
} = {}) {
  const excludedEnrollments = enrollments.filter(isCreditOnly)
  const profileIds    = idSet(excludedEnrollments.map(e => e.profile_id))
  const externalIds   = idSet(excludedEnrollments.map(e => e.external_id))
  const enrollmentIds = idSet(excludedEnrollments.map(e => e.id))

  // An identifier held by a credit-only enrollment excludes every enrollment
  // that shares it: rows are attributed by identifier, so a second enrollment
  // with the same profile or external id would otherwise re-admit those rows.
  const kept = enrollments.filter(e =>
    !isCreditOnly(e) && !profileIds.has(e.profile_id) && !externalIds.has(e.external_id))

  const keptSessions = gameSessions.filter(s => !profileIds.has(s.user_id))
  const keptLilParts = lilParts.filter(p => !profileIds.has(p.profile_id))

  const scheduleIds = idSet([
    ...schedule.filter(r => profileIds.has(r.participant_id)).map(r => r.id),
    ...foreignScheduleIds,
  ])

  const count = enrollments.length - kept.length
  return {
    enrollments:  kept,
    gameSessions: keptSessions,
    lilParts:     keptLilParts,
    // A credit-only participant's step log is their data too. The study's design
    // is still stated by everyone else's.
    stepRows:     stepRows.filter(r => !profileIds.has(r.participant_id)),
    excluded: {
      count,
      // Nothing to filter: callers skip the row pass entirely, so a study with
      // no credit-only participants exports exactly as it did before.
      active: count > 0 || scheduleIds.size > 0,
      profileIds,
      externalIds,
      enrollmentIds,
      scheduleIds,
      keptSessionIds: idSet(keptSessions.map(s => s.id)),
      keptLilPartIds: idSet(keptLilParts.map(p => p.id)),
    },
  }
}

// Schedule ids belonging to (participant, study) pairs — the credit-only
// enrollments found in other studies. Matched as pairs rather than as two
// independent id lists: a participant can be credit-only in one study and
// research in another that shares the query's study list.
export function scheduleIdsForEnrollments(pairs, scheduleRows) {
  const want = new Set(pairs.map(p => `${p.profile_id}|${p.study_id}`))
  return scheduleRows
    .filter(r => want.has(`${r.participant_id}|${r.study_id}`))
    .map(r => r.id)
}

// Whether one fetched row belongs to an excluded participant.
//
// `owner` is the registry entry's resolved { space, col } (studyExport's
// ownerOf). The test differs by space, on purpose:
//
//   profile / external  EXCLUDED if the owner is a credit-only identifier. These
//                       spaces are how 'study' tables are attributed, and those
//                       tables legitimately hold owners who are not enrolled
//                       (test accounts, a compensation row typed with an unknown
//                       id); "not in the kept list" would drop those. A row with
//                       a NULL owner cannot be a credit-only participant's — every
//                       write they make is authenticated and carries their id.
//   session / lilPart   KEPT only if the parent id is one the export kept. These
//                       tables are fetched BY those kept ids, so the membership
//                       test cannot drop a legitimate row, and it fails closed.
//   parent              KEPT only if its parent row survived the parent table's
//                       own filter (`keptParentIds`). Same reasoning.
//
// Two identifier checks apply to every table regardless of space, because the
// ids are unambiguous wherever they appear: `enrollment_id` (participant_
// compensation carries one) and the schedule link (`schedule_id`, or
// `participant_schedule_id` on step timings).
export function isExcludedRow(owner, row, excluded, keptParentIds) {
  if (row.enrollment_id != null && excluded.enrollmentIds.has(row.enrollment_id)) return true
  const sched = row.schedule_id ?? row.participant_schedule_id
  if (sched != null && excluded.scheduleIds.has(sched)) return true

  switch (owner?.space) {
    case 'profile':  return excluded.profileIds.has(row[owner.col])
    case 'external': return excluded.externalIds.has(row[owner.col])
    case 'session':  return !excluded.keptSessionIds.has(row[owner.col])
    case 'lilPart':  return !excluded.keptLilPartIds.has(row[owner.col])
    case 'parent':   return !keptParentIds?.has(row[owner.col])
    default:
      // A registry entry with no way to attribute its rows cannot be shown to
      // exclude anyone. Refuse the table (the export lists it as unreadable)
      // rather than ship it — only when there is someone to exclude, so a
      // registry mistake does not break every other study's export.
      throw new Error('cannot attribute rows to a participant, so credit-only participants could not be excluded from this table')
  }
}

export function dropExcludedRows(owner, rows, excluded, keptParentIds) {
  if (!excluded?.active) return rows
  return rows.filter(row => !isExcludedRow(owner, row, excluded, keptParentIds))
}
