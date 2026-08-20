// Run directly:  node src/lib/templateNodes.test.mjs
//
// A cloned session template that drops a node's reference does not look
// broken. The node count is right, the labels are right, the builder renders
// the sequence exactly as expected -- and the session dies at the first
// affected step with "Missing activity on node …". SessionLibrary's clone did
// exactly this from the day uploaded questionnaires were added until
// 2026-08-20, because the select list and the copy were two hand-written lists
// and only one of them was updated.
//
// So the point of these checks is less "does the mapper work" than "can the
// two lists drift apart again".

import { NODE_REF_COLUMNS, CLONE_NODE_SELECT, cloneNodeRows } from './templateNodes.js'

let pass = 0, fail = 0
function check(name, cond) {
  if (cond) { pass++ } else { fail++; console.error(`  FAIL: ${name}`) }
}

// 1. The drift guard. Every reference a node can hold must be READ by the
//    clone, or it cannot possibly be written.
for (const col of NODE_REF_COLUMNS) {
  check(`clone reads ${col}`, CLONE_NODE_SELECT.split(',').map(s => s.trim()).includes(col))
}
check('clone reads order_index and label',
  ['order_index', 'label'].every(c => CLONE_NODE_SELECT.split(',').map(s => s.trim()).includes(c)))

// 2. The three node kinds all survive the copy. Written as a loop over
//    NODE_REF_COLUMNS so a fourth kind of reference is covered the moment it
//    is declared, rather than whenever someone remembers to add a case.
for (const col of NODE_REF_COLUMNS) {
  const [row] = cloneNodeRows([{ order_index: 0, label: 'step', [col]: 'ref-123' }], 'new-tmpl')
  check(`${col} survives the clone`, row[col] === 'ref-123')
  for (const other of NODE_REF_COLUMNS.filter(c => c !== col)) {
    check(`${col} node leaves ${other} null`, row[other] === null)
  }
}

// 3. Re-parenting, ordering and labels.
{
  const rows = cloneNodeRows([
    { order_index: 1, label: 'second', activity_id: 'a2' },
    { order_index: 0, label: 'first',  activity_id: 'a1' },
  ], 'new-tmpl')
  check('every row re-parented',  rows.every(r => r.session_template_id === 'new-tmpl'))
  check('order_index preserved',  rows.map(r => r.order_index).join(',') === '1,0')
  check('label preserved',        rows.map(r => r.label).join(',') === 'second,first')
}

// 4. THE REGRESSION, as the real template was shaped: activity-backed steps
//    either side of four questionnaire-backed ones. Before the fix the middle
//    four came out with nothing to render.
{
  const source = [
    { order_index: 0, label: 'PANAS',        activity_id: 'act-panas' },
    { order_index: 1, label: 'PHQ-4',        questionnaire_id: 'q-phq4' },
    { order_index: 2, label: 'Brief MAIA-2', questionnaire_id: 'q-maia' },
    { order_index: 3, label: 'BARQ-R',       questionnaire_id: 'q-barq' },
    { order_index: 4, label: 'GSE',          questionnaire_id: 'q-gse' },
    { order_index: 5, label: 'Training',     module_id: 'mod-1' },
    { order_index: 6, label: 'Debrief',      activity_id: 'act-debrief' },
  ]
  const rows = cloneNodeRows(source, 'new-tmpl')
  // == null, not === null: a dropped column is absent, not explicitly null.
  const orphans = rows.filter(r => NODE_REF_COLUMNS.every(c => r[c] == null))
  check('no node loses its reference', orphans.length === 0)
  check('questionnaire steps keep their ids',
    rows.filter(r => r.questionnaire_id).map(r => r.questionnaire_id).join(',') === 'q-phq4,q-maia,q-barq,q-gse')
  check('training step keeps its module', rows[5].module_id === 'mod-1')
  check('every node copied', rows.length === source.length)
}

// 5. Nothing to clone is not an error.
{
  check('empty source → empty rows', cloneNodeRows([], 't').length === 0)
  check('null source → empty rows',  cloneNodeRows(null, 't').length === 0)
}

console.log(`templateNodes: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
