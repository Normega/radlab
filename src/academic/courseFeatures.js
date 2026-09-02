// Per-course feature switches for the academic partition.
//
// The DEFAULT is full-featured; an override lists only what a course turns
// OFF, so a brand-new course needs no entry here at all. Codes are lowercase
// (the URL form). When you add or change an entry, update the "Adding a new
// class" checklist in academic.md — that document is where these switches are
// explained to the next person.
const OVERRIDES = {
  // PSY309 uses the Field Guide as a read-only reference — no student
  // contribution pipeline — so its tracking page is participation-only.
  psy309: { contributions: false },
}

export function courseFeatures(code) {
  return { contributions: true, ...(OVERRIDES[String(code ?? '').trim().toLowerCase()] ?? {}) }
}
