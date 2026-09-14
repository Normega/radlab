// ── Study-level data export: table registry + study-scoped fetch ──────────────
//
// The study Export tab needs every participant-data table for the selected
// study, filtered to that study's participants, with empty tables dropped.
// Tables link to a study four different ways (see the registry `strategy`
// field). This module resolves a study's participants/sessions once, then
// fetches each registered table with the right key.
//
// Correctness notes:
//  • `.select('*')` — many game tables were created directly in the SQL editor
//    and have no CREATE TABLE in the repo, so we never hardcode columns.
//  • Pagination — Supabase caps a query at 1000 rows; a study with >1000 trials
//    would silently truncate without range paging. `pageAll` pages to the end.
//  • `.in()` chunking — large id lists can blow the URL length limit; `fetchIn`
//    chunks them.
//  • Per-table error isolation — a missing table or an RLS block (which returns
//    an *empty/errored* result, not an exception in the client) must not abort
//    the whole export. Errors are collected and surfaced, not swallowed.
//    (Lab-read RLS for every table below is granted by
//    supabase/migrations/20260723_export_lab_read_policies.sql — without it,
//    tables with only "own rows" policies come back empty for a lab member.)
//  • Credit-only consent — participants who did not consent to research use are
//    removed from the context and from every fetched table, and the
//    by-participant view refuses them (creditOnlyExport.js).

import { supabase } from './supabase'
import { repeatedSubcatsFromSteps, administrationSuffix, vasRepeats } from './responseColumns.js'
import { splitResubmissions, createRepeatNamer, putCell } from './exportIntegrity.js'
import { instrumentColumns } from './instrumentColumns'
import { CREDIT_ONLY, partitionCreditOnly, scheduleIdsForEnrollments, dropExcludedRows } from './creditOnlyExport.js'

const PAGE = 1000
const IN_CHUNK = 100

// ── Registry ──────────────────────────────────────────────────────────────────
// strategy: how to filter the table to a study
//   'study'    → table has its own study_id            → .eq('study_id', id)
//   'profile'  → participant profile-id column (`col`) → .in(col, profileIds)
//   'external' → participant_external_id column (`col`)→ .in(col, externalIds)
//   'session'  → session_id → game_sessions of study   → .in('session_id', gameSessionIds)
//   'liliana'  → participant_id → liliana_participants  → .in('participant_id', lilPartIds)
//   'parent'   → session_id → another fetched table     → .in(parentCol, parentRowIds)
//
// games: for a table scoped by PROFILE rather than by study, the game slugs it
//   belongs to. A profile-scoped table returns every row that participant ever
//   created anywhere on the platform, so a study that never ran the game still
//   received its data -- Sandy Study 3 exports arrived carrying Still Water and
//   FarmJoy. When the study's own step log proves it never delivered that game,
//   the table is skipped. Tables scoped by 'study', 'session' or 'parent' need
//   no such field: they are already bounded by the study.
//
// ownerSpace/ownerCol: how to attribute a row back to a participant profile_id
// (used by the combined master to compute per-participant counts). Defaults are
// derived from strategy; only 'study' tables must declare it explicitly.

export const EXPORT_TABLES = [
  // Sessions catalog
  { table: 'game_sessions',            category: 'Sessions',      label: 'Game Sessions',              strategy: 'study',    ownerSpace: 'profile',  ownerCol: 'user_id' },
  // Generic per-trial data
  { table: 'trials',                   category: 'Games',         label: 'Trials (generic)',           strategy: 'session' },
  { table: 'performance',              category: 'Games',         label: 'Performance (generic)',      strategy: 'session' },
  // Per-game tables
  { table: 'stillwater_responses',     category: 'Games',         label: 'Still Water',                strategy: 'profile',  col: 'user_id', games: ['stillwater', 'still_water'] },
  { table: 'drift_trials',             category: 'Games',         label: 'Drift — Trials',             strategy: 'session' },
  { table: 'drift_performance',        category: 'Games',         label: 'Drift — Performance',        strategy: 'session' },
  { table: 'face_read_trials',         category: 'Games',         label: 'FaceRead — Trials',          strategy: 'session' },
  { table: 'face_read_performance',    category: 'Games',         label: 'FaceRead — Performance',     strategy: 'session' },
  { table: 'farm_joy_trials',          category: 'Games',         label: 'FarmJoy — Trials',           strategy: 'session' },
  { table: 'farm_joy_performance',     category: 'Games',         label: 'FarmJoy — Performance',      strategy: 'session' },
  { table: 'farm_joy_feedback',        category: 'Games',         label: 'FarmJoy — Feedback',         strategy: 'session' },
  { table: 'farm_joy_value_history',   category: 'Games',         label: 'FarmJoy — Value History',    strategy: 'profile',  col: 'user_id', games: ['farm_joy', 'farmjoy'] },
  { table: 'word_max_sessions',        category: 'Games',         label: 'WordMax — Sessions',         strategy: 'profile',  col: 'user_id', games: ['word_max', 'wordmax'] },
  { table: 'aptitude_sessions',        category: 'Games',         label: 'Aptitude / ColorMax — Sessions', strategy: 'profile', col: 'user_id', games: ['aptitude_suite', 'color_max'] },
  { table: 'aptitude_events',          category: 'Games',         label: 'Aptitude / ColorMax — Events',   strategy: 'parent', parentTable: 'aptitude_sessions',        parentCol: 'session_id' },
  { table: 'breath_guardian_sessions', category: 'Games',         label: 'Breath Guardian — Sessions', strategy: 'session' },
  { table: 'pond_watch_results',       category: 'Games',         label: 'Pond Watch',                 strategy: 'study',    ownerSpace: 'profile',  ownerCol: 'user_id' },
  // Questionnaires
  { table: 'questionnaire_responses',  category: 'Questionnaires', label: 'Questionnaire Responses',   strategy: 'profile',  col: 'user_id' },
  // Composable instruments (likert_slider / multiple_choice / open_list /
  // open_text / hierarchy). Registered 2026-09-03 — the table shipped with the
  // 2026-08-25 integration and was written to from day one, but appeared in no
  // export registry, so every answer collected by the five standalone
  // instrument types was unreadable through the Export tab.
  { table: 'instrument_responses',     category: 'Instruments',   label: 'Instrument Responses',       strategy: 'profile',  col: 'user_id' },
  // Rating scales
  { table: 'vas_responses',            category: 'Rating scales', label: 'VAS Responses',              strategy: 'profile',  col: 'user_id' },
  // Screeners
  { table: 'screener_results',         category: 'Screeners',     label: 'Screener Results',           strategy: 'study',    ownerSpace: 'profile',  ownerCol: 'participant_id' },
  // Demographics
  { table: 'demographics',             category: 'Demographics',  label: 'Demographics',               strategy: 'profile',  col: 'user_id' },
  // Physio
  { table: 'belt_sessions',            category: 'Physio',        label: 'BreathBelt — Sessions',      strategy: 'external', col: 'participant_external_id' },
  { table: 'belt_trials',              category: 'Physio',        label: 'BreathBelt — Trials',        strategy: 'external', col: 'participant_external_id' },
  // Video
  { table: 'participant_video_sessions', category: 'Video',       label: 'Video — Sessions',           strategy: 'profile',  col: 'participant_id' },
  { table: 'participant_video_events',   category: 'Video',       label: 'Video — Events',             strategy: 'parent', parentTable: 'participant_video_sessions', parentCol: 'session_id' },
  // Audio
  { table: 'participant_audio_sessions', category: 'Audio',       label: 'Audio — Sessions',           strategy: 'profile',  col: 'participant_id' },
  { table: 'participant_audio_events',   category: 'Audio',       label: 'Audio — Events',             strategy: 'parent', parentTable: 'participant_audio_sessions', parentCol: 'session_id' },
  // Forms / bespoke
  { table: 'equity_census_responses',  category: 'Forms',         label: 'Equity Census',              strategy: 'profile',  col: 'user_id' },
  { table: 'liliana_demographics',     category: 'Forms',         label: 'Liliana Demographics',       strategy: 'profile',  col: 'user_id' },
  { table: 'participant_compensation', category: 'Forms',         label: 'Compensation',               strategy: 'study',    ownerSpace: 'external', ownerCol: 'participant_id' },
  { table: 'zerin_daily_checkins',     category: 'Forms',         label: 'Zerin Daily Check-ins',      strategy: 'study',    ownerSpace: 'profile',  ownerCol: 'user_id' },
  // Timing / assignment
  { table: 'participant_step_timings', category: 'Timing',        label: 'Step Timings',               strategy: 'study',    ownerSpace: 'profile',  ownerCol: 'participant_id' },
  { table: 'participant_assignments',  category: 'Assignments',   label: 'Condition Assignments',      strategy: 'study',    ownerSpace: 'profile',  ownerCol: 'participant_id' },
  // Training (Liliana longitudinal, Study 3)
  { table: 'intervention_responses',   category: 'Training',      label: 'Intervention Responses',     strategy: 'liliana',  col: 'participant_id' },
  { table: 'liliana_day_data',         category: 'Training',      label: 'Liliana — Day Data',         strategy: 'liliana',  col: 'participant_id' },
  { table: 'liliana_midpoint_feedback',category: 'Training',      label: 'Liliana — Midpoint Feedback', strategy: 'study',   ownerSpace: 'profile',  ownerCol: 'profile_id' },
  { table: 'liliana_participants',     category: 'Training',      label: 'Liliana — Participants',      strategy: 'study',    ownerSpace: 'profile',  ownerCol: 'profile_id' },
]

const PHYSIO_TABLES = ['belt_sessions', 'belt_trials']

// Resolve the effective ownerSpace/ownerCol for a registry entry.
function ownerOf(entry) {
  if (entry.ownerSpace) return { space: entry.ownerSpace, col: entry.ownerCol }
  switch (entry.strategy) {
    case 'profile':  return { space: 'profile',  col: entry.col }
    case 'external': return { space: 'external', col: entry.col }
    case 'session':  return { space: 'session',  col: 'session_id' }
    case 'liliana':  return { space: 'lilPart',  col: 'participant_id' }
    case 'parent':   return { space: 'parent',   col: entry.parentCol }
    default:         return { space: null, col: null }
  }
}

// ── Low-level fetch helpers ───────────────────────────────────────────────────

async function pageAll(makeQuery) {
  let from = 0
  const out = []
  for (;;) {
    const { data, error } = await makeQuery(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    out.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return out
}

async function fetchByStudy(table, studyId) {
  return pageAll((f, t) => supabase.from(table).select('*').eq('study_id', studyId).range(f, t))
}

async function fetchByIn(table, col, ids) {
  if (!ids.length) return []
  const out = []
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const chunk = ids.slice(i, i + IN_CHUNK)
    const rows = await pageAll((f, t) => supabase.from(table).select('*').in(col, chunk).range(f, t))
    out.push(...rows)
  }
  return out
}

const uniq = arr => [...new Set(arr.filter(v => v != null))]

// ── Study resolution ──────────────────────────────────────────────────────────
// One round of lookups shared by every table fetch.

// Turn a session label into a short, stable column token.
//   "Baseline" → baseline · "Midpoint Assessment" → midpoint
//   "Final Assessment" → final · "P1 Reappraisal D2" → p1_reappraisal_d2
function timepointToken(label, dayNumber) {
  const s = String(label ?? '').toLowerCase()
  if (s.includes('baseline')) return 'baseline'
  if (s.includes('midpoint')) return 'midpoint'
  if (s.includes('final'))    return 'final'
  const cleaned = s.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  return cleaned || `d${dayNumber ?? 0}`
}

// Schedule ids of credit-only enrollments in OTHER studies held by participants
// this export keeps. Profile-scoped tables return a participant's rows from every
// study, and a self-enrolled student keeps one account across course studies, so
// without this their credit-only answers elsewhere would ride into this export
// (creditOnlyExport.js, layer 3). Errors propagate: an export that cannot check
// consent must not be produced.
async function foreignCreditOnlyScheduleIds(studyId, profileIds) {
  const pairs = []
  for (let i = 0; i < profileIds.length; i += IN_CHUNK) {
    const chunk = profileIds.slice(i, i + IN_CHUNK)
    pairs.push(...await pageAll((f, t) => supabase.from('study_enrollments')
      .select('profile_id, study_id').in('profile_id', chunk)
      .eq('consent_scope', CREDIT_ONLY).neq('study_id', studyId).range(f, t)))
  }
  if (!pairs.length) return []
  const studyIds = uniq(pairs.map(p => p.study_id))
  const pids     = uniq(pairs.map(p => p.profile_id))
  const rows = []
  for (let i = 0; i < pids.length; i += IN_CHUNK) {
    const chunk = pids.slice(i, i + IN_CHUNK)
    rows.push(...await pageAll((f, t) => supabase.from('participant_schedule')
      .select('id, participant_id, study_id').in('study_id', studyIds).in('participant_id', chunk).range(f, t)))
  }
  return scheduleIdsForEnrollments(pairs, rows)
}

export async function resolveStudyContext(studyId) {
  const [allEnrollments, allGameSessions, allLilParts, vasScales, instrumentDefs, schedule, sessions, studyRow, allStepRows] = await Promise.all([
    // consent_scope and id feed the credit-only exclusion below; no .catch here,
    // deliberately — if consent cannot be read, the export must fail rather than
    // go out unfiltered.
    pageAll((f, t) => supabase.from('study_enrollments')
      .select('id, profile_id, external_id, enrolled_at, consent_date, consent_scope, status, is_test')
      .eq('study_id', studyId).range(f, t)),
    pageAll((f, t) => supabase.from('game_sessions')
      .select('id, user_id').eq('study_id', studyId).range(f, t)),
    // liliana_participants is itself study-scoped; tolerate its absence
    pageAll((f, t) => supabase.from('liliana_participants')
      .select('id, profile_id').eq('study_id', studyId).range(f, t)).catch(() => []),
    // Reference lookup so vas_responses (which stores scale_id) can be reported
    // under human-readable slugs in the master. Small table; tolerate absence.
    supabase.from('vas_scales').select('id, slug').then(r => r.data ?? []).catch(() => []),
    // Instrument definitions, needed for ONE thing the response cannot supply:
    // a multi-select multiple choice records only the options that were CHOSEN,
    // so without the option list an unselected option is indistinguishable from
    // one that was never offered. With it, every option gets an explicit 0/1.
    // Everything else is read off the response itself. Tolerate absence — the
    // wide block degrades to selected-only columns rather than failing.
    supabase.from('composable_instruments').select('slug, type, config')
      .then(r => r.data ?? []).catch(() => []),
    // The schedule is what turns a rating into a STUDY DAY. Without it the
    // master can only count occurrences, which is what made the old _t<n>
    // columns drift apart (see vasWideByProfile).
    pageAll((f, t) => supabase.from('participant_schedule')
      .select('id, participant_id, study_day, study_session_id')
      .eq('study_id', studyId).range(f, t)).catch(() => []),
    pageAll((f, t) => supabase.from('study_sessions')
      .select('id, label, day_number, session_template_id')
      .eq('study_id', studyId).range(f, t)).catch(() => []),
    // The screener administers questionnaires too, BEFORE any session exists.
    supabase.from('studies').select('screener_id, screener').eq('id', studyId).maybeSingle()
      .then(r => r.data ?? null).catch(() => null),
    // What this study actually put in front of participants. The step log is
    // the authority: it is written per delivered step and carries the study id,
    // so it states the study's activity list as a fact rather than a guess.
    pageAll((f, t) => supabase.from('participant_step_timings')
      .select('category, subcategory, step_index, participant_schedule_id, participant_id')
      .eq('study_id', studyId).range(f, t)).catch(() => []),
  ])

  // Credit-only consent (20260911_credit_only_consent.sql): participants who
  // completed the sessions for course credit but did not consent to research use
  // leave the export HERE, before a single id list is derived from the
  // enrollments — so no fetch below asks for their rows, and the master and
  // physio ZIP, which iterate `enrollments`, never list them. fetchStudyData
  // then filters every table by row owner as well. See creditOnlyExport.js.
  const foreignScheduleIds = await foreignCreditOnlyScheduleIds(
    studyId,
    uniq(allEnrollments.filter(e => e.consent_scope !== CREDIT_ONLY).map(e => e.profile_id)),
  )
  const consent = partitionCreditOnly({
    enrollments:  allEnrollments,
    gameSessions: allGameSessions,
    lilParts:     allLilParts,
    schedule,
    stepRows:     allStepRows,
    foreignScheduleIds,
  })
  const { enrollments, gameSessions, lilParts, stepRows } = consent

  // Which assessment sessions administer which questionnaire, in day order.
  // questionnaire_responses carries no session link (session_id is null on
  // every row), so the master infers a response's timepoint from the study
  // DESIGN: the nth time a participant answers instrument X is the nth session
  // in the protocol that administers X.
  const templateIds = uniq(sessions.map(s => s.session_template_id))
  let slugTimepoints = new Map()
  try {
    const nodes = await fetchByIn('session_template_nodes', 'session_template_id', templateIds)
    const qIds  = uniq(nodes.map(n => n.questionnaire_id))
    const qRows = await fetchByIn('questionnaires', 'id', qIds)
    const slugById = new Map(qRows.map(q => [q.id, q.slug]))
    const byTemplate = {}
    for (const n of nodes) {
      if (!n.questionnaire_id) continue
      ;(byTemplate[n.session_template_id] ??= []).push(slugById.get(n.questionnaire_id))
    }
    // The screener runs at intake, before consent and before any session, and
    // writes ordinary `questionnaire_responses` rows. Liliana's study screens on
    // GAD-7 and PHQ-8, so those instruments have THREE collection points
    // (screener → midpoint → final) while only two appear in the session
    // templates. Omitting the screener shifted every later label by one: the
    // intake response was named `_midpoint` and the midpoint response `_final`,
    // for a participant who never sat a final assessment at all. Found
    // 2026-08-18 when a participant whose Final Assessment status was 'missed'
    // still exported `gad7_final_*` values.
    const screenerSlugs = []
    {
      let def = null
      if (studyRow?.screener_id) {
        const { data } = await supabase.from('screeners').select('definition')
          .eq('id', studyRow.screener_id).maybeSingle()
        def = data?.definition ?? null
      }
      def = def ?? studyRow?.screener ?? null
      const walk = node => {
        if (!node || typeof node !== 'object') return
        if (Array.isArray(node)) { node.forEach(walk); return }
        if (typeof node.questionnaire_slug === 'string') screenerSlugs.push(node.questionnaire_slug)
        Object.values(node).forEach(walk)
      }
      walk(def)
    }

    const ordered = [...sessions].sort((a, b) => (a.day_number ?? 0) - (b.day_number ?? 0))
    const acc = {}
    // Screener first, once per slug however many times it appears in the
    // screener definition (it is asked in both screener phases).
    for (const slug of [...new Set(screenerSlugs)]) (acc[slug] ??= []).push('screener')
    for (const s of ordered) {
      for (const slug of byTemplate[s.session_template_id] ?? []) {
        if (!slug) continue
        ;(acc[slug] ??= []).push(timepointToken(s.label, s.day_number))
      }
    }
    slugTimepoints = new Map(Object.entries(acc))
  } catch { /* design lookup is best-effort; falls back to occurrence numbering */ }

  const externalToProfile = new Map()
  const profileToExternal = new Map()
  for (const e of enrollments) {
    if (e.external_id != null) externalToProfile.set(e.external_id, e.profile_id ?? null)
    if (e.profile_id != null)  profileToExternal.set(e.profile_id, e.external_id ?? null)
  }
  const gameSessionById = new Map(gameSessions.map(s => [s.id, s]))
  const lilPartById     = new Map(lilParts.map(p => [p.id, p]))
  const sessionById     = new Map(sessions.map(s => [s.id, s]))

  // A study with no step timings at all is not step-delivered, so its activity
  // list is unknown and nothing may be skipped on the strength of it.
  const stepGameSlugs = new Set(
    stepRows.filter(r => r.category === 'game' && r.subcategory).map(r => r.subcategory),
  )

  // Instruments this study administers MORE THAN ONCE inside a single session.
  //
  // Those need a within-session coordinate in their column name, because
  // schedule_id, study day and session label are all identical across the
  // repeats — so every one of them resolves to the same column and the last
  // written wins. That is how Sandy Study 3's three stress ratings arrived in
  // the CSV as one value (the rows were all there; the export flattened them).
  //
  // Decided per STUDY, not per participant: the suffix is applied to everyone's
  // columns for that instrument, including a participant who only reached the
  // first administration. Deciding per participant is what makes columns drift
  // apart between rows, which is the defect rule 3 exists to prevent.
  const repeatedSubcats = repeatedSubcatsFromSteps(stepRows)

  return {
    studyId,
    hasStepLog: stepRows.length > 0,
    stepGameSlugs,
    repeatedSubcats,
    enrollments,
    // How many enrollments were left out for credit-only consent, for the
    // Export tab and the codebook to state; `consentExclusion` drives the
    // per-row filter in fetchStudyData.
    excludedCreditOnly: consent.excluded.count,
    consentExclusion:   consent.excluded,
    profileIds:     uniq(enrollments.map(e => e.profile_id)),
    externalIds:    uniq(enrollments.map(e => e.external_id)),
    gameSessionIds: gameSessions.map(s => s.id),
    lilPartIds:     lilParts.map(p => p.id),
    externalToProfile,
    profileToExternal,
    gameSessionById,
    lilPartById,
    sessionById,
    scheduleById:     new Map(schedule.map(r => [r.id, r])),
    slugTimepoints,
    vasScaleSlugById: new Map(vasScales.map(s => [s.id, s.slug])),
    instrumentBySlug: new Map((instrumentDefs ?? []).map(i => [i.slug, i])),
  }
}

// ── Per-table fetch ───────────────────────────────────────────────────────────
// `resultsByTable` lets 'parent' (event) tables reach their already-fetched
// parent rows. Non-parent tables must be fetched before parent tables.

async function fetchTable(entry, ctx, resultsByTable) {
  switch (entry.strategy) {
    case 'study':    return fetchByStudy(entry.table, ctx.studyId)
    case 'profile':  return fetchByIn(entry.table, entry.col, ctx.profileIds)
    case 'external': return fetchByIn(entry.table, entry.col, ctx.externalIds)
    case 'session':  return fetchByIn(entry.table, 'session_id', ctx.gameSessionIds)
    case 'liliana':  return fetchByIn(entry.table, entry.col, ctx.lilPartIds)
    case 'parent': {
      const parentRows = resultsByTable[entry.parentTable] ?? []
      const parentIds  = parentRows.map(r => r.id)
      return fetchByIn(entry.table, entry.parentCol, parentIds)
    }
    default: return []
  }
}

// Fetch every registry table for a study. Returns:
//   { context, tables: [{ ...entry, rows }], errors: [{ table, message }] }
// Only non-empty tables are included in `tables`; per-table errors are isolated.
export async function fetchStudyData(studyId, onProgress = () => {}) {
  const context = await resolveStudyContext(studyId)
  const resultsByTable = {}
  const errors = []

  // Drop profile-scoped game tables for games this study never ran. Skipped
  // before fetching, so the export is faster as well as cleaner. Guarded on
  // hasStepLog: without a step log we cannot prove a game was NOT delivered,
  // and silently dropping real data is far worse than carrying extra columns.
  const skipped = []
  const wanted = EXPORT_TABLES.filter(entry => {
    if (!entry.games || !context.hasStepLog) return true
    if (entry.games.some(g => context.stepGameSlugs.has(g))) return true
    skipped.push({ table: entry.table, label: entry.label, games: entry.games })
    return false
  })

  // Parents (everything non-'parent') first, so 'parent' tables can resolve ids.
  const parents  = wanted.filter(e => e.strategy !== 'parent')
  const children = wanted.filter(e => e.strategy === 'parent')

  async function run(entry) {
    onProgress(`Fetching ${entry.label}…`)
    try {
      const rows = await fetchTable(entry, context, resultsByTable)
      // Credit-only participants' rows out of EVERY table, as each arrives. It
      // has to happen here rather than after the loop: 'parent' tables fetch by
      // their parent's row ids, so a parent must already be filtered when its
      // children are requested. A throw (an entry whose rows cannot be
      // attributed) lands in `errors` and the table is withheld, not shipped.
      const keptParentIds = entry.strategy === 'parent'
        ? new Set((resultsByTable[entry.parentTable] ?? []).map(r => r.id))
        : undefined
      resultsByTable[entry.table] = dropExcludedRows(ownerOf(entry), rows, context.consentExclusion, keptParentIds)
    } catch (e) {
      resultsByTable[entry.table] = []
      errors.push({ table: entry.table, message: e?.message ?? String(e) })
    }
  }

  await Promise.all(parents.map(run))
  await Promise.all(children.map(run))

  const tables = wanted
    .map(entry => ({ ...entry, rows: resultsByTable[entry.table] ?? [] }))
    .filter(t => t.rows.length > 0)

  return { context, tables, errors, resultsByTable, skipped }
}

// Whether the study has any physio (BreathBelt) rows — drives the Physio button.
export function hasPhysio(resultsByTable) {
  return PHYSIO_TABLES.some(t => (resultsByTable[t]?.length ?? 0) > 0)
}

// ── Participant-scoped fetch (the by-participant search) ──────────────────────
// Same registry as the study export, filtered to ONE participant instead of a
// study. Study-scoped tables are reached through their per-participant owner
// column, so no study id is needed — a participant in several studies gets all
// of their rows.
//
// Why this exists: the by-participant view used to be a hardcoded list of six
// sections (demographics, Still Water, belt sessions/trials/physio,
// questionnaires) written before the registry. For an online participant that
// rendered five permanently-empty BreathBelt/in-person cards while silently
// omitting everything they actually generated — equity census, VAS, games, step
// timings, assignments, video, audio, compensation.
//
// A participant who chose credit-only consent in ANY study is refused outright
// (2026-09-11). This view is deliberately study-agnostic — it returns every row
// the person generated anywhere — and most profile-scoped tables record no study,
// so a credit-only study's rows cannot be reliably carved out of it. Refusing is
// the simplest rule that cannot leak. The cost: someone credit-only in one study
// and research-consenting in another cannot be exported from here; their
// research study's own Study-Level Export still includes them.
async function assertNotCreditOnly(profileId, externalId) {
  const lookups = []
  if (profileId != null) {
    lookups.push(supabase.from('study_enrollments').select('study_id')
      .eq('profile_id', profileId).eq('consent_scope', CREDIT_ONLY).limit(1))
  }
  // Checked by external id too: the external-scoped tables (BreathBelt) are
  // fetched by it, so it is an identity this view acts on.
  if (externalId != null) {
    lookups.push(supabase.from('study_enrollments').select('study_id')
      .eq('external_id', externalId).eq('consent_scope', CREDIT_ONLY).limit(1))
  }
  for (const { data, error } of await Promise.all(lookups)) {
    // Fail closed: a view that cannot confirm consent does not load.
    if (error) throw new Error(`Could not check this participant's consent, so their data was not loaded (${error.message}).`)
    if (data?.length) {
      throw new Error(
        'This participant chose credit-only consent: they completed the study for course credit but did not consent to research use of their data, so it cannot be exported.')
    }
  }
}

export async function fetchParticipantData(profileId, externalId, onProgress = () => {}) {
  await assertNotCreditOnly(profileId, externalId)
  const [gameSessions, lilParts] = await Promise.all([
    profileId
      ? pageAll((f, t) => supabase.from('game_sessions')
          .select('id, user_id').eq('user_id', profileId).range(f, t)).catch(() => [])
      : [],
    profileId
      ? pageAll((f, t) => supabase.from('liliana_participants')
          .select('id, profile_id').eq('profile_id', profileId).range(f, t)).catch(() => [])
      : [],
  ])

  const idsFor = {
    profile:  profileId   != null ? [profileId]   : [],
    external: externalId  != null ? [externalId]  : [],
    session:  gameSessions.map(s => s.id),
    lilPart:  lilParts.map(p => p.id),
  }

  const resultsByTable = {}
  const errors = []

  async function fetchOne(entry) {
    switch (entry.strategy) {
      case 'profile':  return fetchByIn(entry.table, entry.col, idsFor.profile)
      case 'external': return fetchByIn(entry.table, entry.col, idsFor.external)
      case 'session':  return fetchByIn(entry.table, 'session_id', idsFor.session)
      case 'liliana':  return fetchByIn(entry.table, entry.col, idsFor.lilPart)
      case 'study': {
        // Study-scoped tables still carry a per-participant owner column; use it
        // directly so the participant view needs no study selection.
        const { space, col } = ownerOf(entry)
        if (!col) return []
        return fetchByIn(entry.table, col, space === 'external' ? idsFor.external : idsFor.profile)
      }
      case 'parent': {
        const parentRows = resultsByTable[entry.parentTable] ?? []
        return fetchByIn(entry.table, entry.parentCol, parentRows.map(r => r.id))
      }
      default: return []
    }
  }

  async function run(entry) {
    onProgress(`Fetching ${entry.label}…`)
    try {
      resultsByTable[entry.table] = await fetchOne(entry)
    } catch (e) {
      resultsByTable[entry.table] = []
      errors.push({ table: entry.table, message: e?.message ?? String(e) })
    }
  }

  // Parents first so 'parent' (event) tables can resolve their ids.
  await Promise.all(EXPORT_TABLES.filter(e => e.strategy !== 'parent').map(run))
  await Promise.all(EXPORT_TABLES.filter(e => e.strategy === 'parent').map(run))

  const tables = EXPORT_TABLES
    .map(entry => ({ ...entry, rows: resultsByTable[entry.table] ?? [] }))
    .filter(t => t.rows.length > 0)

  return { tables, errors, resultsByTable }
}

// ── Row → participant attribution (for the combined master) ───────────────────

function rowOwnerProfileId(entry, row, ctx, resultsByTableById) {
  const { space, col } = ownerOf(entry)
  switch (space) {
    case 'profile':  return row[col] ?? null
    case 'external': return ctx.externalToProfile.get(row[col]) ?? null
    case 'session': {
      const s = ctx.gameSessionById.get(row.session_id)
      return s ? s.user_id : null
    }
    case 'lilPart': {
      const p = ctx.lilPartById.get(row.participant_id)
      return p ? p.profile_id : null
    }
    case 'parent': {
      const parentEntry = EXPORT_TABLES.find(e => e.table === entry.parentTable)
      const pr = resultsByTableById[entry.parentTable]?.get(row[entry.parentCol])
      return pr && parentEntry ? rowOwnerProfileId(parentEntry, pr, ctx, resultsByTableById) : null
    }
    default: return null
  }
}

// ── Combined participant-level master (one row per participant) ────────────────

const OMIT_COLS = new Set([
  'id', 'user_id', 'participant_id', 'profile_id', 'study_id',
  'enrollment_id', 'schedule_id', 'participant_schedule_id', 'session_id',
  'participant_external_id', 'external_id', 'created_at',
])

function mergePrefixed(target, prefix, srcRow) {
  if (!srcRow) return
  for (const [k, v] of Object.entries(srcRow)) {
    if (OMIT_COLS.has(k)) continue
    target[`${prefix}_${k}`] = (v && typeof v === 'object') ? JSON.stringify(v) : v
  }
}

// Equity-census answers live inside a `responses` jsonb (not top-level columns),
// so they are flattened by mergeJsonResponses under the `eq` prefix: arrays →
// "a; b", nested objects → JSON, scalars pass through. This is the demographic
// intake online studies use in place of the classic demographics step, so its
// fields belong in the per-participant master row — not just a participation count.

// Checklist questionnaire items store an object; export the weighted value.
// The flattening the equity census (`eq`) uses, under a caller-chosen prefix, for
// any instrument that stores its answers as a `responses` jsonb blob rather
// than as top-level columns. Arrays join to "a; b" so a multi-select stays
// readable in a spreadsheet; nested objects (e.g. race sub-specifications)
// serialise to JSON rather than being dropped.
function mergeJsonResponses(target, prefix, srcRow) {
  if (!srcRow?.responses) return
  for (const [k, v] of Object.entries(srcRow.responses)) {
    target[`${prefix}_${k}`] = Array.isArray(v) ? v.join('; ')
      : (v && typeof v === 'object') ? JSON.stringify(v)
      : (v ?? '')
  }
}

function responseScalar(v) {
  return (v && typeof v === 'object') ? (v.response_value ?? JSON.stringify(v)) : v
}

function normalizeSlug(slug) {
  return String(slug)
    .replace('brief-maia-2', 'maia2')
    .replace('barq-r', 'barqr')
    .replace('phq-4', 'phq4')
    .replace(/-/g, '')
}

// Duplicate submissions are no longer DROPPED here.
//
// This used to keep only the LAST row of any burst of the same instrument, with a
// window of two minutes measured on participant clocks — which were off by up to
// an hour in Sandy Study 3. A genuine re-answer inside that window vanished from
// the master. Rows are now separated by `splitResubmissions` (exportIntegrity.js):
// only provable copies are set aside — flagged `resubmission_of` by the database,
// or identical legacy rows seconds apart with nothing collected in between — and
// every one set aside is listed in `_export_integrity.csv`. A double-fire still
// cannot shift a participant's later timepoints, because the copy is set aside
// before occurrence counting.

// What the wide blocks share for one export: the repeat namer, and the record of
// every copy omitted and every collision caught.
function exportTools() {
  return { namer: createRepeatNamer(), integrity: { omitted: [], collisions: [] } }
}

function noteOmitted(tools, table, rows, subjectOf) {
  if (!tools) return
  for (const r of rows) {
    tools.integrity.omitted.push({
      table,
      row_id: r.id,
      participant: subjectOf(r),
      resubmission_of: r.resubmission_of ?? '(legacy row identical to the one before it, within 5 s)',
    })
  }
}

// A cell writer that never replaces an existing cell (CLAUDE.md rule 5).
function cellWriter(tools, table, pid) {
  return (target, column, value) => putCell(target, column, value, c => {
    if (tools) tools.integrity.collisions.push({ table, participant: pid, ...c })
  })
}

// Wide questionnaire block, keyed by profile_id → { <slug>_<timepoint>_<item> }.
//
// Columns are named for the STUDY TIMEPOINT a response belongs to
// (`gad7_midpoint_1`, `bfi2s_baseline_7`), not for how many times that
// participant happened to answer. The previous scheme suffixed `_t<n>` by
// occurrence, which meant `gad7_t1` was the MIDPOINT — GAD-7 is not administered
// at baseline — and any participant who missed or repeated a session had every
// later column shifted relative to everyone else's.
//
// `questionnaire_responses.session_id` is null on every row, so the timepoint is
// inferred from the study DESIGN: `ctx.slugTimepoints` lists, in day order, the
// sessions that administer each instrument, and the nth response maps to the nth
// such session. That is exact whenever a participant's responses are in protocol
// order, which is why provable copies are set aside first. Responses beyond the
// designed number of administrations fall back to `_x<n>` rather than inventing a
// timepoint they cannot be shown to belong to. A further response that still
// names the same block is kept under `_r2` — never written over.
function questionnaireWideByProfile(qRows, ctx, tools) {
  // The step is part of the identity of a variable: two answers to the same
  // instrument at different steps of one session are two variables.
  const { kept: rows, omitted } = splitResubmissions(qRows, {
    subjectOf: r => r.user_id,
    keyOf:     r => `${r.questionnaire_slug}|${r.schedule_id ?? ''}|${r.step_index ?? ''}`,
    payloadOf: r => JSON.stringify(r.responses ?? null),
    timeOf:    r => new Date(r.received_at ?? r.completed_at ?? 0).getTime(),
  })
  noteOmitted(tools, 'questionnaire_responses', omitted, r => r.user_id)
  const byProfile = {}
  const occ = {}
  for (const r of rows) {
    const pid = r.user_id
    if (pid == null) continue
    if (!byProfile[pid]) byProfile[pid] = {}
    const slug = r.questionnaire_slug
    const key  = `${pid}::${slug}`
    const n    = (occ[key] = (occ[key] ?? 0) + 1)

    // RECORDED beats inferred. Since 20260818_questionnaire_schedule_link a
    // response carries the schedule row that collected it, so the timepoint is
    // read off the session rather than guessed from protocol order. Inference
    // only covers rows predating that column, and rows that legitimately have
    // no session — screener responses, which run pre-consent.
    const sched   = r.schedule_id ? ctx?.scheduleById?.get(r.schedule_id) : null
    const session = sched ? ctx?.sessionById?.get(sched.study_session_id) : null
    const tps  = ctx?.slugTimepoints?.get(slug) ?? []
    const label = session
      ? timepointToken(session.label, session.day_number)
      : (tps[n - 1] ?? `x${n}`)
    // Even a single-administration instrument names its timepoint, so a column
    // is self-describing without consulting the protocol.
    // An instrument administered more than once inside a session needs the step
    // to tell the administrations apart — session label, day and schedule_id are
    // identical across all of them, so without it they all name the same column
    // and only the last survives. `_sN` is the recorded step position, which is
    // the same protocol point for every participant; where no step was recorded
    // the marker is explicitly non-committal rather than a plausible guess.
    const stepSuffix = administrationSuffix({
      repeats:   ctx?.repeatedSubcats?.has(slug) ?? false,
      stepIndex: r.step_index,
      ordinal:   n,
    })
    const basePrefix = `${normalizeSlug(slug)}_${label}${stepSuffix}`
    const prefix = tools
      ? tools.namer.name(pid, basePrefix, { table: 'questionnaire_responses', row_id: r.id })
      : basePrefix
    const put = cellWriter(tools, 'questionnaire_responses', pid)
    for (const [rawKey, val] of Object.entries(r.responses ?? {})) {
      const cleanKey = rawKey.replace(/^item_/, '')
      const m = cleanKey.match(/(\d+)$/)
      const colName = m ? `${prefix}_${m[1]}` : `${prefix}_${cleanKey}`
      put(byProfile[pid], colName, responseScalar(val))
    }
  }
  return byProfile
}

// Wide VAS block, keyed by profile_id → { vas_<slug>[_pre|_post]_d<day> }.
//
// Named by the STUDY DAY the rating was given on and by which side of the
// practice it came from. Both are exact rather than inferred: `vas_responses`
// carries `schedule_id` (→ `participant_schedule.study_day`) and `package_slug`
// (pre/post) since WP-L1.
//
// This replaces `_t<n>` occurrence numbering, which was actively misleading on
// longitudinal data. `stress` is asked twice a day and `sleep` once, so their
// indices desynchronised immediately; and every partially-completed session — a
// participant who did the pre check-in and abandoned before the post — pushed
// the daily and post-only scales further out of step. In the live test one
// participant had 20 `sleep` ratings against 16 `helpful`, so `vas_sleep_t20`
// and `vas_helpful_t16` were the same day while sharing no index. Read as days,
// those columns silently mismatched rows.
//
// Rows whose `schedule_id` is not in this study are DROPPED: `vas_responses` is
// fetched by user_id, so a participant enrolled in two studies would otherwise
// have the other study's ratings merged into this export.
function vasWideByProfile(vasRows, scaleSlugById, ctx, tools) {
  const byProfile = {}
  const unscheduled = []
  // Provable copies set aside. `kept` comes back in time order, so the fallback
  // counter below numbers by time rather than by whatever order rows were fetched.
  const { kept: scheduledRows, omitted } = splitResubmissions(vasRows, {
    subjectOf: r => r.user_id,
    keyOf:     r => `${r.scale_id}|${r.schedule_id ?? ''}|${r.step_index ?? ''}|${r.package_slug ?? ''}`,
    payloadOf: r => String(r.value),
    timeOf:    r => new Date(r.received_at ?? r.responded_at ?? 0).getTime(),
  })
  noteOmitted(tools, 'vas_responses', omitted, r => r.user_id)
  const stepless = {}

  for (const r of scheduledRows) {
    const pid = r.user_id
    if (pid == null) continue
    const sched = r.schedule_id ? ctx?.scheduleById?.get(r.schedule_id) : null
    if (r.schedule_id && !sched) continue          // belongs to another study
    if (!sched) { unscheduled.push(r); continue }  // pre-WP-L1 row, handled below

    const rawSlug = scaleSlugById.get(r.scale_id) ?? r.scale_id ?? 'unknown'
    const slug  = normalizeSlug(rawSlug)
    const pkg   = String(r.package_slug ?? '')
    const phase = pkg.includes('pre') ? '_pre' : pkg.includes('post') ? '_post' : ''

    // A scale asked more than once in one session (Sandy Study 3 asks stress at
    // three points of a single sitting) has the SAME day, package and schedule
    // on every rating, so day-naming alone put all three in one column and kept
    // only the last. The step is the within-session coordinate that separates
    // them, and it is a protocol position — every participant's step 19 is the
    // same moment — not an occurrence count that drifts when someone drops out.
    const repeats = vasRepeats(ctx?.repeatedSubcats, rawSlug, r.package_slug)
    // Ordinal is only consulted when the step is unknown; counted per
    // participant/scale/day so the fallback markers stay distinct.
    const k = `${pid}\u0000${slug}${phase}\u0000${sched.study_day}`
    const stepSuffix = administrationSuffix({
      repeats,
      stepIndex: r.step_index,
      ordinal:   repeats && r.step_index == null
        ? (stepless[k] = (stepless[k] ?? 0) + 1)
        : null,
    })

    if (!byProfile[pid]) byProfile[pid] = {}
    const base = `vas_${slug}${phase}_d${sched.study_day}${stepSuffix}`
    const col  = tools ? tools.namer.name(pid, base, { table: 'vas_responses', row_id: r.id }) : base
    cellWriter(tools, 'vas_responses', pid)(byProfile[pid], col, r.value)
  }

  // Legacy rows with no schedule link cannot be placed on a day. They keep
  // occurrence numbering under an explicit `_unscheduled_` marker so they can
  // never be mistaken for day-indexed columns.
  const occ = {}
  const byTime = unscheduled
  for (const r of byTime) {
    const pid  = r.user_id
    const slug = normalizeSlug(scaleSlugById.get(r.scale_id) ?? r.scale_id ?? 'unknown')
    const key  = `${pid}::${slug}`
    const n    = (occ[key] = (occ[key] ?? 0) + 1)
    if (!byProfile[pid]) byProfile[pid] = {}
    cellWriter(tools, 'vas_responses', pid)(byProfile[pid], `vas_${slug}_unscheduled_${n}`, r.value)
  }
  return byProfile
}

// Wide composable-instrument block, keyed by profile_id.
//
// Timepoint naming follows the questionnaire block: `instrument_responses`
// carries `schedule_id` from the day it was created, so the session is a
// RECORDED fact and the column is named from it (`<slug>_<timepoint>`). A row
// with no schedule link cannot be placed, so it falls back to an explicitly
// non-committal `_x<n>` rather than a plausible-looking timepoint.
//
// Rows whose `schedule_id` belongs to another study are dropped — the table is
// fetched by `user_id`, so a participant enrolled twice would otherwise carry
// the other study's answers into this export.
//
// The five response shapes each flatten differently, and the shape is read from
// the recorded `instrument_type` rather than sniffed from the value:
//
//   likert_slider  <slug>_<tp>                    the numeric value
//   open_text      <slug>_<tp>                    the text as typed
//   multiple_choice
//     single       <slug>_<tp>                    chosen option id
//                  <slug>_<tp>_value              inline text/number entry, if any
//     multi        <slug>_<tp>_<option>           1/0 per option, from the
//                                                 definition so unselected is a
//                                                 real 0 and not a blank
//                  <slug>_<tp>_selected           "a; b" for a readable summary
//                  <slug>_<tp>_<option>_value     inline entry, if any
//   open_list      <slug>_<tp>_<n>_factor         nth entry (index IS recorded —
//                  <slug>_<tp>_<n>_contribution   the list is ordered)
//                  <slug>_<tp>_count
//   hierarchy      <slug>_<tp>_<belief>_changed   1/0, belief ids from the row
//                  <slug>_<tp>_<belief>_direction signed slider, null if unchanged
function instrumentWideByProfile(rows, ctx, tools) {
  const byProfile = {}
  const occ = {}

  // Provable copies set aside; the rest in time order, which decides what `_x<n>`
  // counts for rows with no schedule to name. A participant who re-enters the
  // SAME session and answers again keeps BOTH answers: the later one lands under
  // `_r2` instead of replacing the first.
  const { kept: ordered, omitted } = splitResubmissions(rows, {
    subjectOf: r => r.user_id,
    keyOf:     r => `${r.instrument_id ?? r.instrument_slug}|${r.schedule_id ?? ''}|${r.step_index ?? ''}`,
    payloadOf: r => JSON.stringify(r.response ?? null),
    timeOf:    r => new Date(r.received_at ?? r.responded_at ?? 0).getTime(),
  })
  noteOmitted(tools, 'instrument_responses', omitted, r => r.user_id)

  for (const r of ordered) {
    const pid = r.user_id
    if (pid == null) continue

    const sched = r.schedule_id ? ctx?.scheduleById?.get(r.schedule_id) : null
    if (r.schedule_id && !sched) continue          // belongs to another study

    const slug    = normalizeSlug(r.instrument_slug ?? 'unknown')
    const session = sched ? ctx?.sessionById?.get(sched.study_session_id) : null
    const key     = `${pid}::${slug}`
    const n       = (occ[key] = (occ[key] ?? 0) + 1)
    const tp      = session ? timepointToken(session.label, session.day_number) : `x${n}`
    const base    = `${slug}_${tp}`
    const prefix  = tools ? tools.namer.name(pid, base, { table: 'instrument_responses', row_id: r.id }) : base

    const out = (byProfile[pid] ??= {})
    const def = ctx?.instrumentBySlug?.get(r.instrument_slug) ?? null
    const put = cellWriter(tools, 'instrument_responses', pid)
    for (const [col, value] of Object.entries(instrumentColumns(prefix, r.instrument_type, r.response, def))) {
      put(out, col, value)
    }
  }

  return byProfile
}

// Every row per participant for the participant-level tables, earliest first.
// These are "usually one row" tables — demographics, equity census, screener,
// compensation — and the master used to broadcast only the FIRST, so a second
// row (a retaken screener, a corrected census) never reached it. The first row
// keeps the plain prefix; each later one gets `<prefix>_r<n>`. Database-flagged
// copies are left out.
function rowsByProfile(entry, rows, ctx, resultsByTableById) {
  const map = new Map()
  const when = r => new Date(r.received_at ?? r.completed_at ?? r.screened_at ?? r.created_at ?? 0).getTime()
  const ordered = rows
    .filter(r => !r.resubmission_of)
    .map((r, i) => ({ r, i }))
    .sort((a, b) => (when(a.r) - when(b.r)) || (a.i - b.i))
    .map(x => x.r)
  for (const row of ordered) {
    const pid = rowOwnerProfileId(entry, row, ctx, resultsByTableById)
    if (pid == null) continue
    if (!map.has(pid)) map.set(pid, [])
    map.get(pid).push(row)
  }
  return map
}

// Build the master: one row per enrolled participant.
//  • participant-level tables broadcast their columns (prefixed); a further row
//    for the same participant is kept as `<prefix>_r2_*`, never dropped
//  • questionnaires, instruments and ratings spread wide (one column per item)
//  • every data table contributes a `<table>_n` participation count
//
// Nothing collected is lost on the way in. The only rows left out are provable
// copies (exportIntegrity.js), and every omission, repeat and collision comes
// back in `integrity`, for `_export_integrity.csv`.
export function buildMasterWithIntegrity(context, resultsByTable) {
  const tools = exportTools()
  const byId = {}
  for (const [table, rows] of Object.entries(resultsByTable)) {
    byId[table] = new Map(rows.map(r => [r.id, r]))
  }
  const entryOf = t => EXPORT_TABLES.find(e => e.table === t)

  // per-table participation counts, keyed by profile_id
  const countByTable = {}
  for (const entry of EXPORT_TABLES) {
    const rows = resultsByTable[entry.table] ?? []
    if (!rows.length) continue
    const m = new Map()
    for (const row of rows) {
      const pid = rowOwnerProfileId(entry, row, context, byId)
      if (pid == null) continue
      m.set(pid, (m.get(pid) ?? 0) + 1)
    }
    if (m.size) countByTable[entry.table] = m
  }

  const dem  = rowsByProfile(entryOf('demographics'),         resultsByTable.demographics ?? [],         context, byId)
  const eq   = rowsByProfile(entryOf('equity_census_responses'), resultsByTable.equity_census_responses ?? [], context, byId)
  const ldem = rowsByProfile(entryOf('liliana_demographics'), resultsByTable.liliana_demographics ?? [], context, byId)
  const scr  = rowsByProfile(entryOf('screener_results'),     resultsByTable.screener_results ?? [],     context, byId)
  const comp = rowsByProfile(entryOf('participant_compensation'), resultsByTable.participant_compensation ?? [], context, byId)
  noteOmitted(tools, 'screener_results',
    (resultsByTable.screener_results ?? []).filter(r => r.resubmission_of), r => r.participant_id)
  const qWide   = questionnaireWideByProfile(resultsByTable.questionnaire_responses ?? [], context, tools)
  const instWide = instrumentWideByProfile(resultsByTable.instrument_responses ?? [], context, tools)
  const vasWide = vasWideByProfile(resultsByTable.vas_responses ?? [], context.vasScaleSlugById ?? new Map(), context, tools)

  const built = context.enrollments.map(e => {
    const pid = e.profile_id
    const row = {
      participant_external_id: e.external_id,
      profile_id:     e.profile_id,
      // Test accounts are indistinguishable from real participants otherwise —
      // they carry fabricated ratings and inflate every _n count, and filtering
      // on `status` does not catch them because real participants withdraw too.
      is_test:        e.is_test ?? false,
      enrolled_at:    e.enrolled_at,
      consent_date:   e.consent_date,
      status:         e.status,
    }
    // Every row of a participant-level table: the first under the plain prefix,
    // each further one under `<prefix>_r<n>`.
    const each = (map, prefix, table, merge) => {
      for (const src of map.get(pid) ?? []) {
        merge(row, tools.namer.name(pid, prefix, { table, row_id: src.id }), src)
      }
    }
    each(dem,  'dem',      'demographics',            mergePrefixed)
    each(eq,   'eq',       'equity_census_responses', mergeJsonResponses)
    each(ldem, 'ldem',     'liliana_demographics',    mergeJsonResponses)
    each(scr,  'screener', 'screener_results',        mergePrefixed)
    const put = cellWriter(tools, 'master', pid)
    for (const block of [qWide[pid], instWide[pid], vasWide[pid]]) {
      for (const [col, value] of Object.entries(block ?? {})) put(row, col, value)
    }
    each(comp, 'comp',     'participant_compensation', mergePrefixed)
    for (const [table, m] of Object.entries(countByTable)) {
      row[`${table}_n`] = m.get(pid) ?? 0
    }
    return row
  })

  return {
    rows: orderMasterColumns(built),
    integrity: { ...tools.integrity, repeats: tools.namer.repeats },
  }
}

export function buildMasterTable(context, resultsByTable) {
  return buildMasterWithIntegrity(context, resultsByTable).rows
}

// One row per finding, for `_export_integrity.csv`. An export with nothing to
// report still says so, so the file's presence is itself proof the check ran.
export function integrityRows(context, integrity) {
  const ext = pid => context?.profileToExternal?.get(pid) ?? null
  const out = []
  for (const o of integrity?.omitted ?? []) {
    out.push({
      kind: 'omitted_copy', table: o.table,
      participant_external_id: ext(o.participant), profile_id: o.participant, row_id: o.row_id,
      detail: `Left out of the master as a copy of ${o.resubmission_of}. Still present in ${o.table}.csv.`,
    })
  }
  for (const r of integrity?.repeats ?? []) {
    out.push({
      kind: 'repeat_kept', table: r.table ?? '',
      participant_external_id: ext(r.scope), profile_id: r.scope, row_id: r.row_id ?? '',
      detail: `A further response to ${r.base} was kept as ${r.name}.`,
    })
  }
  for (const c of integrity?.collisions ?? []) {
    out.push({
      kind: 'column_collision', table: c.table,
      participant_external_id: ext(c.participant), profile_id: c.participant, row_id: '',
      detail: `Two values were named ${c.column}; the second was kept as ${c.written_as}.`,
    })
  }
  if (!out.length) {
    out.push({
      kind: 'clean', table: '', participant_external_id: '', profile_id: '', row_id: '',
      detail: 'Every collected response reached the master: no copies omitted, no repeats, no column collisions.',
    })
  }
  return out
}

// ── Deterministic master column order ─────────────────────────────────────────
//
// `toCsv` unions keys in first-appearance order, which for the master means the
// VAS block emerges in whatever order rows happened to supply it — d1, d18, d20,
// d21, d24 … Liliana navigates this file by column letter (her notes cite
// "columns OL:OM"), so a jumbled order is not cosmetic: it makes neighbouring
// columns unrelated and invites exactly the positional misreading that the
// day-indexed naming was meant to end.
//
// Groups run identity → intake → instruments → ratings → counts, and within a
// group sort by the thing a reader scans for: instrument then timepoint then
// item, scale then DAY (numeric, so d2 precedes d18) then pre before post.
const TIMEPOINT_ORDER = { screener: 0, baseline: 1, midpoint: 2, final: 3 }

function masterColumnRank(col) {
  const lead = ['participant_external_id', 'profile_id', 'is_test', 'enrolled_at', 'consent_date', 'status']
  const i = lead.indexOf(col)
  if (i !== -1) return [0, i, '', 0, 0]
  if (col.endsWith('_n'))            return [9, 0, col, 0, 0]
  if (col.startsWith('dem_'))        return [1, 0, col, 0, 0]
  if (col.startsWith('ldem_'))       return [2, 0, col, 0, 0]
  if (col.startsWith('eq_'))         return [3, 0, col, 0, 0]
  if (col.startsWith('screener_'))   return [4, 0, col, 0, 0]
  if (col.startsWith('comp_'))       return [8, 0, col, 0, 0]

  // vas_<scale>[_pre|_post]_d<day>  /  vas_<scale>_unscheduled_<n>
  let m = col.match(/^vas_(.+?)(?:_(pre|post))?_d(\d+)$/)
  if (m) return [7, 0, m[1], Number(m[3]), m[2] === 'post' ? 1 : 0]
  m = col.match(/^vas_(.+?)_unscheduled_(\d+)$/)
  if (m) return [7, 1, m[1], Number(m[2]), 0]

  // <instrument>_<timepoint>_<item>
  m = col.match(/^([a-z0-9]+)_(screener|baseline|midpoint|final|x\d+)_(.+)$/)
  if (m) {
    const tp = TIMEPOINT_ORDER[m[2]] ?? 4 + Number(m[2].slice(1) || 0)
    const itemNum = Number(m[3])
    return [6, 0, m[1], tp * 1000 + (Number.isFinite(itemNum) ? itemNum : 999), 0]
  }

  // Open-list entries: <slug>_<timepoint>_<n>_factor|contribution. The index is
  // part of the name, so plain alphabetical puts _10_ before _2_ and reads as
  // though the tenth entry came first. Sort the group numerically, factor
  // before its own contribution.
  m = col.match(/^(.+)_(\d+)_(factor|contribution)$/)
  if (m) return [5, 0, m[1], Number(m[2]) * 2 + (m[3] === 'contribution' ? 1 : 0), 0]

  return [5, 0, col, 0, 0]
}

export function orderMasterColumns(rows) {
  if (!rows.length) return rows
  const cols = new Set()
  for (const r of rows) Object.keys(r).forEach(c => cols.add(c))
  const sorted = [...cols].sort((a, b) => {
    const ra = masterColumnRank(a), rb = masterColumnRank(b)
    for (let i = 0; i < ra.length; i++) {
      if (ra[i] === rb[i]) continue
      return typeof ra[i] === 'string' ? String(ra[i]).localeCompare(String(rb[i])) : ra[i] - rb[i]
    }
    return a.localeCompare(b)
  })
  // Objects preserve string-key insertion order, so rebuilding in sorted order
  // is what actually fixes the CSV header.
  return rows.map(r => Object.fromEntries(sorted.map(c => [c, r[c]])))
}

// ── Stable participant key on every file ──────────────────────────────────────
//
// Each table names its participant column after whatever key it happens to hold:
// `user_id` (profile uuid) in demographics, `participant_id` (profile uuid) in
// video sessions, `participant_id` (liliana_participants.id — a DIFFERENT id) in
// liliana_day_data. Three different identifiers, two of them under the same
// column name, none of them the id a researcher recognises. Joining files by
// `participant_id` therefore produced nonsense.
//
// Every exported table now leads with `participant_external_id`, the SONA/
// Prolific id that also keys the master. Original columns are left untouched.
export function withParticipantKey(entry, rows, context, resultsByTable) {
  const byId = {}
  for (const [table, rs] of Object.entries(resultsByTable ?? {})) {
    byId[table] = new Map(rs.map(r => [r.id, r]))
  }
  return rows.map(row => {
    const pid = rowOwnerProfileId(entry, row, context, byId)
    return { participant_external_id: context.profileToExternal?.get(pid) ?? null, ...row }
  })
}

// ── Codebook ──────────────────────────────────────────────────────────────────
//
// The export shipped no data dictionary, so every column had to be reverse
// engineered from its name — which is how `_t<n>` came to be read as a study
// timepoint. This emits one row per column of the master plus a description of
// each table file.
const COLUMN_NOTES = [
  [/^participant_external_id$/, 'SONA/Prolific participant id. Join key across every file in this export.'],
  [/^profile_id$/,              'Internal account uuid. Stable but not meaningful outside the platform.'],
  [/^is_test$/,                 'TRUE = account created for testing, not recruitment. Its data is fabricated or exercised by staff. EXCLUDE these rows from analysis — filtering on `status` will not catch them, because real participants withdraw too.'],
  [/^enrolled_at$/,             'Timestamp the participant was enrolled in this study.'],
  [/^consent_date$/,            'Timestamp consent was recorded. Blank = consent not yet given.'],
  [/^status$/,                  'Enrollment status: enrolled | withdrawn.'],
  [/^dem_/,                     'Demographics item (age, gender, racialized, ses_ladder).'],
  [/^screener_/,                'Eligibility screener outcome and answers.'],
  [/^comp_/,                    'Compensation / credit record.'],
  [/^eq_/,                      'Equity census intake item.'],
  [/_n$/,                       'PARTICIPATION COUNT — how many rows this participant contributed to that table. A completeness diagnostic, not a measure.'],
  [/^vas_.*_pre_d\d+$/,         'Momentary rating, PRE-practice check-in, on the given study day (1-6).'],
  [/^vas_.*_post_d\d+$/,        'Momentary rating, POST-practice check-in, on the given study day (1-6).'],
  [/^vas_.*_d\d+$/,             'Momentary rating on the given study day (1-6). No pre/post phase (single-scale step).'],
  [/^vas_.*_unscheduled_\d+$/,  'Rating with no schedule link (predates schedule linkage). Occurrence-numbered; day unknown.'],
]

function describeColumn(col) {
  // `_r<n>` marks a further response to the same variable, kept rather than
  // written over (CLAUDE.md rule 5). Describe the variable, and say so.
  const rep = col.match(/^(.*?)_r(\d+)(_.*)?$/)
  if (rep && Number(rep[2]) >= 2) {
    const base = describeColumn(rep[1] + (rep[3] ?? ''))
    return `REPEAT #${rep[2]} — a further response to this variable from the same participant, kept rather than overwritten (see _export_integrity.csv).${base ? ' ' + base : ''}`
  }
  for (const [re, note] of COLUMN_NOTES) if (re.test(col)) return note
  const m = col.match(/^([a-z0-9]+)_(screener|baseline|midpoint|final|x\d+)_(.+)$/)
  if (m) {
    // `screener` is not a session — it runs at intake, before consent — so it
    // gets its own phrasing rather than being called "the screener session".
    const when = m[2] === 'screener' ? 'the intake screener, before consent'
      : m[2].startsWith('x') ? `an unplanned extra administration (#${m[2].slice(1)})`
      : `the ${m[2]} session`
    return `${m[1].toUpperCase()} item ${m[3]}, collected at ${when}.`
  }
  return ''
}

export function buildCodebook(context, resultsByTable, masterRows) {
  const out = [{
    file: '_export_integrity.csv',
    column: '(whole file)',
    description: 'Proof that no collected response was dropped or overwritten on its way into the master: every provable copy left out (each still present in its table file), every further response kept under an _r<n> column, and any column collision caught. A single row of kind "clean" means none occurred.',
  }]
  // Said in the file itself, so an analyst comparing the master's row count with
  // the enrollment count months later is not left to guess why they differ.
  const creditOnly = context?.excludedCreditOnly ?? 0
  if (creditOnly > 0) {
    out.push({
      file: '(every file)',
      column: '(whole export)',
      description: `${creditOnly} enrolled participant${creditOnly !== 1 ? 's' : ''} chose credit-only consent — completed the study for course credit but did not consent to research use of their data. They and every row they generated are left out of every file in this export.`,
    })
  }
  const cols = new Set()
  for (const r of masterRows) Object.keys(r).forEach(c => cols.add(c))
  for (const c of cols) {
    out.push({ file: '_participant_master.csv', column: c, description: describeColumn(c) })
  }
  for (const entry of EXPORT_TABLES) {
    const n = resultsByTable?.[entry.table]?.length ?? 0
    if (!n) continue
    out.push({
      file: `${entry.table}.csv`,
      column: '(whole file)',
      description: `${entry.label} — ${n} row(s). One row per record, not per participant; join to the master on participant_external_id.`,
    })
  }
  return out
}

// ── CSV ───────────────────────────────────────────────────────────────────────

export function toCsv(rows) {
  if (!rows.length) return ''
  const colSet = new Set()
  for (const r of rows) Object.keys(r).forEach(k => colSet.add(k))
  const cols = [...colSet]
  const escape = v => {
    if (v == null) return ''
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
    return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [cols.join(','), ...rows.map(r => cols.map(c => escape(r[c])).join(','))].join('\n')
}

export { responseScalar }
