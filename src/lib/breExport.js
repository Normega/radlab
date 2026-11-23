// Breath Attention and Emotional Recovery: the master's wide block (plan WP-C3).
//
// Every rating is a row in bre_ratings (they also export whole, as bre_ratings.csv, with bre_events.csv
// beside them). This spreads them into one row per participant, by two names, both from recorded facts
// (CLAUDE.md data rule 3):
//   bre_<position>             the place in the session the rating was taken (`position`, written by the
//                              task at the time): bre_upset_b1_m2 = upset rating, first emotion block,
//                              minute 2 of recovery. b1/b2 are the ORDER the blocks ran in.
//   bre_<position by emotion>  the same rating under the block's emotion, from `block_emotion` on the row:
//                              bre_upset_sadfilms_m2. Only for the two emotion blocks, so a column means the
//                              same film emotion for everyone whatever their sequence.
// plus bre_<position>_rt_ms, the per-participant design (bre_version, bre_condition, bre_clips_<block>,
// all read from the rows themselves) and the strategy-check outcome from bre_events.
//
// A second rating at the same position (an RA restart after a crash, say) is kept under _r2, never
// written over (data rule 5): the namer is the export's shared one, so the repeat is also listed in
// _export_integrity.csv.

const EMOTION_BLOCKS = new Set(['b1', 'b2'])

/** upset_b1_m2 → upset_sadfilms_m2 when that block was the sad one; null outside b1/b2. */
export function emotionKeyed(position, block, emotion) {
  if (!EMOTION_BLOCKS.has(block) || !emotion || emotion === 'neutral') return null
  const re = new RegExp(`(^|_)${block}(_|$)`)
  if (!re.test(position)) return null
  return position.replace(re, `$1${emotion}films$2`)
}

/**
 * breWideByProfile(ratings, events, { ownerOf, namer, put }) → { [profileId]: { column: value } }
 *   ownerOf(row) → profile id (or null to skip); namer: createRepeatNamer(); put(target, col, value)
 */
export function breWideByProfile(ratings, events, { ownerOf = r => r.user_id, namer, put }) {
  const out = {}
  const cell = (pid) => (out[pid] ??= {})
  const when = r => new Date(r.answered_at ?? r.received_at ?? 0).getTime()
  const ordered = (ratings ?? []).filter(r => !r.resubmission_of)
    .map((r, i) => ({ r, i })).sort((a, b) => (when(a.r) - when(b.r)) || (a.i - b.i)).map(x => x.r)

  for (const r of ordered) {
    const pid = ownerOf(r)
    if (pid == null || !r.position) continue
    const target = cell(pid)
    const base = `bre_${r.position}`
    const col = namer.name(pid, base, { table: 'bre_ratings', row_id: r.id })
    const suffix = col.slice(base.length)              // '' or '_r2'
    put(target, col, r.value)
    put(target, `${col}_rt_ms`, r.rt_ms ?? null)
    const byEmotion = emotionKeyed(r.position, r.block, r.block_emotion)
    if (byEmotion) put(target, `bre_${byEmotion}${suffix}`, r.value)
    if (r.version && !('bre_version' in target)) put(target, 'bre_version', r.version)
    if (r.condition && !('bre_condition' in target)) put(target, 'bre_condition', r.condition)
    if (r.block && r.clip_ids?.length && !r.is_practice) {
      const k = `bre_clips_${r.block}`
      if (!(k in target)) put(target, k, r.clip_ids.join('+'))
      if (EMOTION_BLOCKS.has(r.block) && r.block_emotion && !(`bre_block_emotion_${r.block}` in target)) {
        put(target, `bre_block_emotion_${r.block}`, r.block_emotion)
      }
    }
  }

  // Strategy check (Screen 7): attempts, and whether the second answer was still wrong.
  const checks = new Map()
  for (const e of events ?? []) {
    if (e.event !== 'strategy_check' && e.event !== 'check_failed_twice') continue
    const pid = ownerOf(e)
    if (pid == null) continue
    const c = checks.get(pid) ?? { attempts: 0, firstCorrect: null, failedTwice: false }
    if (e.event === 'strategy_check') {
      c.attempts += 1
      if (c.attempts === 1) c.firstCorrect = e.detail?.correct === true
    } else c.failedTwice = true
    checks.set(pid, c)
  }
  for (const [pid, c] of checks) {
    const target = cell(pid)
    put(target, 'bre_check_attempts', c.attempts)
    put(target, 'bre_check_first_correct', c.firstCorrect)
    put(target, 'bre_check_failed_twice', c.failedTwice)
  }

  // Did the task reach its end (marker 255 from the end screen)?
  for (const e of events ?? []) {
    if (e.event !== 'task_end' || e.step !== 'bre_end') continue
    const pid = ownerOf(e)
    if (pid == null) continue
    const target = cell(pid)
    if (!('bre_reached_end' in target)) put(target, 'bre_reached_end', true)
  }
  return out
}

/** Codebook notes for the block, in studyExport's COLUMN_NOTES form. */
export const BRE_COLUMN_NOTES = [
  [/^bre_version$/,            'Breath Attention: which version this participant ran (main = sad and anger films; neutral = neutral films only, routed there by their GAD-7/PHQ-8 scores). Read from their rating rows.'],
  [/^bre_condition$/,          'Breath Attention: breath-attention instruction they were trained in. sf = sense-foraging (explore the sensations); em = evaluative monitoring.'],
  [/^bre_clips_/,              'Breath Attention: the film clip id(s) shown in that block, in order, joined by +. Clip ids are the REB clip list ids.'],
  [/^bre_block_emotion_b[12]$/, 'Breath Attention: the film emotion of the first (b1) or second (b2) emotion block, as shown. With the column above it gives the sequence.'],
  [/^bre_check_attempts$/,     'Breath Attention: answers given at the strategy check (Screen 7). 1 = right first time; 2 = wrong once, training audio replayed, answered again.'],
  [/^bre_check_first_correct$/, 'Breath Attention: TRUE = picked the description of their own instruction at the first attempt.'],
  [/^bre_check_failed_twice$/, 'Breath Attention: TRUE = wrong at both attempts. The session carried on; a candidate exclusion, decided by the analysis plan, not here.'],
  [/^bre_reached_end$/,        'Breath Attention: TRUE = reached the end screen (marker 255 sent). Blank = the session stopped before it.'],
  [/^bre_.*_rt_ms$/,           'Breath Attention: milliseconds from the rating appearing to its answer, pauses by the RA subtracted.'],
  [/^bre_upset_(sad|anger)films_/,  'Breath Attention: upset rating (1-7) in the block whose films were that emotion, at the given point (clip = right after the films; m0-m3 = start and each minute of the 3-minute recovery). Same rating as the b1/b2 column it copies.'],
  [/^bre_upset_/,              'Breath Attention: upset rating (1-7). practice/baseline; n1/n2/w = after a neutral clip (_clip) or its 60 s break (_break); b1/b2 = the first or second emotion block, in the order run, then _m0-_m3 = the recovery minutes.'],
  [/^bre_emo_/,                'Breath Attention: emotion check (1-7) for the emotion named last, at the end of that block (baseline, neutral, b1/b2, or sadfilms/angerfilms = the block by its film emotion).'],
  [/^bre_strat_/,              'Breath Attention: strategy item (1-7): explore = explored the sensations; evaluate = kept track of / evaluated them.'],
  [/^bre_appr_/,               'Breath Attention: appraisal item (1-7) after that block: relevance, ability to handle, rumination.'],
  [/^bre_breath_.*adherence_pct$/, 'Breath Attention: percent of the time (0-100, steps of 10) they kept attention on the breath as instructed.'],
  [/^bre_breath_/,             'Breath Attention: breath-attention item (1-7): aware, explore, curious, checking, pleasant (4 = neutral).'],
]
