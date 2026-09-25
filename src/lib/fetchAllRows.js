// Read every row a query matches, not just the first 1,000.
//
// Supabase (PostgREST) returns at most 1,000 rows per request and says nothing
// when it stops there. Admin screens that read a whole table and counted in the
// browser were fine while studies were small; CHM135 passed 1,000 enrolments in
// its first week and the studies list reported 416 of its 1,237 students
// (Norm, 2026-09-25) — the share of one capped, platform-wide read that happened
// to be CHM135's. The data export already paged (studyExport.js `pageAll`); the
// admin screens never did.
//
// Pages are ordered by `id` (every table read this way has one). Paging an
// unordered query can skip or repeat rows between pages, because Postgres is
// free to return them in a different order each time. A row seen twice is
// dropped rather than counted twice.
//
// Usage — pass a function that builds the query WITHOUT .range()/.order():
//   const rows = await fetchAllRows(() =>
//     supabase.from('study_enrollments').select('id, study_id').eq('study_id', id))

export const PAGE_SIZE = 1000

export async function fetchAllRows(build, { pageSize = PAGE_SIZE } = {}) {
  const out = []
  const seen = new Set()
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build().order('id', { ascending: true }).range(from, from + pageSize - 1)
    if (error) throw error
    const page = data ?? []
    for (const row of page) {
      if (row.id != null) {
        if (seen.has(row.id)) continue
        seen.add(row.id)
      }
      out.push(row)
    }
    if (page.length < pageSize) return out
  }
}
