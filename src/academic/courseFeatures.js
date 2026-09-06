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
  // Gaps and ingest are PSY240 apparatus (a textbook assembled from sources,
  // with declared unknowns for students to claim); PSY309's guide is
  // authored whole, so those surfaces are off too.
  psy309: { contributions: false, gaps: false, ingest: false },
  // PSY240's wiki index is catalogue-anchored (DSM chapters), not
  // week-anchored — previously a hardcoded `code !== 'PSY240'` inside
  // WikiIndex, which is exactly the kind of buried course conditional the
  // course-leak audit now polices.
  psy240: { weekIndex: false },
}

export function courseFeatures(code) {
  return { contributions: true, gaps: true, ingest: true, weekIndex: true, ...(OVERRIDES[String(code ?? '').trim().toLowerCase()] ?? {}) }
}
