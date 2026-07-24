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

import { supabase } from './supabase'

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
  { table: 'stillwater_responses',     category: 'Games',         label: 'Still Water',                strategy: 'profile',  col: 'user_id' },
  { table: 'drift_trials',             category: 'Games',         label: 'Drift — Trials',             strategy: 'session' },
  { table: 'drift_performance',        category: 'Games',         label: 'Drift — Performance',        strategy: 'session' },
  { table: 'face_read_trials',         category: 'Games',         label: 'FaceRead — Trials',          strategy: 'session' },
  { table: 'face_read_performance',    category: 'Games',         label: 'FaceRead — Performance',     strategy: 'session' },
  { table: 'farm_joy_trials',          category: 'Games',         label: 'FarmJoy — Trials',           strategy: 'session' },
  { table: 'farm_joy_performance',     category: 'Games',         label: 'FarmJoy — Performance',      strategy: 'session' },
  { table: 'farm_joy_feedback',        category: 'Games',         label: 'FarmJoy — Feedback',         strategy: 'session' },
  { table: 'farm_joy_value_history',   category: 'Games',         label: 'FarmJoy — Value History',    strategy: 'profile',  col: 'user_id' },
  { table: 'word_max_sessions',        category: 'Games',         label: 'WordMax — Sessions',         strategy: 'profile',  col: 'user_id' },
  { table: 'aptitude_sessions',        category: 'Games',         label: 'Aptitude / ColorMax — Sessions', strategy: 'profile', col: 'user_id' },
  { table: 'aptitude_events',          category: 'Games',         label: 'Aptitude / ColorMax — Events',   strategy: 'parent', parentTable: 'aptitude_sessions',        parentCol: 'session_id' },
  { table: 'breath_guardian_sessions', category: 'Games',         label: 'Breath Guardian — Sessions', strategy: 'session' },
  { table: 'pond_watch_results',       category: 'Games',         label: 'Pond Watch',                 strategy: 'study',    ownerSpace: 'profile',  ownerCol: 'user_id' },
  // Questionnaires
  { table: 'questionnaire_responses',  category: 'Questionnaires', label: 'Questionnaire Responses',   strategy: 'profile',  col: 'user_id' },
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

export async function resolveStudyContext(studyId) {
  const [enrollments, gameSessions, lilParts, vasScales] = await Promise.all([
    pageAll((f, t) => supabase.from('study_enrollments')
      .select('profile_id, external_id, enrolled_at, consent_date, status')
      .eq('study_id', studyId).range(f, t)),
    pageAll((f, t) => supabase.from('game_sessions')
      .select('id, user_id').eq('study_id', studyId).range(f, t)),
    // liliana_participants is itself study-scoped; tolerate its absence
    pageAll((f, t) => supabase.from('liliana_participants')
      .select('id, profile_id').eq('study_id', studyId).range(f, t)).catch(() => []),
    // Reference lookup so vas_responses (which stores scale_id) can be reported
    // under human-readable slugs in the master. Small table; tolerate absence.
    supabase.from('vas_scales').select('id, slug').then(r => r.data ?? []).catch(() => []),
  ])

  const externalToProfile = new Map()
  for (const e of enrollments) {
    if (e.external_id != null) externalToProfile.set(e.external_id, e.profile_id ?? null)
  }
  const gameSessionById = new Map(gameSessions.map(s => [s.id, s]))
  const lilPartById     = new Map(lilParts.map(p => [p.id, p]))

  return {
    studyId,
    enrollments,
    profileIds:     uniq(enrollments.map(e => e.profile_id)),
    externalIds:    uniq(enrollments.map(e => e.external_id)),
    gameSessionIds: gameSessions.map(s => s.id),
    lilPartIds:     lilParts.map(p => p.id),
    externalToProfile,
    gameSessionById,
    lilPartById,
    vasScaleSlugById: new Map(vasScales.map(s => [s.id, s.slug])),
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

  // Parents (everything non-'parent') first, so 'parent' tables can resolve ids.
  const parents  = EXPORT_TABLES.filter(e => e.strategy !== 'parent')
  const children = EXPORT_TABLES.filter(e => e.strategy === 'parent')

  async function run(entry) {
    onProgress(`Fetching ${entry.label}…`)
    try {
      resultsByTable[entry.table] = await fetchTable(entry, context, resultsByTable)
    } catch (e) {
      resultsByTable[entry.table] = []
      errors.push({ table: entry.table, message: e?.message ?? String(e) })
    }
  }

  await Promise.all(parents.map(run))
  await Promise.all(children.map(run))

  const tables = EXPORT_TABLES
    .map(entry => ({ ...entry, rows: resultsByTable[entry.table] ?? [] }))
    .filter(t => t.rows.length > 0)

  return { context, tables, errors, resultsByTable }
}

// Whether the study has any physio (BreathBelt) rows — drives the Physio button.
export function hasPhysio(resultsByTable) {
  return PHYSIO_TABLES.some(t => (resultsByTable[t]?.length ?? 0) > 0)
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
// so they need flattening rather than mergePrefixed: arrays → "a; b", nested
// objects → JSON, scalars pass through. This is the demographic intake online
// studies use in place of the classic demographics step, so its fields belong in
// the per-participant master row — not just a participation count.
function mergeEquityCensus(target, srcRow) {
  if (!srcRow?.responses) return
  for (const [k, v] of Object.entries(srcRow.responses)) {
    target[`eq_${k}`] = Array.isArray(v) ? v.join('; ')
      : (v && typeof v === 'object') ? JSON.stringify(v)
      : (v ?? '')
  }
}

// Checklist questionnaire items store an object; export the weighted value.
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

// Which slugs are administered more than once to any single participant. When a
// slug repeats, EVERY occurrence (for every participant) gets a _t<n> suffix so
// columns stay aligned across the sample; single-administration instruments stay
// unsuffixed. `slugOf(row)` extracts the comparison slug. Rows must be pre-sorted
// chronologically so occurrence n follows administration order.
function repeatedSlugSet(rows, slugOf) {
  const perProfileSlug = {}
  for (const r of rows) {
    if (r.user_id == null) continue
    const k = `${r.user_id} ${slugOf(r)}`
    perProfileSlug[k] = (perProfileSlug[k] ?? 0) + 1
  }
  const max = {}
  for (const [k, n] of Object.entries(perProfileSlug)) {
    const slug = k.slice(k.indexOf(' ') + 1)
    max[slug] = Math.max(max[slug] ?? 0, n)
  }
  return new Set(Object.keys(max).filter(s => max[s] > 1))
}

// Wide questionnaire block, keyed by profile_id → { <slug>[_t<n>]_<item>: value }.
// Sliders live here too (slug `slider_*`, response { value }); they are treated
// exactly like questionnaires. A repeated instrument (a slider asked pre/mid/post,
// or a questionnaire re-administered across days) is disambiguated by _t<n> in
// completion order rather than clobbering into one column.
function questionnaireWideByProfile(qRows) {
  const rows = [...qRows].sort((a, b) => new Date(a.completed_at ?? 0) - new Date(b.completed_at ?? 0))
  const repeated = repeatedSlugSet(rows, r => r.questionnaire_slug)
  const byProfile = {}
  const occ = {}
  for (const r of rows) {
    const pid = r.user_id
    if (pid == null) continue
    if (!byProfile[pid]) byProfile[pid] = {}
    const slug = r.questionnaire_slug
    const n    = (occ[`${pid} ${slug}`] = (occ[`${pid} ${slug}`] ?? 0) + 1)
    const prefix = repeated.has(slug) ? `${normalizeSlug(slug)}_t${n}` : normalizeSlug(slug)
    for (const [rawKey, val] of Object.entries(r.responses ?? {})) {
      const cleanKey = rawKey.replace(/^item_/, '')
      const m = cleanKey.match(/(\d+)$/)
      const colName = m ? `${prefix}_${m[1]}` : `${prefix}_${cleanKey}`
      byProfile[pid][colName] = responseScalar(val)
    }
  }
  return byProfile
}

// Wide VAS block, keyed by profile_id → { vas_<slug>[_t<n>]: value }. vas_responses
// is multi-row (a scale can be asked repeatedly), so it isn't a single-row
// broadcast table — same _t<n> occurrence scheme as questionnaires/sliders.
function vasWideByProfile(vasRows, scaleSlugById) {
  const slugOf = r => normalizeSlug(scaleSlugById.get(r.scale_id) ?? r.scale_id ?? 'unknown')
  const rows = [...vasRows].sort((a, b) => new Date(a.responded_at ?? 0) - new Date(b.responded_at ?? 0))
  const repeated = repeatedSlugSet(rows, slugOf)
  const byProfile = {}
  const occ = {}
  for (const r of rows) {
    const pid = r.user_id
    if (pid == null) continue
    if (!byProfile[pid]) byProfile[pid] = {}
    const slug = slugOf(r)
    const n    = (occ[`${pid} ${slug}`] = (occ[`${pid} ${slug}`] ?? 0) + 1)
    byProfile[pid][repeated.has(slug) ? `vas_${slug}_t${n}` : `vas_${slug}`] = r.value
  }
  return byProfile
}

// First row per participant for single-row participant-level tables.
function firstRowByProfile(entry, rows, ctx, resultsByTableById) {
  const map = new Map()
  for (const row of rows) {
    const pid = rowOwnerProfileId(entry, row, ctx, resultsByTableById)
    if (pid != null && !map.has(pid)) map.set(pid, row)
  }
  return map
}

// Build the master: one row per enrolled participant.
//  • participant-level single-row tables broadcast their columns (prefixed)
//  • questionnaires spread wide (one column per item)
//  • every data table contributes a `<table>_n` participation count
export function buildMasterTable(context, resultsByTable) {
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

  const dem  = firstRowByProfile(entryOf('demographics'),         resultsByTable.demographics ?? [],         context, byId)
  const eq   = firstRowByProfile(entryOf('equity_census_responses'), resultsByTable.equity_census_responses ?? [], context, byId)
  const scr  = firstRowByProfile(entryOf('screener_results'),     resultsByTable.screener_results ?? [],     context, byId)
  const comp = firstRowByProfile(entryOf('participant_compensation'), resultsByTable.participant_compensation ?? [], context, byId)
  const qWide   = questionnaireWideByProfile(resultsByTable.questionnaire_responses ?? [])
  const vasWide = vasWideByProfile(resultsByTable.vas_responses ?? [], context.vasScaleSlugById ?? new Map())

  return context.enrollments.map(e => {
    const pid = e.profile_id
    const row = {
      participant_id: e.external_id,
      profile_id:     e.profile_id,
      enrolled_at:    e.enrolled_at,
      consent_date:   e.consent_date,
      status:         e.status,
    }
    mergePrefixed(row, 'dem',      dem.get(pid))
    mergeEquityCensus(row,         eq.get(pid))
    mergePrefixed(row, 'screener', scr.get(pid))
    Object.assign(row, qWide[pid]   ?? {})
    Object.assign(row, vasWide[pid] ?? {})
    mergePrefixed(row, 'comp',     comp.get(pid))
    for (const [table, m] of Object.entries(countByTable)) {
      row[`${table}_n`] = m.get(pid) ?? 0
    }
    return row
  })
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
