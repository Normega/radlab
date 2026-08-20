// ── templateNodes.js ───────────────────────────────────────────────────────
//
// A session_template_nodes row points at exactly ONE of three things, and
// which one decides what StepDispatcher renders:
//
//   activity_id      → an activities row (games, forms, VAS, physio, …)
//   questionnaire_id → an uploaded questionnaire, rendered from its definition
//   module_id        → an intervention training module
//
// A node with all three null renders as "Missing activity on node …" — the
// label survives, so the session builder and the library both still look
// right, and the break only shows when someone walks the session.
//
// That is not hypothetical. The clone in SessionLibrary selected
// `order_index, activity_id, label` and copied the same three fields: a list
// written before uploaded questionnaires existed, and never revisited when
// they did. Cloning SummerBelt2026_Session on 2026-08-20 therefore produced a
// template whose PHQ-4, Brief MAIA-2, BARQ-R and GSE steps pointed at nothing,
// and the demo died the moment it stepped past PANAS (an activities row, so
// the one questionnaire that survived).
//
// So the select list and the copy are derived from ONE array here. Adding a
// fourth kind of reference means adding it in a single place, and the test
// fails if the two ever drift apart again.

export const NODE_REF_COLUMNS = ['activity_id', 'questionnaire_id', 'module_id']

// Columns a clone must read. Anything omitted here is silently dropped.
export const CLONE_NODE_SELECT = ['order_index', 'label', ...NODE_REF_COLUMNS].join(', ')

// Re-parent a template's nodes onto a new template, carrying every reference.
export function cloneNodeRows(nodes, templateId) {
  return (nodes ?? []).map(node => {
    const row = {
      session_template_id: templateId,
      order_index:         node.order_index,
      label:               node.label,
    }
    for (const col of NODE_REF_COLUMNS) row[col] = node[col] ?? null
    return row
  })
}
