// The rename rule: a name changes what people read, never what identifies an
// instrument. The slider_ prefix on the picker key is the easy thing to get
// wrong — without it a rename updates no picker row and reports success.
import assert from 'node:assert'
import { pickerLabel, pickerSubcategory, instrumentDisplayName, isRenameable, PICKER_NAME_MAX } from './instrumentRename.js'

// 1. Picker label format matches what the authoring pages already write.
assert.equal(pickerLabel('Likert slider', 'mastery goal importance'), 'Likert slider – mastery goal importance')
assert.equal(pickerLabel('Slider', '  Constraints  '), 'Slider – Constraints')
assert.equal(pickerLabel('Slider', null), 'Slider – ')

// 2. Long names are cut to the same length the create pages use.
const long = 'x'.repeat(120)
assert.equal(pickerLabel('Slider', long).length, 'Slider – '.length + PICKER_NAME_MAX)

// 3. The picker key: sliders are registered with a prefix, nothing else is.
assert.equal(pickerSubcategory('slider', 'constraints'), 'slider_constraints')
assert.equal(pickerSubcategory('composable', 'constraints'), 'constraints')

// 4. Display name falls back through name -> prompt -> slug, so a slider that
//    has never been named still reads exactly as it did before names existed.
assert.equal(instrumentDisplayName({ label: 'Constraints', prompt: 'To what extent…', slug: 's' }), 'Constraints')
assert.equal(instrumentDisplayName({ label: '   ', prompt: 'To what extent…', slug: 's' }), 'To what extent…')
assert.equal(instrumentDisplayName({ prompt: '', slug: 'slider_x' }), 'slider_x')
assert.equal(instrumentDisplayName({}), 'Untitled')

// 5. A blank or unchanged name is not a rename.
assert.equal(isRenameable('Constraints', '  '), false)
assert.equal(isRenameable('Constraints', 'Constraints'), false)
assert.equal(isRenameable('Constraints', ' Constraints '), false)
assert.equal(isRenameable('Constraints', 'Constraints (T2)'), true)
assert.equal(isRenameable(null, 'First name'), true)

console.log('instrumentRename: 14/14 checks passed')
