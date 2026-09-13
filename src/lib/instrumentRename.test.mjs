// The rename rule: a name changes what people read, never what identifies an
// instrument. The slider_ prefix on the picker key is the easy thing to get
// wrong — without it a rename updates no picker row and reports success.
import assert from 'node:assert'
import { pickerLabel, pickerSubcategory, nameColumn, instrumentDisplayName, isRenameable, PICKER_NAME_MAX } from './instrumentRename.js'

// 1. Picker label format matches what the authoring pages already write.
assert.equal(pickerLabel('Likert slider', 'mastery goal importance'), 'Likert slider – mastery goal importance')
assert.equal(pickerLabel('Slider', '  Constraints  '), 'Slider – Constraints')
assert.equal(pickerLabel('Slider', null), 'Slider – ')

// 2. Long names are cut to the same length the create pages use.
const long = 'x'.repeat(120)
assert.equal(pickerLabel('Slider', long).length, 'Slider – '.length + PICKER_NAME_MAX)

// 3. The picker key: three of the four families carry a prefix. Getting one
//    wrong updates no picker row, which is why each is pinned here.
assert.equal(pickerSubcategory('slider', 'constraints'), 'slider_constraints')
assert.equal(pickerSubcategory('vas', 'stress'), 'vas_stress')
assert.equal(pickerSubcategory('vas_pkg', 'liliana_pre_intervention_ratings'), 'vas_pkg_liliana_pre_intervention_ratings')
assert.equal(pickerSubcategory('composable', 'constraints'), 'constraints')

// 3b. The column the name lives in differs on one table only. Writing 'label'
//     to vas_packages would set a column that does not exist; writing 'name' to
//     the others would silently add nothing the library reads.
assert.equal(nameColumn('vas_pkg'), 'name')
assert.equal(nameColumn('vas'), 'label')
assert.equal(nameColumn('slider'), 'label')
assert.equal(nameColumn('composable'), 'label')

// 4. Display name falls back through name -> prompt -> slug, so a slider that
//    has never been named still reads exactly as it did before names existed.
assert.equal(instrumentDisplayName({ label: 'Constraints', prompt: 'To what extent…', slug: 's' }), 'Constraints')
assert.equal(instrumentDisplayName({ label: '   ', prompt: 'To what extent…', slug: 's' }), 'To what extent…')
assert.equal(instrumentDisplayName({ prompt: '', slug: 'slider_x' }), 'slider_x')
assert.equal(instrumentDisplayName({}), 'Untitled')

// 4b. The same chain across the other two tables: a VAS scale falls back to its
//     question and a package reads its NOT NULL `name`. No migration backfilled
//     a name, so the un-named case is the common one and must not regress.
assert.equal(instrumentDisplayName({ label: null, question: 'How stressed are you?', slug: 'stress' }), 'How stressed are you?')
assert.equal(instrumentDisplayName({ label: 'Stress', question: 'How stressed are you?', slug: 'stress' }), 'Stress')
assert.equal(instrumentDisplayName({ name: 'Liliana pre-intervention', slug: 'liliana_pre' }), 'Liliana pre-intervention')
assert.equal(instrumentDisplayName({ name: '  ', slug: 'liliana_pre' }), 'liliana_pre')

// 5. A blank or unchanged name is not a rename.
assert.equal(isRenameable('Constraints', '  '), false)
assert.equal(isRenameable('Constraints', 'Constraints'), false)
assert.equal(isRenameable('Constraints', ' Constraints '), false)
assert.equal(isRenameable('Constraints', 'Constraints (T2)'), true)
assert.equal(isRenameable(null, 'First name'), true)

console.log('instrumentRename: 26/26 checks passed')
