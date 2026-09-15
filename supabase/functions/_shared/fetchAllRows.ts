// Read every row a query matches, however many there are.
//
// PostgREST truncates every response at the project's `max-rows` setting (1000
// on this project) and says nothing about it: no error, no warning, simply
// fewer rows than the query matched. Code that reads a whole table in one call
// is therefore correct only until that table outgrows the cap, and then it is
// silently wrong.
//
// Found 2026-09-15 in check_schedule's advance pass, which read every
// participant_schedule row for Experiment Builder studies in one call. When the
// Zerin study's SONA slots opened and 61 people signed up in a day, those studies
// crossed 1,758 rows; ~760 were dropped on every tick, and the participants they
// belonged to were never randomised or given their daily sessions. Nine had
// finished baseline -- one of them 17 hours earlier -- with nothing scheduled
// and no error anywhere.
//
// Termination is on an EMPTY page, and each step advances by the rows actually
// returned, so a server cap smaller than `pageSize` still reads everything
// (stopping at `page.length < pageSize` would quietly truncate again). The
// caller must ORDER BY a unique column: paging an unordered query with offsets
// can skip or repeat rows between requests.
export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
  maxPages = 10000,
): Promise<T[]> {
  const rows: T[] = []
  let from = 0
  for (let pages = 0; ; pages++) {
    if (pages >= maxPages) {
      throw new Error(`fetchAllRows: gave up after ${maxPages} pages (${rows.length} rows) -- is the query ordered and ranged?`)
    }
    const { data, error } = await fetchPage(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    const page = data ?? []
    if (page.length === 0) break
    rows.push(...page)
    from += page.length
  }
  return rows
}
