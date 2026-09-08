// One DOI normalizer for every place a person pastes one.
//
// Students copy DOIs as the URLs journals display — https://doi.org/10.1212/…,
// http://dx.doi.org/10.x/…, sometimes "doi:10.x/…" — and the resolvers we call
// want the bare registrant form starting "10.". Rather than teach 200 people a
// citation convention, accept whatever they paste (Norm, 2026-09-08).
//
// Deliberately conservative: it strips known prefixes and trims; it never
// rewrites the DOI body itself, because DOIs may contain nearly anything.
export function cleanDoi(value) {
  return String(value ?? '')
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .trim()
}
