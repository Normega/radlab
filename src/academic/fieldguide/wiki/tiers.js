// What the catalogue's tier labels mean, in words a student or a new TA can act
// on. Shared by the index and the page so the wording cannot drift between them.
//
// The tier is a **review-budget** device (taxonomy §5): Tier A gets the full
// six-section treatment and ~10–15 minutes of instructor review, Tier B is a
// short orienting stub reviewed in ~3. So the copy describes how full the PAGE
// is and deliberately avoids implying a Tier B disorder is off the syllabus —
// several are taught in full, and only the page is shorter. Getting that wrong
// would tell a student they can skip material the exam covers.

export const TIER_LABEL = {
  A: 'central to the course',
  B: 'supporting page',
}

export const TIER_HELP = {
  A: 'Central to the course — a full page: presentation, diagnosis, epidemiology, etiology, treatment and open debates.',
  B: 'Supporting page — a short orienting entry: description, a link to the official DSM-5-TR criteria, and pointers to related disorders. Shorter because of review time, not because it is off the syllabus.',
  overview: 'Topic overview — the concepts a lecture teaches as one block, shared across the disorders in this chapter.',
  foundation: 'Foundations — a non-disorder anchor: assessment, diagnosis, research methods, suicide, law or ethics.',
}
