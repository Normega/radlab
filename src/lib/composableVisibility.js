// Conditional components for composable questionnaires: `show_if`.
//
//   { "id": "bg_practice_years", ..., "show_if": { "component": "bg_practice_regular", "equals": "yes" } }
//   { ..., "show_if": { "component": "bg_tradition", "in": ["christian", "muslim"] } }
//
// `equals` / `in` compare against what the participant chose: the option id of a
// multiple-choice answer (any selected option, for select-all), or the stored
// value itself for likert and the like ('pna' included, so a condition can name
// it). A component that never applied is stored as NOT_APPLICABLE, a fourth code
// beside an answer, 'pna' (declined) and blank (missing): skipped by the
// questionnaire's own logic is a recorded fact, not a missing answer, and must
// never read as either of the other two (CLAUDE.md, data-logging rule 4).
//
// Pure, so it is shared by the renderer and the validator and testable without React.

export const NOT_APPLICABLE = 'not_applicable'

function chosen(response) {
  if (response == null) return []
  if (Array.isArray(response)) return response.map(r => r?.option_id).filter(Boolean)
  if (typeof response === 'object') return response.option_id != null ? [response.option_id] : []
  return [response]
}

export function conditionMet(condition, responses) {
  if (!condition) return true
  const picks = chosen(responses?.[condition.component])
  if (condition.in) return picks.some(p => condition.in.includes(p))
  return picks.includes(condition.equals)
}

export function isVisible(component, responses) {
  return conditionMet(component.show_if, responses)
}

export function visibleComponents(page, responses) {
  return (page?.components ?? []).filter(c => isVisible(c, responses))
}

// A page whose every component is hidden is skipped, forwards and back.
export function pageIsShown(page, responses) {
  return visibleComponents(page, responses).length > 0
}

// After normalising: every hidden component that collects an answer is recorded
// as not applicable, including one answered and then hidden again by a changed
// earlier answer (that answer no longer applies to the person's situation).
export function markNotApplicable(pages, responses, collectsResponse) {
  const out = { ...responses }
  for (const page of pages) {
    for (const c of page.components ?? []) {
      if (collectsResponse(c) && !isVisible(c, responses)) out[c.id] = NOT_APPLICABLE
    }
  }
  return out
}

// Definition checks: the controlling component exists, comes earlier, and the
// condition names something it can actually produce.
export function validateShowIf(pages) {
  const errors = []
  const seen = new Map()   // id → component, in presentation order
  pages.forEach((page, p) => {
    ;(page.components ?? []).forEach((c, k) => {
      const cond = c.show_if
      const where = `Page ${p + 1}, component ${k + 1}`
      if (cond) {
        const ctrl = seen.get(cond.component)
        if (!ctrl) errors.push(`${where}: show_if names "${cond.component}", which must be an earlier component.`)
        else if (cond.equals == null && !Array.isArray(cond.in)) errors.push(`${where}: show_if needs "equals" or "in".`)
        else if (ctrl.type === 'multiple_choice') {
          const ids = new Set((ctrl.options ?? []).map(o => o.id))
          if (ctrl.allow_pna) ids.add('pna')
          for (const v of cond.in ?? [cond.equals]) {
            if (!ids.has(v)) errors.push(`${where}: show_if value "${v}" is not an option of "${cond.component}".`)
          }
        }
      }
      if (c.id) seen.set(c.id, c)
    })
  })
  return errors
}
