// Assignment slots set partway through a session (studies.assignment_slot_rules,
// 20261123_route_by_score_lazy_draws.sql).
//
// SessionEntry draws every key of studies.assignment_slots before step 1. A slot
// listed in assignment_slot_rules is not: it is set when the session reaches an
// assignment step (activity category 'assignment', subcategory = the slot key),
// either by route_by_score (assign = 'rule') or by draw_assignment
// (assign = 'node', optionally only when draw_if is met). The database enforces
// both; these helpers only decide what the browser asks for.
//
// get_session_by_token returns each rule as { assign, draw_if } only; the scoring
// rule itself (instruments, thresholds) never reaches the browser.

/** Slot keys that are set mid-session rather than drawn before step 1. */
export function lazySlotsOf(study) {
  const rules = study?.assignment_slot_rules
  return rules && typeof rules === 'object' ? Object.keys(rules) : []
}

/** Slot keys SessionEntry draws before step 1: every defined slot that is not lazy. */
export function upfrontSlotsOf(study) {
  const lazy = new Set(lazySlotsOf(study))
  return Object.keys(study?.assignment_slots ?? {}).filter(k => !lazy.has(k))
}

/**
 * What an assignment step should do for `slot`, given the arms known so far:
 *   { action: 'route' }            set it by rule (route_by_score)
 *   { action: 'draw' }             draw it (draw_assignment)
 *   { action: 'skip' }             draw_if is not met: this participant gets no arm here
 *   { action: 'error', reason }    the step cannot decide; the caller fails closed
 */
export function assignmentAction(rule, arms) {
  if (!rule || typeof rule !== 'object') return { action: 'error', reason: 'no rule for this slot' }
  if (rule.assign === 'rule') return { action: 'route' }
  if (rule.assign !== 'node') return { action: 'error', reason: `unknown assign "${rule.assign}"` }
  const cond = rule.draw_if
  if (!cond) return { action: 'draw' }
  if (!cond.slot || !Array.isArray(cond.in)) return { action: 'error', reason: 'malformed draw_if' }
  const arm = arms?.[cond.slot]
  // The slot it depends on must already be set by an earlier step. Not knowing is
  // not the same as "not met": skipping here would leave a participant unassigned.
  if (arm == null) return { action: 'error', reason: `"${cond.slot}" is not set yet` }
  return cond.in.includes(arm) ? { action: 'draw' } : { action: 'skip' }
}
