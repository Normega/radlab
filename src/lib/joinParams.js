// The study join link's parameters, from the query string and/or the fragment.
//
// SONA links (and Prolific links made before 2026-10-09) put them in the query:
//   /study/join?study_id=…&id=%SURVEY_CODE%
// Separate-identity studies (website.md §26c) put them in the fragment:
//   /study/join#study_id=…&PROLIFIC_PID={{%PROLIFIC_PID%}}&STUDY_ID={{%STUDY_ID%}}
// A browser never sends the fragment to a server, so a Prolific ID there reaches
// no request log; it leaves the browser only inside auto-enroll's POST body.
// Where both carry a key, the fragment wins.
export function joinParams(location) {
  const params = new URLSearchParams(location?.search ?? '')
  const hash = String(location?.hash ?? '').replace(/^#/, '')
  for (const [k, v] of new URLSearchParams(hash)) params.set(k, v)
  return params
}

// The auto-enroll request body, or null when required parts are missing.
export function joinRequest(params) {
  const study_id = params.get('study_id')
  let body = null
  if (params.get('PROLIFIC_PID')) {
    body = { study_id, external_id: params.get('PROLIFIC_PID'), source: 'prolific' }
    if (params.get('STUDY_ID'))   body.prolific_study_id   = params.get('STUDY_ID')
    if (params.get('SESSION_ID')) body.prolific_session_id = params.get('SESSION_ID')
  } else if (params.get('id')) {
    body = { study_id, external_id: params.get('id'), source: 'sona' }
  }
  if (!study_id || !body?.external_id) return null
  // Staff test runs: `test=1` marks the new enrollment is_test, so it never
  // counts as a participant (port of the open-join flag, 49f9d93).
  if (params.get('test') === '1') body.test = true
  return body
}
