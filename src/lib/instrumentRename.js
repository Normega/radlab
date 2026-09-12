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

/**
 * The `activities.subcategory` an instrument's picker row is keyed by.
 * Composable instruments use the slug as-is; numeric sliders are registered
 * with a `slider_` prefix (SliderCreatePage has done this since they existed,
 * and StepDispatcher resolves them by that prefixed value), so a rename that
 * forgot it would silently update no picker row at all.
 */
export function pickerSubcategory(kind, slug) {
  return kind === 'slider' ? `slider_${slug}` : slug
}

/** What the library and picker should call a row, whatever it carries. */
export function instrumentDisplayName(row) {
  const name = (row?.label ?? '').trim()
  if (name) return name
  return (row?.prompt ?? '').trim() || row?.slug || 'Untitled'
}

/** A name that can be saved: non-empty, and actually different. */
export function isRenameable(current, next) {
  const cleaned = String(next ?? '').trim()
  return cleaned.length > 0 && cleaned !== String(current ?? '').trim()
}
