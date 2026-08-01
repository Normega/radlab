// Which sessions earn a deadline-anchored "last chance" reminder, and which
// consequence the copy is allowed to name. Run against graphs shaped like the
// two live longitudinal studies, since the whole point of deriving this from
// graph position rather than a flag is that it must agree with what
// materializeSchedule actually does on a miss.
//
// Run: node supabase/functions/_shared/criticalSession.test.mjs
// On Node < 22.18 (type stripping not yet on by default), add the flag:
//   node --experimental-strip-types supabase/functions/_shared/criticalSession.test.mjs
// Either way there is no build step.
import assert from 'node:assert'
import { criticalSessionKind } from './criticalSession.ts'

// ─── Fixtures ────────────────────────────────────────────────────────────────

/**
 * Liliana Study 3, structurally: t0 -> baseline -> counterbalanced Phase 1 ->
 * adherence check -> midpoint -> randomize -> arm -> adherence check -> final.
 * The adherence_check between the midpoint's timepoint and the fork is the
 * reason the gate walk has to hop rather than look at a single edge.
 */
function lilianaGraph() {
  return {
    nodes: [
      { id: 't0', type: 'timepoint', day_offset: 0, time_of_day: '06:00' },
      { id: 's_baseline', type: 'session', label: 'Baseline', link_expires_hours: 72 },
      { id: 't_p1', type: 'timepoint', day_offset: 1 },
      { id: 'cb_p1', type: 'counterbalance', block_ids: ['b_nr', 'b_ra'] },
      { id: 'b_nr', type: 'block', children: ['s_nr_1'] },
      { id: 'b_ra', type: 'block', children: ['s_ra_1'] },
      { id: 's_nr_1', type: 'session', label: 'Non-reactivity 1', link_expires_hours: 24 },
      { id: 's_ra_1', type: 'session', label: 'Reappraisal 1', link_expires_hours: 24 },
      { id: 'ac_p1', type: 'adherence_check', phase: 'phase1', min_required: 10, of_total: 12 },
      { id: 't_mid', type: 'timepoint', day_offset: 13 },
      { id: 's_mid', type: 'session', label: 'Midpoint Assessment', link_expires_hours: 72 },
      { id: 'rnd_p2', type: 'randomize', arms: [{ group: 'nr', entry: 't_p2_nr' }] },
      { id: 't_p2_nr', type: 'timepoint', day_offset: 16 },
      { id: 's_p2_nr_1', type: 'session', label: 'Phase 2 day 1', link_expires_hours: 24 },
      { id: 'ac_p2', type: 'adherence_check', phase: 'phase2', min_required: 10, of_total: 12 },
      { id: 't_final', type: 'timepoint', day_offset: 28 },
      { id: 's_final', type: 'session', label: 'Final Assessment', link_expires_hours: 72 },
    ],
    edges: [
      { from: 't0', to: 's_baseline' },
      { from: 's_baseline', to: 't_p1' },
      { from: 't_p1', to: 'cb_p1' },
      { from: 'cb_p1', to: 'ac_p1' },
      { from: 'ac_p1', to: 't_mid' },
      { from: 't_mid', to: 's_mid' },
      { from: 's_mid', to: 'rnd_p2' },
      { from: 't_p2_nr', to: 's_p2_nr_1' },
      { from: 's_p2_nr_1', to: 'ac_p2' },
      { from: 'ac_p2', to: 't_final' },
      { from: 't_final', to: 's_final' },
    ],
  }
}

/**
 * Zerin, structurally: baseline -> randomize -> arm of 4 h EMA check-ins ->
 * post-study. Its baseline gates the fork, which is exactly the case Norm
 * excluded: nothing is underway to lose before the baseline is done.
 */
function zerinGraph() {
  return {
    nodes: [
      { id: 'tp_baseline', type: 'timepoint', day_offset: 0, time_of_day: '09:00' },
      { id: 's_baseline', type: 'session', label: 'Baseline', link_expires_hours: 72 },
      { id: 'rnd', type: 'randomize', arms: [{ group: 'ctrl', entry: 'tp_ctrl_d1_am' }] },
      { id: 'tp_ctrl_d1_am', type: 'timepoint', day_offset: 1 },
      { id: 's_ctrl_d1_am', type: 'session', label: 'Control D1 AM', link_expires_hours: 4 },
      { id: 'tp_post', type: 'timepoint', day_offset: 22 },
      { id: 's_post', type: 'session', label: 'Post-Study', link_expires_hours: 72 },
    ],
    edges: [
      { from: 'tp_baseline', to: 's_baseline' },
      { from: 's_baseline', to: 'rnd' },
      { from: 'tp_ctrl_d1_am', to: 's_ctrl_d1_am' },
      { from: 's_ctrl_d1_am', to: 'tp_post' },
      { from: 'tp_post', to: 's_post' },
    ],
  }
}

/** Convenience: look the node's own window up rather than restating it. */
function kindOf(graph, nodeKey, overrideHours) {
  const node = graph.nodes.find((n) => n.id === nodeKey)
  return criticalSessionKind(graph, nodeKey, overrideHours ?? node?.link_expires_hours ?? 48)
}

// ─── Liliana ─────────────────────────────────────────────────────────────────

{
  const g = lilianaGraph()

  // The midpoint gates the fork across an adherence_check hop. Missing it is
  // the one case materializeSchedule actually withdraws for, so 'gate' — the
  // only kind whose copy may say participation ends — must be what comes back.
  assert.strictEqual(kindOf(g, 's_mid'), 'gate', 'midpoint should be a fork gate')

  // The final assessment ends the graph. Nobody is withdrawn for missing it,
  // so it must NOT come back as 'gate'.
  assert.strictEqual(kindOf(g, 's_final'), 'terminal', 'final assessment should be terminal')

  // The baseline is the entry session — excluded even though the study can't
  // proceed without it, because nothing is underway to lose.
  assert.strictEqual(kindOf(g, 's_baseline'), null, 'baseline should get no final notice')

  // Ordinary training days are neither, and their 24 h window is a day link,
  // not an assessment window.
  assert.strictEqual(kindOf(g, 's_nr_1'), null, 'daily training session should get no final notice')
  assert.strictEqual(kindOf(g, 's_p2_nr_1'), null, 'phase 2 daily should get no final notice')

  // Structural nodes are not sessions and must never resolve to a kind.
  assert.strictEqual(kindOf(g, 'rnd_p2', 72), null, 'randomize node is not a session')
  assert.strictEqual(kindOf(g, 't_mid', 72), null, 'timepoint is not a session')
  assert.strictEqual(kindOf(g, 'nonexistent', 72), null, 'unknown node id resolves to null')
}

// ─── Zerin ───────────────────────────────────────────────────────────────────

{
  const g = zerinGraph()

  // Gates the fork, but it's the entry session: excluded. This is the
  // distinction that made "session before a randomize" the wrong rule.
  assert.strictEqual(kindOf(g, 's_baseline'), null, 'Zerin baseline gates a fork but is the entry session')

  assert.strictEqual(kindOf(g, 's_post'), 'terminal', 'Zerin post-study should be terminal')

  // A 4 h EMA link can't carry a 12 h lead time — the notice would fire before
  // the link was issued.
  assert.strictEqual(kindOf(g, 's_ctrl_d1_am'), null, '4 h EMA check-in is below the window floor')
}

// ─── Overrides ───────────────────────────────────────────────────────────────

{
  const g = lilianaGraph()
  const withOverride = (nodeKey, value) => ({
    ...g,
    nodes: g.nodes.map((n) => (n.id === nodeKey ? { ...n, final_notice: value } : n)),
  })

  // false suppresses a session that would otherwise qualify.
  assert.strictEqual(
    kindOf(withOverride('s_mid', false), 's_mid'), null,
    'final_notice:false should suppress a derived gate',
  )

  // true forces one on the baseline, which the derivation excludes as the entry
  // session. Liliana's baseline runs on into Phase 1 rather than gating a fork,
  // so forcing it on yields the claim-free kind, not a withdrawal threat.
  assert.strictEqual(
    kindOf(withOverride('s_baseline', true), 's_baseline'), 'window',
    'final_notice:true on a non-gating baseline forces a claim-free notice',
  )

  // Zerin's baseline DOES gate a fork, so forcing it on there types as 'gate' —
  // the entry-session exclusion is what suppresses it by default, not the
  // absence of a real consequence.
  const zerinForced = {
    ...zerinGraph(),
    nodes: zerinGraph().nodes.map((n) => (n.id === 's_baseline' ? { ...n, final_notice: true } : n)),
  }
  assert.strictEqual(
    criticalSessionKind(zerinForced, 's_baseline', 72), 'gate',
    'forcing a gating baseline on still names the withdrawal consequence',
  )

  // Forced on a session whose position tells us nothing: 'window', which makes
  // no claim about consequences. This is what stops an authored override from
  // putting a withdrawal threat in front of a participant who won't be
  // withdrawn.
  const forcedDaily = withOverride('s_p2_nr_1', true)
  assert.strictEqual(
    criticalSessionKind(forcedDaily, 's_p2_nr_1', 72), 'window',
    'forced non-gate non-terminal session gets the claim-free kind',
  )

  // Even forced, a window too short for the lead time is refused — there is no
  // honest way to warn about 12 hours on a 4 h link.
  assert.strictEqual(
    criticalSessionKind(forcedDaily, 's_p2_nr_1', 4), null,
    'forced session below the window floor still gets no notice',
  )
}

console.log('criticalSession: all assertions passed')
