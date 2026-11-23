// Arm-conditional steps (session_template_nodes.show_if, 20261123_sf2b_retest_session.sql).
//
// show_if = { slot, in: [...] }: the step runs only for a participant whose drawn arm for
// `slot` (a key of studies.assignment_slots) is listed. Same shape as a display block's
// showIf (DisplayStepWrapper). A node without show_if runs for everyone, which is every
// node of every study before the Sense Foraging 2b retest.
//
// Which steps run is decided here; whether the session may open at all is decided only by
// schedule_row_block_reason (CLAUDE.md "Hard gates"), before any of this runs.

/** The slots a session's steps are conditioned on. */
export function armSlotsOf(nodes) {
  return [...new Set((nodes ?? []).map(n => n?.show_if?.slot).filter(Boolean))]
}

/**
 * The steps this participant runs, in order, or null when an arm a step depends on is
 * missing or malformed. Null means "cannot decide", never "show everything": the caller
 * fails closed.
 */
export function stepsForArms(nodes, arms) {
  const out = []
  for (const n of nodes ?? []) {
    const cond = n?.show_if
    if (!cond) { out.push(n); continue }
    const arm = arms?.[cond.slot]
    if (arm == null || typeof arm === 'object') return null
    if (!Array.isArray(cond.in)) return null
    if (cond.in.includes(arm)) out.push(n)
  }
  return out
}
