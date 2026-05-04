// publications.js
// Static annotated bibliography for RADlab.
// Reverse chronological order (newest first).
//
// ADDING A PAPER:
//   1. Copy a template entry below.
//   2. Fill in the required fields (marked with *).
//   3. Add an annotation when ready — leave as null until then.
//   4. pdfUrl and abstractUrl are optional but recommended.
//
// FIELDS:
//   id*          — unique slug, e.g. 'farb-2024-interoception'
//   year*        — publication year (number)
//   authors*     — array of strings, format 'Last, F.' (bold the lab member if desired via isLabMember flag — see authorsList)
//   title*       — full paper title
//   journal*     — journal or book name
//   volume       — journal volume (string or null)
//   issue        — journal issue (string or null)
//   pages        — page range, e.g. '123–145' (string or null)
//   doi          — DOI string only, e.g. '10.1037/xxx' (not full URL)
//   pdfUrl       — direct PDF link or null
//   abstractUrl  — abstract/landing page URL or null
//   annotation   — 1–3 sentence plain-language summary for annotated bib, or null
//   tags         — array of topic strings for future filtering

export const publications = [

  // ─── TEMPLATE — copy this block to add a new paper ───────────────────────
  // {
  //   id: 'last-year-keyword',
  //   year: 2024,
  //   authors: ['Last, F.', 'Coauthor, A.'],
  //   title: 'Full paper title goes here',
  //   journal: 'Journal Name',
  //   volume: '12',
  //   issue: '3',
  //   pages: '100–120',
  //   doi: '10.xxxx/xxxxxxxx',
  //   pdfUrl: null,
  //   abstractUrl: null,
  //   annotation: null,
  //   tags: ['mindfulness', 'interoception'],
  // },
  // ─────────────────────────────────────────────────────────────────────────

  // ─── EXAMPLE ENTRIES (replace with real data) ────────────────────────────

  {
    id: 'farb-2023-example',
    year: 2023,
    authors: ['Farb, N.', 'Anderson, T.', 'Luu, S.'],
    title: 'Example paper title — replace with actual publication',
    journal: 'Journal of Example Research',
    volume: '10',
    issue: '2',
    pages: '200–215',
    doi: '10.xxxx/example',
    pdfUrl: null,
    abstractUrl: null,
    annotation: null,
    tags: ['mindfulness', 'wellbeing'],
  },

  {
    id: 'farb-2022-example',
    year: 2022,
    authors: ['Farb, N.', 'Wu, L.'],
    title: 'Another example paper — replace with actual publication',
    journal: 'Affective Neuroscience Letters',
    volume: '5',
    issue: '1',
    pages: '45–60',
    doi: '10.xxxx/example2',
    pdfUrl: null,
    abstractUrl: null,
    annotation: null,
    tags: ['depression', 'neuroimaging'],
  },

];

// ─── LAB MEMBER NAME LOOKUP ───────────────────────────────────────────────
// Used by the publications component to bold lab member names in author lists.
export const labMemberNames = [
  'Farb, N.',
  'Anderson, T.',
  'Eusebio, J.',
  'Luu, S.',
  'Wu, L.',
  'Zuo, Z.',
  'Araújo, G.',
  'Desormeau, P.',
  'Dinh-Williams, L.',
  'Livingston, J.',
  'Logie-Hagen, K.',
  'Walsh, K.',
  'Wang, Y.',
];
