// Renaming an instrument — what a name may touch, and what it must not.
//
// An instrument is known by two strings. The SLUG is the machine key: a session
// step resolves it at runtime (`activities.subcategory`), and every response row
// records it at write time, which is what names the export column for that
// answer. The LABEL is what a researcher reads in the library and in the session
// builder's picker. Renaming means changing the label and nothing else — so a
// rename can never move data or relabel a column in an export, including for
// answers already collected.
//
// Built 2026-09-11: composable instruments could already be renamed through
// their edit page, but numeric sliders had no name at all (their slug is
// slugify(prompt), so they read as the whole question in underscores) and no
// edit route. Now both families carry a name and both can be renamed in place.
//
// The one thing a rename must keep in step is the picker: `activities.label`
// holds a formatted COPY of the instrument's name, and it is the string the
// session builder shows. Both writes belong to one rename, and a failure on the
// second must be surfaced rather than swallowed — a library that renamed the
// instrument while the picker kept the old name is worse than a failed rename.

/** Longest run of a name that the picker's label carries. */
export const PICKER_NAME_MAX = 60

/** The picker row's label: the type, then the instrument's name. */
export function pickerLabel(typeTitle, name) {
  return `${typeTitle} – ${String(name ?? '').trim().slice(0, PICKER_NAME_MAX)}`
}

/** The prefix each instrument family's picker row is keyed by. */
const PICKER_PREFIX = {
  slider:     'slider_',
  vas:        'vas_',
  vas_pkg:    'vas_pkg_',
  composable: '',
}

/**
 * The `activities.subcategory` an instrument's picker row is keyed by.
 * Composable instruments use the slug as-is; the other three families are
 * registered under a prefix (their create flows have done this since they
 * existed, and StepDispatcher/VasStepWrapper resolve them by that prefixed
 * value), so a rename that forgot it would silently update no picker row.
 */
export function pickerSubcategory(kind, slug) {
  return `${PICKER_PREFIX[kind] ?? ''}${slug}`
}

/**
 * The column that holds an instrument's name. Three of the four tables call it
 * `label`; `vas_packages` has called its NOT NULL column `name` since it was
 * created. Writing the wrong one is a silent no-op on a table where every
 * column is nullable, so it is derived here rather than typed at each call.
 */
export function nameColumn(kind) {
  return kind === 'vas_pkg' ? 'name' : 'label'
}

/**
 * What the library and picker should call a row, whatever it carries.
 *
 * The fallback chain is why an un-named instrument still reads exactly as it
 * did before its table grew a name column: no migration backfilled one, so most
 * rows are still NULL and fall through to the question they have always shown.
 */
export function instrumentDisplayName(row) {
  const named = (row?.label ?? row?.name ?? '').trim()
  if (named) return named
  const asked = (row?.prompt ?? row?.question ?? '').trim()
  return asked || row?.slug || 'Untitled'
}

/** A name that can be saved: non-empty, and actually different. */
export function isRenameable(current, next) {
  const cleaned = String(next ?? '').trim()
  return cleaned.length > 0 && cleaned !== String(current ?? '').trim()
}
